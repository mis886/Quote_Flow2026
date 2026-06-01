// Module 05 — Job Card Board
// Table view: all JCs with derived status, aggregates, and action links.
// Status is DERIVED from child tables — never stored.

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, RefreshCw, Hammer, Scissors, Microscope, Truck, ShieldCheck, ExternalLink } from 'lucide-react';
import { useProductionData } from '../lib/useProductionData';
import {
  listMoldingSessions, listFinishingSessions,
  listInspectionSessions, listDispatchItems,
} from '../lib/db';
import {
  jcStats, deriveJCStatus, JC_STATUS_COLOR,
} from '../lib/jcStats';
import { PageHeader, FilterBar } from '../components/table';
import { fmtDate } from '../../lib/utils';
import type {
  MoldingSession, FinishingSession, InspectionSession, DispatchItem,
  JCDerivedStatus,
} from '../lib/types';

const ALL_STATUSES: JCDerivedStatus[] = [
  'Pending Molding', 'Molding', 'Finishing', 'Inspection',
  'Ready to Dispatch', 'Partially Dispatched', 'Dispatched',
];

// Stage → log route
const STAGE_ACTIONS: Record<string, { label: string; icon: React.ReactNode; to: (id: string) => string; color: 'blue' | 'orange' | 'purple' | 'green' | 'teal' }[]> = {
  'Pending Molding': [{ label: 'Mold', icon: <Hammer size={9} />, to: id => `/production/log-molding?jc=${id}`, color: 'blue' }],
  'Molding':         [{ label: 'Mold', icon: <Hammer size={9} />, to: id => `/production/log-molding?jc=${id}`, color: 'blue' }],
  'Finishing':       [
    { label: 'Mold',   icon: <Hammer size={9} />,   to: id => `/production/log-molding?jc=${id}`,    color: 'blue' },
    { label: 'Finish', icon: <Scissors size={9} />,  to: id => `/production/log-finishing?jc=${id}`,  color: 'orange' },
  ],
  'Inspection': [
    { label: 'Finish',  icon: <Scissors size={9} />,   to: id => `/production/log-finishing?jc=${id}`,  color: 'orange' },
    { label: 'Inspect', icon: <Microscope size={9} />,  to: id => `/production/log-inspection?jc=${id}`, color: 'purple' },
  ],
  'Ready to Dispatch': [
    { label: 'Inspect', icon: <Microscope size={9} />, to: id => `/production/log-inspection?jc=${id}`, color: 'purple' },
    { label: 'PDI',     icon: <ShieldCheck size={9} />, to: id => `/production/log-pdi?jc=${id}`,        color: 'teal' },
    { label: 'Dispatch',icon: <Truck size={9} />,       to: id => `/production/dispatch/new?jc=${id}`,   color: 'green' },
  ],
  'Partially Dispatched': [
    { label: 'PDI',     icon: <ShieldCheck size={9} />, to: id => `/production/log-pdi?jc=${id}`,        color: 'teal' },
    { label: 'Dispatch',icon: <Truck size={9} />,       to: id => `/production/dispatch/new?jc=${id}`,   color: 'green' },
  ],
  'Dispatched': [],
};

const ACTION_STYLES: Record<string, string> = {
  blue:   'bg-[#E8F0FD] text-[#0A6ED1] border-[#C2D8F8] hover:bg-[#0A6ED1] hover:text-white',
  orange: 'bg-[#FFF3E0] text-[#E9730C] border-[#FFCC80] hover:bg-[#E9730C] hover:text-white',
  purple: 'bg-[#EDE7F6] text-[#6200EA] border-[#D1C4E9] hover:bg-[#6200EA] hover:text-white',
  teal:   'bg-[#E0F2F1] text-[#00796B] border-[#B2DFDB] hover:bg-[#00796B] hover:text-white',
  green:  'bg-[#E8F5E9] text-[#107E3E] border-[#C5E1A5] hover:bg-[#107E3E] hover:text-white',
};

