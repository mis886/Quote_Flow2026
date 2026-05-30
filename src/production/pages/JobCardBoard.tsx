// Module 05 — Job Card Board
// Table view: all JCs with derived status, aggregates, and action links.
// Status is DERIVED from child tables — never stored.

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RefreshCw, Hammer, Scissors, Microscope, Truck } from 'lucide-react';
import { useProductionData } from '../lib/useProductionData';
import {
  listMoldingSessions, listFinishingSessions,
  listInspectionSessions, listDispatchItems,
} from '../lib/db';
import {
  jcStats, deriveJCStatus, JC_STATUS_COLOR,
} from '../lib/jcStats';
import { PageHeader, FilterBar } from '../components/table';
import type {
  MoldingSession, FinishingSession, InspectionSession, DispatchItem,
  JCDerivedStatus,
} from '../lib/types';

const ALL_STATUSES: JCDerivedStatus[] = [
  'Pending Molding', 'Molding', 'Finishing', 'Inspection',
  'Ready to Dispatch', 'Partially Dispatched', 'Dispatched',
];

export function JobCardBoard() {
  const navigate  = useNavigate();
  const { jobs, loading } = useProductionData();

  const [molding,    setMolding]    = useState<MoldingSession[]>([]);
  const [finishing,  setFinishing]  = useState<FinishingSession[]>([]);
  const [inspection, setInspection] = useState<InspectionSession[]>([]);
  const [dispItems,  setDispItems]  = useState<DispatchItem[]>([]);
  const [childLoading, setChildLoading] = useState(true);
  const [q,     setQ]     = useState('');
  const [stageF, setStageF] = useState<JCDerivedStatus | ''>('');

  const load = async () => {
    setChildLoading(true);
    const [m, f, i, d] = await Promise.all([
      listMoldingSessions(), listFinishingSessions(),
      listInspectionSessions(), listDispatchItems(),
    ]);
    setMolding(m); setFinishing(f); setInspection(i); setDispItems(d);
    setChildLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Enrich each job with derived status + stats
  const enriched = useMemo(() => {
    if (childLoading) return [];
    return jobs.map(j => {
      const stats  = jcStats(j.id, molding, finishing, inspection, dispItems);
      const status = deriveJCStatus(j, stats, molding, finishing, inspection);
      return { job: j, stats, status };
    });
  }, [jobs, molding, finishing, inspection, dispItems, childLoading]);

  // Filter
  const filtered = useMemo(() => {
    return enriched.filter(e => {
      if (stageF && e.status !== stageF) return false;
      if (q) {
        const t = q.toLowerCase();
        return (
          e.job.id.toLowerCase().includes(t) ||
          (e.job.product_desc || '').toLowerCase().includes(t) ||
          (e.job.customer_name || '').toLowerCase().includes(t)
        );
      }
      return true;
    });
  }, [enriched, q, stageF]);

  // Counts per status
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of enriched) c[e.status] = (c[e.status] || 0) + 1;
    return c;
  }, [enriched]);

  const isLoading = loading || childLoading;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        module="Production · Module 05"
        title="Job Card Board"
        subtitle="Derived status — computed live from molding, finishing, inspection, and dispatch records."
        actions={
          <button type="button" onClick={load} title="Refresh"
            className="inline-flex items-center gap-1.5 bg-white text-[#0A6ED1] border border-[#0A6ED1] text-[11px] font-medium px-[9px] py-[5px] rounded-[3px] hover:bg-[#E8F0FD] transition-colors">
            <RefreshCw size={12} /> Refresh
          </button>
        }
      />

      <FilterBar>
        <div className="flex items-center gap-1.5 bg-[#F7F7F7] border border-[#E4E5E6] rounded-[3px] px-2 py-1">
          <Search size={12} className="text-[#555]" />
          <input className="bg-transparent text-[12px] outline-none text-[#111] w-[180px]"
            placeholder="Search job, product, customer…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="text-[11px] border border-[#E4E5E6] rounded-[3px] px-2 py-1 bg-white text-[#333] outline-none focus:border-[#0A6ED1]"
          value={stageF} onChange={e => setStageF(e.target.value as JCDerivedStatus | '')}>
          <option value="">All Statuses</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{s} ({counts[s] || 0})</option>)}
        </select>
        <div className="ml-auto text-[10px] text-[#555]">{filtered.length} job{filtered.length !== 1 ? 's' : ''}</div>
      </FilterBar>

      {/* Status summary chips */}
      <div className="px-4 py-2 flex flex-wrap gap-1.5 bg-white border-b border-[#E4E5E6]">
        {ALL_STATUSES.filter(s => counts[s]).map(s => {
          const c = JC_STATUS_COLOR[s];
          return (
            <button key={s} type="button"
              onClick={() => setStageF(stageF === s ? '' : s)}
              className="text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors"
              style={{ background: stageF === s ? c.text : c.bg, color: stageF === s ? '#fff' : c.text, borderColor: c.border }}>
              {s} · {counts[s]}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-12 text-[12px] text-[#555]">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-[12px] text-[#555] italic">No job cards match the filter.</div>
        ) : (
          <table className="w-full border-collapse text-[12px] text-[#111]">
            <thead className="bg-[#FAFAFA] sticky top-0 z-10">
              <tr>
                {['Job ID', 'Product', 'Customer', 'Status', 'Qty', '▲ Molded', '✓ Passed', '✕ Rejected', '↑ Dispatched', 'Yield', 'Ready', 'Actions'].map(h => (
                  <th key={h} className="text-[10px] font-semibold text-[#555] uppercase tracking-[0.2px] px-3 py-2 text-left whitespace-nowrap border-b border-[#E4E5E6]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ job, stats, status }) => {
                const c = JC_STATUS_COLOR[status];
                return (
                  <tr key={job.id} className="border-b border-[#F3F3F3] hover:bg-[#EEF4FF] cursor-pointer"
                    onClick={() => navigate(`/production/jobs/${job.id}`)}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="font-mono text-[10.5px] font-bold text-[#0A6ED1]">
                        {job.priority === 'emergency' && <span className="text-[#BB0000] mr-0.5">🔴</span>}
                        {job.id}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-semibold max-w-[200px] truncate">{job.product_desc}</td>
                    <td className="px-3 py-2 text-[#555] whitespace-nowrap">{job.customer_name || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="text-[10px] font-medium px-[7px] py-[2px] rounded-[2px] border"
                        style={{ background: c.bg, color: c.text, borderColor: c.border }}>
                        {status}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px]">{job.qty.toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-[#E9730C]">{stats.molded.toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-[#107E3E] font-semibold">{stats.passed.toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-[#BB0000]">{stats.rejected.toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-[#555]">{stats.dispatched.toLocaleString()}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {stats.molded > 0 ? (
                        <span className={`text-[10px] font-medium ${stats.yieldRate >= 90 ? 'text-[#107E3E]' : stats.yieldRate >= 70 ? 'text-[#E9730C]' : 'text-[#BB0000]'}`}>
                          {stats.yieldRate}%
                        </span>
                      ) : <span className="text-[#9E9E9E]">—</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] font-bold text-[#107E3E]">
                      {stats.readyQty > 0 ? stats.readyQty.toLocaleString() : <span className="text-[#9E9E9E] font-normal">—</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <ActionBtn icon={<Hammer size={10} />} label="Mold"   to={`/production/log-molding?jc=${job.id}`}   navigate={navigate} />
                        <ActionBtn icon={<Scissors size={10} />} label="Finish" to={`/production/log-finishing?jc=${job.id}`} navigate={navigate} />
                        <ActionBtn icon={<Microscope size={10} />} label="Inspect" to={`/production/log-inspection?jc=${job.id}`} navigate={navigate} />
                        {stats.readyQty > 0 && (
                          <ActionBtn icon={<Truck size={10} />} label="Dispatch" to={`/production/dispatch?jc=${job.id}`} navigate={navigate} color="green" />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, to, navigate, color = 'blue' }: {
  icon: React.ReactNode; label: string; to: string;
  navigate: ReturnType<typeof useNavigate>; color?: 'blue' | 'green';
}) {
  const cls = color === 'green'
    ? 'bg-[#E8F5E9] text-[#107E3E] border-[#C5E1A5] hover:bg-[#107E3E] hover:text-white'
    : 'bg-[#E8F0FD] text-[#0A6ED1] border-[#C2D8F8] hover:bg-[#0A6ED1] hover:text-white';
  return (
    <button type="button" onClick={() => navigate(to)}
      className={`inline-flex items-center gap-0.5 text-[9.5px] font-medium border px-1.5 py-0.5 rounded-[2px] transition-colors ${cls}`}>
      {icon}{label}
    </button>
  );
}
