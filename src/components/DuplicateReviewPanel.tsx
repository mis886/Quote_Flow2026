import React, { useState, useEffect } from 'react';
import { Customer, Site } from '../lib/types';
import { Button } from './ui';
import { cn } from '../lib/utils';
import {
  X, Copy, GitMerge, Loader2, Star,
  MapPin, AlertCircle, CheckCircle,
} from 'lucide-react';

// ── Pure helpers ──────────────────────────────────────────────────────────────

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\./g, '')
    .replace(/,/g, '')
    .replace(/\bprivate\s+limited\b/g, '')
    .replace(/\bpvt\.?\s*ltd\.?\b/g, '')
    .replace(/\bpvt\b/g, '')
    .replace(/\blimited\b/g, '')
    .replace(/\bltd\b/g, '')
    .replace(/\bllp\b/g, '')
    .replace(/\b&\s*co\b/g, '')
    .replace(/\binc\b/g, '')
    .replace(/\bcorp\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectDuplicateGroups(customers: Customer[]): Customer[][] {
  const buckets = new Map<string, Customer[]>();
  for (const c of customers) {
    const key = normalizeName(c.name);
    if (!key) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(c);
  }
  return Array.from(buckets.values()).filter(g => g.length >= 2);
}

export function mergeSites(group: Customer[], primaryId: string): Site[] {
  const primary = group.find(c => c.id === primaryId)!;
  const others  = group.filter(c => c.id !== primaryId);

  const seenGstin = new Set<string>();
  const seenName  = new Set<string>();
  const result: Site[] = [];

  const addSite = (site: Site) => {
    if (site.gstin?.trim()) {
      const key = site.gstin.trim().toUpperCase();
      if (seenGstin.has(key)) return;
      seenGstin.add(key);
    } else {
      const key = site.name.toLowerCase().trim();
      if (seenName.has(key)) return;
      seenName.add(key);
    }
    result.push(site);
  };

  for (const site of primary.sites ?? []) addSite(site);
  for (const c of others) for (const site of c.sites ?? []) addSite(site);

  return result.map((site, idx) => ({ ...site, isPrimary: idx === 0 }));
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  customers: Customer[];
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  onClose: () => void;
}

interface GroupCardProps {
  group: Customer[];
  groupKey: string;
  primaryId: string;
  isMerging: boolean;
  error: string;
  onSelectPrimary: (id: string) => void;
  onMerge: () => void;
  onSkip: () => void;
}

// ── GroupCard ─────────────────────────────────────────────────────────────────

function GroupCard({
  group, groupKey, primaryId, isMerging, error,
  onSelectPrimary, onMerge, onSkip,
}: GroupCardProps) {
  const [confirming, setConfirming] = useState(false);
  const mergedSitePreview = mergeSites(group, primaryId);

  return (
    <div className="bg-white border border-g200 rounded-sm overflow-hidden shadow-sm">

      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3 bg-g100 border-b border-g200">
        <div className="flex items-center gap-2 min-w-0">
          <Copy size={12} className="text-g500 shrink-0" />
          <span className="font-mono text-[9px] font-bold tracking-[1.5px] uppercase text-g500 shrink-0">Group:</span>
          <span className="font-semibold text-[12.5px] text-blk uppercase tracking-wide truncate">{groupKey}</span>
          <span className="inline-flex items-center px-1.5 py-0.5 bg-g200 rounded font-mono text-[9px] text-g600 shrink-0">
            {group.length} records
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {!confirming ? (
            <>
              <Button size="sm" variant="secondary" onClick={onSkip} disabled={isMerging}>
                Skip
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => setConfirming(true)}
                disabled={isMerging}
                className="gap-1.5"
              >
                {isMerging
                  ? <><Loader2 size={11} className="animate-spin" /> Merging…</>
                  : <><GitMerge size={11} /> Merge</>
                }
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] text-g600 font-medium">Confirm merge?</span>
              <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>Cancel</Button>
              <Button size="sm" variant="primary" onClick={() => { setConfirming(false); onMerge(); }}>
                Yes, Merge
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Records table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-g100">
              <th className="w-8 px-3 py-2" />
              <th className="font-mono text-[8px] font-bold tracking-[1.5px] uppercase text-g500 px-3 py-2 text-left whitespace-nowrap">Customer ID</th>
              <th className="font-mono text-[8px] font-bold tracking-[1.5px] uppercase text-g500 px-3 py-2 text-left">Company Name</th>
              <th className="font-mono text-[8px] font-bold tracking-[1.5px] uppercase text-g500 px-3 py-2 text-left">GSTIN</th>
              <th className="font-mono text-[8px] font-bold tracking-[1.5px] uppercase text-g500 px-3 py-2 text-left">Sites</th>
            </tr>
          </thead>
          <tbody>
            {group.map(c => {
              const isP = c.id === primaryId;
              const hasGstin = !!c.gstin?.trim();
              return (
                <tr
                  key={c.id}
                  className={cn(
                    'border-b border-g100 last:border-0 cursor-pointer transition-colors',
                    isP ? 'bg-red-50' : 'hover:bg-g50'
                  )}
                  onClick={() => onSelectPrimary(c.id)}
                >
                  <td className="px-3 py-2.5 align-middle">
                    <input
                      type="radio"
                      checked={isP}
                      onChange={() => onSelectPrimary(c.id)}
                      onClick={e => e.stopPropagation()}
                      className="accent-red-600 cursor-pointer"
                      title={`Select ${c.name} as primary`}
                    />
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[11px] text-g600">{c.id}</span>
                      {isP && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-100 border border-red-200 text-red-700 text-[8px] font-bold rounded uppercase tracking-wide">
                          <Star size={7} className="fill-red-700" /> Primary
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 align-middle font-medium text-blk max-w-[200px] truncate">{c.name}</td>
                  <td className="px-3 py-2.5 align-middle">
                    {hasGstin ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[11px] text-blk">{c.gstin}</span>
                        <span className="px-1 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[8px] font-bold rounded uppercase">
                          GSTIN
                        </span>
                      </div>
                    ) : (
                      <span className="text-g300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-middle text-g500 font-mono text-[11px]">
                    {(c.sites ?? []).length}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Sites merge preview */}
      <div className="px-4 py-2.5 border-t border-g100 bg-g50 flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[8.5px] font-bold tracking-[1.5px] uppercase text-g500 shrink-0">
          Sites after merge:
        </span>
        {mergedSitePreview.map((s, i) => (
          <span
            key={s.id}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium border',
              i === 0
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-g100 border-g200 text-g600'
            )}
          >
            {i === 0 && <MapPin size={9} />}
            {s.city || s.name}
          </span>
        ))}
        <span className="text-[10px] text-g400 ml-auto font-mono">
          {mergedSitePreview.length} total
        </span>
      </div>

      {/* Error strip */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100 flex items-center gap-2">
          <AlertCircle size={12} className="text-red-600 shrink-0" />
          <span className="text-[11px] text-red-700">{error}</span>
        </div>
      )}
    </div>
  );
}

// ── DuplicateReviewPanel ──────────────────────────────────────────────────────

export function DuplicateReviewPanel({ customers, updateCustomer, deleteCustomer, onClose }: Props) {
  const initialGroups = detectDuplicateGroups(customers);

  const [groups, setGroups] = useState<Customer[][]>(initialGroups);

  const [primarySelections, setPrimarySelections] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const g of initialGroups) {
      const key = normalizeName(g[0].name);
      init[key] = g.find(c => c.gstin?.trim())?.id ?? g[0].id;
    }
    return init;
  });

  const [skipped, setSkipped]     = useState<Set<string>>(new Set());
  const [merging, setMerging]     = useState<Set<string>>(new Set());
  const [mergeError, setMergeError] = useState<Record<string, string>>({});

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const activeGroups = groups.filter(g => !skipped.has(normalizeName(g[0].name)));

  async function handleMerge(group: Customer[], groupKey: string) {
    const primaryId = primarySelections[groupKey];
    const toDelete  = group.filter(c => c.id !== primaryId);

    setMerging(prev => new Set([...prev, groupKey]));
    setMergeError(prev => ({ ...prev, [groupKey]: '' }));

    try {
      const mergedSites = mergeSites(group, primaryId);
      await updateCustomer(primaryId, { sites: mergedSites });
      for (const dup of toDelete) {
        await deleteCustomer(dup.id);
      }
      setGroups(prev => prev.filter(g => normalizeName(g[0].name) !== groupKey));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Merge failed. Please try again.';
      setMergeError(prev => ({ ...prev, [groupKey]: msg }));
    } finally {
      setMerging(prev => {
        const next = new Set(prev);
        next.delete(groupKey);
        return next;
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f8f7f4] overflow-hidden animate-in fade-in duration-200">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-g200 bg-white shrink-0">
        <div>
          <div className="font-mono text-[9px] font-bold tracking-[3px] uppercase text-red-mrt mb-1">
            Data Quality
          </div>
          <h1 className="font-serif text-2xl text-blk tracking-tight leading-tight">
            Duplicate Customer <em className="italic text-red-mrt">Review</em>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-2.5 py-1 bg-g100 border border-g200 rounded-full font-mono text-[11px] font-bold text-g600">
            {activeGroups.length} group{activeGroups.length !== 1 ? 's' : ''} found
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-g400 hover:text-blk bg-g100 hover:bg-g200 rounded transition-colors focus:outline-none"
            aria-label="Close duplicate review"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {activeGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-12 h-12 rounded-full bg-g100 flex items-center justify-center mb-4">
              <CheckCircle size={24} className="text-emerald-500" />
            </div>
            <h3 className="font-serif text-lg text-blk mb-1">No duplicates found</h3>
            <p className="text-[12.5px] text-g500 max-w-xs">
              All customer names appear unique after normalising legal suffixes.
            </p>
          </div>
        ) : (
          activeGroups.map(group => {
            const groupKey = normalizeName(group[0].name);
            return (
              <GroupCard
                key={groupKey}
                group={group}
                groupKey={groupKey}
                primaryId={primarySelections[groupKey]}
                isMerging={merging.has(groupKey)}
                error={mergeError[groupKey] ?? ''}
                onSelectPrimary={id => setPrimarySelections(prev => ({ ...prev, [groupKey]: id }))}
                onMerge={() => handleMerge(group, groupKey)}
                onSkip={() => setSkipped(prev => new Set([...prev, groupKey]))}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
