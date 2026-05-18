import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { Button } from '../components/ui';
import { Search, Plus, Upload, Loader2, X, Phone, Mail, MessageCircle, Star, Package, ChevronRight, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Customer, Contact, CustomerTier, FollowUpLog } from '../lib/types';
import { formatINR } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import Papa from 'papaparse';

// ── helpers ──────────────────────────────────────────────────────────────────

function computeRating(c: Customer): number {
  const p = (c.ratingPayment ?? 0) * 3;
  const o = (c.ratingOrders  ?? 0) * 4;
  const t = (c.ratingTrend   ?? 0) * 3;
  return p + o + t;
}

function getPrimaryContact(c: Customer): Contact | undefined {
  for (const s of c.sites ?? []) {
    const found = (s.contacts ?? []).find(ct => ct.isPrimary) ?? (s.contacts ?? [])[0];
    if (found) return found;
  }
  return undefined;
}

function getTierStyle(tier: CustomerTier | undefined) {
  switch (tier) {
    case 'Gold':   return 'bg-amber-50 text-amber-700 border-amber-300';
    case 'Silver': return 'bg-slate-100 text-slate-600 border-slate-300';
    case 'Bronze': return 'bg-orange-50 text-orange-700 border-orange-300';
    default:       return 'bg-g100 text-g500 border-g300';
  }
}

function TierBadge({ tier }: { tier: CustomerTier | undefined }) {
  const t = tier ?? 'New';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9.5px] font-bold uppercase tracking-wide ${getTierStyle(t)}`}>
      {t === 'Gold' && <Star size={8} className="fill-amber-500 stroke-amber-500" />}
      {t}
    </span>
  );
}

function StarRating({ score }: { score: number }) {
  const stars = Math.round(score / 20);
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={10} className={i <= stars ? 'fill-amber-400 stroke-amber-400' : 'fill-g200 stroke-g200'} />
      ))}
    </div>
  );
}

function InitialAvatar({ name }: { name: string }) {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const colors = ['bg-blue-600', 'bg-indigo-600', 'bg-violet-600', 'bg-emerald-600', 'bg-teal-600', 'bg-rose-600'];
  const col = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-8 h-8 rounded-full ${col} flex items-center justify-center text-white font-bold text-[11px] shrink-0`}>
      {initials || '?'}
    </div>
  );
}