export function JobCardBoard() {
  const navigate  = useNavigate();
  const { jobs, loading } = useProductionData();

  const [molding,    setMolding]    = useState<MoldingSession[]>([]);
  const [finishing,  setFinishing]  = useState<FinishingSession[]>([]);
  const [inspection, setInspection] = useState<InspectionSession[]>([]);
  const [dispItems,  setDispItems]  = useState<DispatchItem[]>([]);
  const [childLoading, setChildLoading] = useState(true);
  const [q,      setQ]      = useState('');
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

  const enriched = useMemo(() => {
    if (childLoading) return [];
    return jobs.map(j => {
      const stats  = jcStats(j.id, molding, finishing, inspection, dispItems);
      const status = deriveJCStatus(j, stats, molding, finishing, inspection);
      return { job: j, stats, status };
    });
  }, [jobs, molding, finishing, inspection, dispItems, childLoading]);

  const filtered = useMemo(() => {
    return enriched.filter(e => {
      if (stageF && e.status !== stageF) return false;
      if (q) {
        const t = q.toLowerCase();
        return (
          e.job.id.toLowerCase().includes(t) ||
          (e.job.product_desc || '').toLowerCase().includes(t) ||
          (e.job.customer_name || '').toLowerCase().includes(t) ||
          (e.job.mould_code || '').toLowerCase().includes(t)
        );
      }
      return true;
    });
  }, [enriched, q, stageF]);

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
        subtitle="Live status computed from molding, finishing, inspection, and dispatch logs."
        actions={
          <button type="button" onClick={load} title="Refresh"
            className="inline-flex items-center gap-1.5 bg-white text-[#0A6ED1] border border-[#0A6ED1] text-[11px] font-medium px-[9px] py-[5px] rounded-[3px] hover:bg-[#E8F0FD] transition-colors">
            <RefreshCw size={12} /> Refresh
          </button>
        }
      />

      {/* Status filter chips */}
      <div className="px-4 py-2 flex flex-wrap gap-1.5 bg-white border-b border-[#E4E5E6]">
        <button type="button"
          onClick={() => setStageF('')}
          className={`text-[10px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
            stageF === '' ? 'bg-[#0A6ED1] text-white border-[#0A6ED1]' : 'bg-white text-[#555] border-[#E4E5E6] hover:border-[#0A6ED1] hover:text-[#0A6ED1]'
          }`}>
          All · {enriched.length}
        </button>
        {ALL_STATUSES.filter(s => (counts[s] || 0) > 0).map(s => {
          const c = JC_STATUS_COLOR[s];
          const active = stageF === s;
          return (
            <button key={s} type="button"
              onClick={() => setStageF(active ? '' : s)}
              className="text-[10px] font-medium px-2.5 py-1 rounded-full border transition-colors"
              style={{
                background:   active ? c.text : c.bg,
                color:        active ? '#fff' : c.text,
                borderColor:  active ? c.text : c.border,
              }}>
              {s} · {counts[s]}
            </button>
          );
        })}
      </div>

      <FilterBar>
        <div className="flex items-center gap-1.5 bg-[#F7F7F7] border border-[#E4E5E6] rounded-[3px] px-2 py-1">
          <Search size={12} className="text-[#555]" />
          <input className="bg-transparent text-[12px] outline-none text-[#111] w-[200px]"
            placeholder="Search job, product, customer, mould…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="ml-auto text-[10px] text-[#555]">{filtered.length} of {enriched.length} job{enriched.length !== 1 ? 's' : ''}</div>
      </FilterBar>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="text-center py-12 text-[12px] text-[#555]">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-[12px] text-[#555] italic">No job cards match the filter.</div>
        ) : (
          <table className="w-full border-collapse text-[12px] text-[#111] min-w-[900px]">
            <thead className="bg-[#FAFAFA] sticky top-0 z-10">
              <tr>
                {[
                  'Job ID', 'Product', 'Customer', 'Status',
                  'Ordered', 'Molded', 'Passed', 'Ready',
                  'Yield', 'Promised', 'Actions',
                ].map(h => (
                  <th key={h} className="text-[10px] font-semibold text-[#555] uppercase tracking-[0.2px] px-3 py-2 text-left whitespace-nowrap border-b border-[#E4E5E6]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ job, stats, status }) => {
                const c       = JC_STATUS_COLOR[status];
                const actions = STAGE_ACTIONS[status] ?? [
                  { label: 'Mold',    icon: <Hammer size={9} />,    to: (id: string) => `/production/log-molding?jc=${id}`,    color: 'blue' },
                  { label: 'Finish',  icon: <Scissors size={9} />,  to: (id: string) => `/production/log-finishing?jc=${id}`,  color: 'orange' },
                  { label: 'Inspect', icon: <Microscope size={9} />, to: (id: string) => `/production/log-inspection?jc=${id}`, color: 'purple' },
                  { label: 'PDI',     icon: <ShieldCheck size={9} />, to: (id: string) => `/production/log-pdi?jc=${id}`,       color: 'teal' },
                ];
                const moldPct = job.qty > 0 ? Math.min(100, Math.round((stats.molded / job.qty) * 100)) : 0;

                return (
                  <tr key={job.id} className="border-b border-[#F3F3F3] hover:bg-[#FAFCFF] group">
                    {/* Job ID */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Link to={`/production/jobs/${job.id}`}
                        className="font-mono text-[10.5px] font-bold text-[#0A6ED1] hover:underline flex items-center gap-1">
                        {job.priority === 'emergency' && <span className="text-[#BB0000]">🔴</span>}
                        {job.id}
                        <ExternalLink size={9} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                      </Link>
                      {job.mould_code && <div className="text-[9.5px] text-[#888] font-mono">{job.mould_code}</div>}
                    </td>

                    {/* Product */}
                    <td className="px-3 py-2.5 max-w-[200px]">
                      <div className="font-semibold text-[#111] truncate text-[12px]">{job.product_desc}</div>
                      {job.type_item_moc && <div className="text-[10px] text-[#888] truncate">{job.type_item_moc}</div>}
                    </td>

                    {/* Customer */}
                    <td className="px-3 py-2.5 text-[#555] whitespace-nowrap text-[11.5px]">{job.customer_name || '—'}</td>

                    {/* Status */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-[10px] font-medium px-[7px] py-[3px] rounded-[2px] border"
                        style={{ background: c.bg, color: c.text, borderColor: c.border }}>
                        {status}
                      </span>
                    </td>

                    {/* Ordered */}
                    <td className="px-3 py-2.5 font-mono text-[11px] text-[#333] whitespace-nowrap">{job.qty.toLocaleString()}</td>

                    {/* Molded with mini progress bar */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="font-mono text-[11px] text-[#E9730C]">{stats.molded.toLocaleString()}</div>
                      {job.qty > 0 && (
                        <div className="w-14 h-1 bg-[#F0F0F0] rounded-full mt-0.5 overflow-hidden">
                          <div className="h-full bg-[#E9730C] rounded-full" style={{ width: `${moldPct}%` }} />
                        </div>
                      )}
                    </td>

                    {/* Passed */}
                    <td className="px-3 py-2.5 font-mono text-[11px] text-[#107E3E] font-semibold whitespace-nowrap">
                      {stats.passed > 0 ? stats.passed.toLocaleString() : <span className="text-[#C0C0C0] font-normal">—</span>}
                    </td>

                    {/* Ready */}
                    <td className="px-3 py-2.5 font-mono text-[11.5px] font-bold whitespace-nowrap">
                      {stats.readyQty > 0
                        ? <span className="text-[#107E3E]">{stats.readyQty.toLocaleString()}</span>
                        : <span className="text-[#C0C0C0] font-normal text-[10px]">—</span>}
                    </td>

                    {/* Yield */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {stats.molded > 0 ? (
                        <span className={`text-[11px] font-semibold ${
                          stats.yieldRate >= 90 ? 'text-[#107E3E]' :
                          stats.yieldRate >= 70 ? 'text-[#E9730C]' : 'text-[#BB0000]'
                        }`}>{stats.yieldRate}%</span>
                      ) : <span className="text-[#C0C0C0] text-[10px]">—</span>}
                    </td>

                    {/* Promised */}
                    <td className="px-3 py-2.5 font-mono text-[11px] whitespace-nowrap">
                      {job.promised_date ? (
                        <span className={job.promised_date < new Date().toISOString().slice(0, 10) && status !== 'Dispatched' ? 'text-[#BB0000] font-semibold' : 'text-[#555]'}>
                          {fmtDate(job.promised_date)}
                        </span>
                      ) : <span className="text-[#C0C0C0]">—</span>}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1 flex-wrap">
                        {actions.map(a => (
                          <button key={a.label} type="button"
                            onClick={() => navigate(a.to(job.id))}
                            className={`inline-flex items-center gap-0.5 text-[9.5px] font-medium border px-1.5 py-[3px] rounded-[2px] transition-colors ${ACTION_STYLES[a.color]}`}>
                            {a.icon}{a.label}
                          </button>
                        ))}
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