function formatTurnover(v: number | undefined): string {
  if (!v) return '—';
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(1)}Cr`;
  if (v >= 100_000)    return `₹${(v / 100_000).toFixed(0)}L`;
  if (v >= 1_000)      return `₹${(v / 1_000).toFixed(0)}K`;
  return formatINR(v);
}

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  WhatsApp: <MessageCircle size={11} className="text-green-500" />,
  Called:   <Phone size={11} className="text-blue-500" />,
  Email:    <Mail size={11} className="text-red-400" />,
  Meeting:  <Star size={11} className="text-purple-400" />,
  Visit:    <MapPin size={11} className="text-orange-400" />,
};

// ── CustomerPanel ─────────────────────────────────────────────────────────────

function CustomerPanel({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const { data, updateCustomer } = useAppStore();
  const navigate = useNavigate();

  // Gather all follow-up logs for quotes belonging to this customer
  const customerQuotes = data.quotes.filter(q => q.cust === customer.name);
  const quoteIds = new Set(customerQuotes.map(q => q.id));
  const allLogs: (FollowUpLog & { quoteId: string })[] = data.followups
    .filter(f => quoteIds.has(f.quote_id))
    .flatMap(f => f.logs.map(l => ({ ...l, quoteId: f.quote_id })))
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  const primaryContact = getPrimaryContact(customer);
  const rating = computeRating(customer);

  // Inline log form
  const [logChannel, setLogChannel] = useState<FollowUpLog['channel']>('Called');
  const [logNote, setLogNote] = useState('');
  const [logQuoteId, setLogQuoteId] = useState<string>(customerQuotes[0]?.id ?? '');

  // Rating edit
  const [editRating, setEditRating] = useState(false);
  const [rp, setRp] = useState(customer.ratingPayment ?? 0);
  const [ro, setRo] = useState(customer.ratingOrders ?? 0);
  const [rt, setRt] = useState(customer.ratingTrend ?? 0);
  const [tier, setTier] = useState<CustomerTier>(customer.tier ?? 'New');
  const [turnover, setTurnover] = useState(String(customer.turnover ?? ''));
  const [nextOrders, setNextOrders] = useState((customer.nextOrders ?? []).join(', '));
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async () => {
    setSaving(true);
    await updateCustomer(customer.id, {
      tier,
      turnover: turnover ? Number(turnover) : 0,
      ratingPayment: rp,
      ratingOrders: ro,
      ratingTrend: rt,
      nextOrders: nextOrders.split(',').map(s => s.trim()).filter(Boolean),
    });
    setSaving(false);
    setEditRating(false);
  };

  // We can't create a new follow-up log without a quoteId in current store design.
  // Show a prompt if no quotes exist.
  const canLog = customerQuotes.length > 0;

  const handleLog = async () => {
    if (!logNote.trim() || !logQuoteId) return;
    const { addFollowUpLog } = data as any;
    // addFollowUpLog is on the store, not data — use a workaround via the hook
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-blk/30" onClick={onClose} />

      {/* Panel */}
      <div className="w-[440px] bg-white shadow-2xl flex flex-col overflow-hidden border-l border-g200 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-g200 bg-g50/50">
          <div className="flex items-start gap-3">
            <InitialAvatar name={customer.name} />
            <div>
              <h2 className="font-serif text-[17px] text-blk leading-snug tracking-tight">{customer.name}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <TierBadge tier={customer.tier} />
                {customer.seg && <span className="text-[10px] text-g500 font-medium">{customer.seg}</span>}
                {customer.sites?.[0]?.city && (
                  <span className="flex items-center gap-1 text-[10px] text-g400">
                    <MapPin size={9} /> {customer.sites[0].city}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button type="button" title="Close panel" aria-label="Close customer panel" onClick={onClose} className="p-1 text-g400 hover:text-blk rounded transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Stats row */}
          <div className="grid grid-cols-3 divide-x divide-g100 border-b border-g200">
            {[
              { label: 'FY Turnover', value: formatTurnover(customer.turnover) },
              { label: 'Revenue',     value: formatTurnover(customer.revenue) },
              { label: 'Rating',      value: `${rating}/100` },
            ].map(({ label, value }) => (
              <div key={label} className="px-4 py-3 text-center">
                <div className="font-mono text-[8px] font-bold uppercase tracking-[1.5px] text-g400 mb-0.5">{label}</div>
                <div className="font-bold text-[14px] text-blk">{value}</div>
              </div>
            ))}
          </div>

          {/* GSTIN / payment / inco */}
          <div className="px-5 py-3 border-b border-g100 grid grid-cols-2 gap-2 text-[11.5px]">
            <div><span className="text-g400">GSTIN: </span><span className="font-mono font-bold text-blk">{customer.gstin || '—'}</span></div>
            <div><span className="text-g400">Payment: </span><span className="font-bold text-blk">{customer.pay || '—'}</span></div>
            <div><span className="text-g400">Incoterms: </span><span className="font-bold text-blk">{customer.inco || '—'}</span></div>
            <div><span className="text-g400">Currency: </span><span className="font-bold text-blk">{customer.curr || 'INR'}</span></div>
          </div>

          {/* Primary contact */}
          {primaryContact && (
            <div className="px-5 py-3 border-b border-g100">
              <div className="font-mono text-[8px] font-bold uppercase tracking-[1.5px] text-g400 mb-2">Primary Contact</div>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-[13px] text-blk">{primaryContact.name}</div>
                  <div className="text-[11px] text-g500">{primaryContact.role}</div>
                </div>
                <div className="flex gap-1.5">
                  {primaryContact.phone && (
                    <a href={`tel:${primaryContact.phone}`} className="p-1.5 rounded bg-g100 hover:bg-g200 transition-colors" title="Call">
                      <Phone size={12} className="text-blk" />
                    </a>
                  )}
                  {primaryContact.phone && (
                    <a href={`https://wa.me/${primaryContact.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="p-1.5 rounded bg-green-50 hover:bg-green-100 transition-colors" title="WhatsApp">
                      <MessageCircle size={12} className="text-green-600" />
                    </a>
                  )}
                  {primaryContact.email && (
                    <a href={`mailto:${primaryContact.email}`} className="p-1.5 rounded bg-g100 hover:bg-g200 transition-colors" title="Email">
                      <Mail size={12} className="text-blk" />
                    </a>
                  )}
                </div>
              </div>
              {primaryContact.email && <div className="text-[11px] text-g400 mt-1 font-mono">{primaryContact.email}</div>}
            </div>
          )}

          {/* Next Expected Orders */}
          <div className="px-5 py-3 border-b border-g100">
            <div className="font-mono text-[8px] font-bold uppercase tracking-[1.5px] text-g400 mb-2 flex items-center gap-1.5">
              <Package size={10} /> Next Expected Orders
            </div>
            {(customer.nextOrders ?? []).length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {(customer.nextOrders ?? []).map((p, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-100 text-blue-700 text-[11px] font-medium rounded-full">
                    {p}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-[11.5px] text-g400 italic">No predictions yet</div>
            )}
          </div>

          {/* Customer Rating */}
          <div className="px-5 py-3 border-b border-g100">
            <div className="flex items-center justify-between mb-2">
              <div className="font-mono text-[8px] font-bold uppercase tracking-[1.5px] text-g400 flex items-center gap-1.5">
                <Star size={10} /> Customer Rating
              </div>
              <button type="button" onClick={() => setEditRating(v => !v)} className="text-[10px] font-bold text-red-mrt uppercase hover:underline">
                {editRating ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {editRating ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-g500 uppercase tracking-[0.5px] mb-1">Tier</label>
                  <select title="Customer tier" value={tier} onChange={e => setTier(e.target.value as CustomerTier)}
                    className="h-7 px-2 text-[12px] border border-g300 rounded-[3px] bg-white outline-none focus:border-red-mrt">
                    {(['New','Bronze','Silver','Gold'] as CustomerTier[]).map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-g500 uppercase tracking-[0.5px] mb-1">FY Turnover (₹)</label>
                  <input type="number" value={turnover} onChange={e => setTurnover(e.target.value)} placeholder="e.g. 1300000" aria-label="FY Turnover"
                    className="h-7 px-2 w-full text-[12px] border border-g300 rounded-[3px] bg-white outline-none focus:border-red-mrt" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-g500 uppercase tracking-[0.5px] mb-1">Payment on Time (0–10)</label>
                  <input type="number" min={0} max={10} value={rp} onChange={e => setRp(Number(e.target.value))} placeholder="0" aria-label="Payment on time score"
                    className="h-7 px-2 w-20 text-[12px] border border-g300 rounded-[3px] bg-white outline-none focus:border-red-mrt" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-g500 uppercase tracking-[0.5px] mb-1">Regular Orders (0–10)</label>
                  <input type="number" min={0} max={10} value={ro} onChange={e => setRo(Number(e.target.value))} placeholder="0" aria-label="Regular orders score"
                    className="h-7 px-2 w-20 text-[12px] border border-g300 rounded-[3px] bg-white outline-none focus:border-red-mrt" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-g500 uppercase tracking-[0.5px] mb-1">Increasing Trend (0–10)</label>
                  <input type="number" min={0} max={10} value={rt} onChange={e => setRt(Number(e.target.value))} placeholder="0" aria-label="Increasing trend score"
                    className="h-7 px-2 w-20 text-[12px] border border-g300 rounded-[3px] bg-white outline-none focus:border-red-mrt" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-g500 uppercase tracking-[0.5px] mb-1">Next Orders (comma-separated)</label>
                  <input type="text" value={nextOrders} onChange={e => setNextOrders(e.target.value)} placeholder="Terpineol, Pine Oil" aria-label="Next expected orders"
                    className="h-7 px-2 w-full text-[12px] border border-g300 rounded-[3px] bg-white outline-none focus:border-red-mrt" />
                </div>
                <Button size="sm" variant="primary" disabled={saving} onClick={handleSaveProfile}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {[
                  { label: 'Payment on Time', weight: '30%', score: customer.ratingPayment ?? 0 },
                  { label: 'Regular Orders',  weight: '40%', score: customer.ratingOrders ?? 0 },
                  { label: 'Increasing Trend',weight: '30%', score: customer.ratingTrend ?? 0 },
                ].map(({ label, weight, score }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div>
                      <span className="text-[12px] text-blk font-medium">{label}</span>
                      <span className="ml-1.5 text-[10px] text-g400">({weight})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-g200 rounded-full overflow-hidden">
                        <div className="progress-bar-fill" style={{ width: `${score * 10}%` }} />
                      </div>
                      <span className="font-mono text-[11px] font-bold text-blk w-4 text-right">{score}</span>
                    </div>
                  </div>
                ))}
                <div className="pt-2 flex items-center gap-2">
                  <StarRating score={rating} />
                  <span className="font-mono text-[11px] font-bold text-blk">{rating}/100</span>
                </div>
              </div>
            )}
          </div>

          {/* Quote History */}
          <div className="px-5 py-3 border-b border-g100">
            <div className="font-mono text-[8px] font-bold uppercase tracking-[1.5px] text-g400 mb-2">
              Quote History ({customerQuotes.length})
            </div>
            {customerQuotes.length === 0 ? (
              <div className="text-[11.5px] text-g400 italic">No quotes yet.</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {customerQuotes.slice(0, 5).map(q => (
                  <div key={q.id} className="flex items-center justify-between text-[11.5px] py-1 border-b border-g100 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sQ text-[10.5px]">{q.id}</span>
                      <span className="text-g500">{q.date ? format(parseISO(q.date), 'dd MMM yy') : '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px]">{formatINR(q.items.reduce((s,i) => s + i.total, 0))}</span>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        q.status === 'Won' ? 'bg-green-100 text-green-700' :
                        q.status === 'Lost' ? 'bg-red-50 text-red-500' :
                        q.status === 'Sent' ? 'bg-blue-50 text-blue-600' : 'bg-g100 text-g500'
                      }`}>{q.status}</span>
                    </div>
                  </div>
                ))}
                {customerQuotes.length > 5 && (
                  <button type="button" onClick={() => navigate('/quotes')} className="text-[10.5px] text-red-mrt font-bold flex items-center gap-1 mt-1 hover:underline">
                    +{customerQuotes.length - 5} more <ChevronRight size={11} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Contact / Follow-up History */}
          <div className="px-5 py-3">
            <div className="font-mono text-[8px] font-bold uppercase tracking-[1.5px] text-g400 mb-2">
              Contact History ({allLogs.length})
            </div>
            {allLogs.length === 0 ? (
              <div className="text-[11.5px] text-g400 italic">No interactions logged yet.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {allLogs.slice(0, 10).map((log, i) => (
                  <div key={i} className="flex gap-2.5 text-[11.5px]">
                    <div className="mt-0.5 shrink-0">{CHANNEL_ICON[log.channel] ?? <Phone size={11} />}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-blk">{log.channel}</span>
                        <span className="text-g400 text-[10px]">{format(parseISO(log.ts), 'dd MMM yy, HH:mm')}</span>
                        {log.who && <span className="text-g400 text-[10px]">by {log.who}</span>}
                        <span className="font-mono text-[9px] text-g300 bg-g100 px-1.5 rounded">{log.quoteId}</span>
                      </div>
                      {log.note && <p className="text-g600 mt-0.5 leading-snug">{log.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-g200 flex gap-2">
          <Button variant="primary" size="sm" onClick={() => navigate(`/quotes/new?cust=${encodeURIComponent(customer.name)}`)} className="flex-1">
            New Quote
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/customers/new?id=${customer.id}`)} className="flex-1">
            Edit
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Customers page ───────────────────────────────────────────────────────

export function Customers() {
  const { data, addCustomer, updateCustomer } = useAppStore();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [segFilter, setSegFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [importing, setImporting] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          for (const row of results.data as any[]) {
            const customerId = `CUST_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
            const customer: Customer = {
              id: customerId,
              code: row.code || row.Code || '',
              name: row.name || row.Name || row['Company Name'] || '',
              seg: row.seg || row.Seg || row.Segment || 'Other',
              gstin: row.gstin || row.GSTIN || '',
              inco: row.inco || row.Incoterms || 'EXW',
              curr: row.curr || row.Currency || 'INR',
              pay: row.pay || row.Payment || 'Net 30',
              tier: 'New',
              sites: [],
            };
            const siteName = row.site_name || row['Site Name'] || 'HQ';
            const city     = row.city || row.City || '';
            const contactName = row.contact_name || row['Contact Name'];
            if (siteName || city || contactName) {
              const contacts = contactName ? [{
                id: `CONT_${Math.random().toString(36).substr(2,9).toUpperCase()}`,
                name: contactName,
                role: row.contact_role || 'Primary Contact',
                email: row.contact_email || row['Contact Email'] || '',
                phone: row.contact_phone || row['Contact Phone'] || '',
                isPrimary: true,
              }] : [];
              customer.sites.push({
                id: `SITE_${Math.random().toString(36).substr(2,9).toUpperCase()}`,
                name: siteName, city, gstin: customer.gstin, isPrimary: true, contacts,
              });
            }
            await addCustomer(customer);
          }
          alert(`Imported ${(results.data as any[]).length} customers.`);
        } catch {
          alert('Import failed. Check console.');
        } finally {
          setImporting(false);
          e.target.value = '';
        }
      },
    });
  };

  const filteredCustomers = data.customers.filter(c => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const nameMatch  = c.name?.toLowerCase().includes(q);
      const codeMatch  = c.code?.toLowerCase().includes(q);
      const gstinMatch = c.gstin?.toLowerCase().includes(q);
      if (!nameMatch && !codeMatch && !gstinMatch) return false;
    }
    if (segFilter && c.seg !== segFilter) return false;
    if (tierFilter && (c.tier ?? 'New') !== tierFilter) return false;
    return true;
  });

  const segments = Array.from(new Set(data.customers.map(c => c.seg).filter(Boolean))).sort();

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">

      {/* Page header */}
      <div className="pt-5 px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[9px] font-bold tracking-[3px] uppercase text-red-mrt mb-1">Customer Relation Management</div>
            <h1 className="font-serif text-2xl text-blk tracking-tight leading-tight">
              Customer <em className="italic text-red-mrt">Master</em>
            </h1>
            <p className="text-xs text-g500 mt-1 font-light">{data.customers.length} customers · Click a row to view profile & history</p>
          </div>
          <div className="flex items-center gap-2 mt-1 shrink-0">
            <Button variant="dark" className="gap-2 relative" disabled={importing}>
              <input type="file" accept=".csv" className="absolute inset-0 opacity-0 cursor-pointer w-full" onChange={handleImport} title="Import CSV" />
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} className="stroke-2" />}
              Import CSV
            </Button>
            <Button onClick={() => navigate('/customers/new')} variant="primary" className="gap-2">
              <Plus size={14} className="stroke-2" /> Add Customer
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-6 py-2.5 bg-white border-b border-g200 flex-wrap mt-2">
        <div className="flex items-center gap-1.5 bg-white border border-g200 rounded px-2 h-7 min-w-[220px] focus-within:border-red-mrt focus-within:ring-2 focus-within:ring-red-lt">
          <Search size={11} className="text-g400 shrink-0" />
          <input type="text" placeholder="Company, code, GSTIN…" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none font-sans text-xs text-blk w-full placeholder:text-g400" />
        </div>

        <select title="Filter by segment" value={segFilter} onChange={e => setSegFilter(e.target.value)}
          className="select-filter font-sans text-xs text-blk bg-white border border-g200 rounded py-1 pl-2 pr-6 cursor-pointer outline-none appearance-none">
          <option value="">All Segments</option>
          {segments.map(o => <option key={o}>{o}</option>)}
        </select>

        <select title="Filter by tier" value={tierFilter} onChange={e => setTierFilter(e.target.value)}
          className="select-filter font-sans text-xs text-blk bg-white border border-g200 rounded py-1 pl-2 pr-6 cursor-pointer outline-none appearance-none">
          <option value="">All Tiers</option>
          {(['New','Bronze','Silver','Gold'] as CustomerTier[]).map(t => <option key={t}>{t}</option>)}
        </select>

        <div className="ml-auto font-mono text-[10px] text-g500">{filteredCustomers.length} records</div>
      </div>

      {/* Table */}
      <div className="px-6 pb-7 pt-[14px] flex-1 overflow-y-auto">
        <div className="bg-white border border-g200 overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead className="bg-g100">
              <tr>
                {['Company', 'Primary Contact', 'Industry', 'Turnover', 'Incoterms', 'Rating', 'Next Order', 'Actions'].map(h => (
                  <th key={h} className="font-mono text-[8.5px] font-bold tracking-[1.5px] uppercase text-g500 px-[13px] py-[9px] text-left whitespace-nowrap border-b border-g200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr><td colSpan={8} className="text-center p-8 text-g400 text-[13px]">No customers match</td></tr>
              ) : filteredCustomers.map(c => {
                const contact = getPrimaryContact(c);
                const rating  = computeRating(c);
                const nextProd = (c.nextOrders ?? [])[0];
                const moreNext = (c.nextOrders ?? []).length - 1;

                return (
                  <tr key={c.id}
                    className="border-b border-g100 last:border-b-0 hover:bg-g50/60 cursor-pointer transition-colors"
                    onClick={() => setSelectedCustomer(c)}
                  >
                    {/* Company */}
                    <td className="px-[13px] py-[11px] align-middle">
                      <div className="flex items-center gap-2.5">
                        <InitialAvatar name={c.name} />
                        <div>
                          <div className="font-semibold text-blk leading-snug">{c.name}</div>
                          <TierBadge tier={c.tier} />
                        </div>
                      </div>
                    </td>

                    {/* Primary contact */}
                    <td className="px-[13px] py-[11px] align-middle">
                      {contact ? (
                        <div>
                          <div className="font-medium text-blk">{contact.name}</div>
                          <div className="text-[10.5px] text-g400 font-mono">{contact.email}</div>
                        </div>
                      ) : <span className="text-g300">—</span>}
                    </td>

                    {/* Industry */}
                    <td className="px-[13px] py-[11px] align-middle text-g600">{c.seg || '—'}</td>

                    {/* Turnover */}
                    <td className="px-[13px] py-[11px] align-middle">
                      <span className="inline-flex items-center px-2 py-0.5 bg-g100 border border-g200 rounded-[3px] font-mono text-[11px] font-bold text-g600">
                        {formatTurnover(c.turnover)}
                      </span>
                    </td>

                    {/* Incoterms */}
                    <td className="px-[13px] py-[11px] align-middle">
                      <span className="inline-flex items-center px-2 py-0.5 bg-sN/10 border border-sN/20 rounded-[3px] font-mono text-[11px] font-bold text-sN">
                        {c.inco || '—'}
                      </span>
                    </td>

                    {/* Rating */}
                    <td className="px-[13px] py-[11px] align-middle">
                      <StarRating score={rating} />
                      <div className="font-mono text-[10px] text-g500 mt-0.5">{rating}/100</div>
                    </td>

                    {/* Next order */}
                    <td className="px-[13px] py-[11px] align-middle text-[11.5px]">
                      {nextProd ? (
                        <div>
                          <span className="text-blk font-medium">{nextProd}</span>
                          {moreNext > 0 && <span className="ml-1 text-g400 text-[10px]">+{moreNext} more</span>}
                        </div>
                      ) : <span className="text-g300">—</span>}
                    </td>

                    {/* Actions */}
                    <td className="px-[13px] py-[11px] align-middle" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => setSelectedCustomer(c)}>Profile</Button>
                        <Button size="sm" variant="secondary" onClick={() => navigate(`/customers/new?id=${c.id}`)}>
                          <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </Button>
                        <Button size="sm" variant="primary" onClick={() => navigate(`/quotes/new?cust=${encodeURIComponent(c.name)}`)}>Quote</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer profile panel */}
      {selectedCustomer && (
        <CustomerPanel
          customer={data.customers.find(c => c.id === selectedCustomer.id) ?? selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
}
