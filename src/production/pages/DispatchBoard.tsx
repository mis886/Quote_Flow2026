// Module 09 — Dispatch Board
// Two panels: Ready-to-Dispatch pool (readyQty > 0) + Dispatch Register.

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useProductionData } from '../lib/useProductionData';
import {
  listMoldingSessions, listFinishingSessions,
  listInspectionSessions, listDispatchItems,
  listDispatches, updateDispatchStatus,
} from '../lib/db';
import { jcStats, deriveJCStatus } from '../lib/jcStats';
import { productIdentity } from '../lib/productLabel';
import { PageHeader } from '../components/table';
import { fmtIST, fmtDate } from '../../lib/utils';
import type {
  MoldingSession, FinishingSession, InspectionSession, DispatchItem,
  Dispatch,
} from '../lib/types';

const DISPATCH_STATUSES = ['Dispatched', 'In Transit', 'Delivered', 'Returned'] as const;

export function DispatchBoard() {
  const navigate = useNavigate();
  const { jobs } = useProductionData();

  const [molding,    setMolding]    = useState<MoldingSession[]>([]);
  const [finishing,  setFinishing]  = useState<FinishingSession[]>([]);
  const [inspection, setInspection] = useState<InspectionSession[]>([]);
  const [dispItems,  setDispItems]  = useState<DispatchItem[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set());
  const [collapsedCust, setCollapsedCust] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    const [m, f, i, di, d] = await Promise.all([
      listMoldingSessions(), listFinishingSessions(),
      listInspectionSessions(), listDispatchItems(), listDispatches(),
    ]);
    setMolding(m); setFinishing(f); setInspection(i);
    setDispItems(di); setDispatches(d);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Ready-to-dispatch pool, grouped Customer → PO → job cards.
  const readyPool = useMemo(() => {
    return jobs
      .map(j => ({ job: j, stats: jcStats(j.id, molding, finishing, inspection, dispItems) }))
      .filter(({ stats }) => stats.readyQty > 0)
      .sort((a, b) => (a.job.promised_date || '').localeCompare(b.job.promised_date || ''));
  }, [jobs, molding, finishing, inspection, dispItems]);

  const readyGroups = useMemo(() => {
    const byCust = new Map<string, {
      customer: string;
      totalReady: number;
      pos: Map<string, { po: string; totalReady: number; rows: typeof readyPool }>;
    }>();
    for (const row of readyPool) {
      const cust = row.job.customer_name || '— No customer —';
      const po   = row.job.po_no || '— No PO —';
      if (!byCust.has(cust)) byCust.set(cust, { customer: cust, totalReady: 0, pos: new Map() });
      const c = byCust.get(cust)!;
      c.totalReady += row.stats.readyQty;
      if (!c.pos.has(po)) c.pos.set(po, { po, totalReady: 0, rows: [] });
      const p = c.pos.get(po)!;
      p.totalReady += row.stats.readyQty;
      p.rows.push(row);
    }
    return [...byCust.values()].sort((a, b) => a.customer.localeCompare(b.customer));
  }, [readyPool]);

  // Already-dispatched qty per job (for the "remaining in order" column).
  const dispatchedByJob = useMemo(() => {
    const m: Record<string, number> = {};
    for (const di of dispItems) m[di.job_card_id] = (m[di.job_card_id] || 0) + (di.qty_dispatched || 0);
    return m;
  }, [dispItems]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleStatusChange = async (id: string, status: string) => {
    await updateDispatchStatus(id, status);
    await load();
  };

  const getItemsForDispatch = (dspId: string) =>
    dispItems.filter(di => di.dispatch_id === dspId);

  const toggleCust = (cust: string) => {
    setCollapsedCust(prev => {
      const next = new Set(prev);
      next.has(cust) ? next.delete(cust) : next.add(cust);
      return next;
    });
  };

  // Open the Create Dispatch form preselected to a customer + PO.
  const dispatchPo = (customer: string, po: string) => {
    const q = new URLSearchParams();
    if (customer && !customer.startsWith('—')) q.set('customer', customer);
    if (po && !po.startsWith('—')) q.set('po', po);
    navigate(`/production/dispatch/new${q.toString() ? `?${q}` : ''}`);
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        module="Production · Module 09"
        title="Dispatch Board"
        subtitle="Ready pool + dispatch register. readyQty = passed − dispatched."
        actions={
          <button type="button" onClick={() => navigate('/production/dispatch/new')}
            className="inline-flex items-center gap-1.5 bg-[#107E3E] text-white text-[11px] font-medium px-[11px] py-[5px] rounded-[3px] hover:bg-[#0B5C2A] transition-colors">
            <Plus size={13} /> Create Dispatch
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ── Ready-to-Dispatch Pool ── */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[12px] font-semibold text-[#111]">Ready to Dispatch</span>
            <span className="bg-[#E8F5E9] text-[#107E3E] text-[10px] font-medium px-2 py-0.5 rounded-full border border-[#C5E1A5]">
              {readyPool.length} job{readyPool.length !== 1 ? 's' : ''}
            </span>
          </div>

          {loading ? (
            <div className="text-center py-6 text-[12px] text-[#555]">Loading…</div>
          ) : readyPool.length === 0 ? (
            <div className="bg-white border border-[#E4E5E6] rounded-[3px] p-6 text-center text-[12px] text-[#555] italic">
              No jobs ready to dispatch yet.
            </div>
          ) : (
            <div className="space-y-2">
              {readyGroups.map(group => {
                const collapsed = collapsedCust.has(group.customer);
                return (
                  <div key={group.customer} className="bg-white border border-[#E4E5E6] rounded-[3px] overflow-hidden">
                    {/* Customer header */}
                    <button type="button" onClick={() => toggleCust(group.customer)}
                      className="w-full px-3 py-2 border-b border-[#E4E5E6] bg-[#FAFAFA] flex items-center gap-2 text-left hover:bg-[#F3F6F9] transition-colors">
                      {collapsed ? <ChevronRight size={13} className="text-[#555]" /> : <ChevronDown size={13} className="text-[#555]" />}
                      <span className="text-[12px] font-semibold text-[#111] flex-1">{group.customer}</span>
                      <span className="text-[10px] text-[#555]">{group.pos.size} PO{group.pos.size !== 1 ? 's' : ''}</span>
                      <span className="bg-[#E8F5E9] text-[#107E3E] text-[10px] font-medium px-2 py-0.5 rounded-full border border-[#C5E1A5]">
                        {group.totalReady.toLocaleString()} pcs ready
                      </span>
                    </button>

                    {!collapsed && (
                      <div className="divide-y divide-[#F0F0F0]">
                        {[...group.pos.values()].map(po => (
                          <div key={po.po} className="px-3 py-2">
                            {/* PO sub-header */}
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#555]">PO</span>
                              <span className="font-mono text-[11px] font-bold text-[#0A6ED1]">{po.po}</span>
                              <span className="text-[10px] text-[#107E3E]">{po.totalReady.toLocaleString()} pcs ready</span>
                              <button type="button" onClick={() => dispatchPo(group.customer, po.po)}
                                className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-medium bg-[#107E3E] text-white rounded-[3px] px-2 py-0.5 hover:bg-[#0B5C2A] transition-colors">
                                <Package size={11} /> Dispatch this PO →
                              </button>
                            </div>
                            {/* Job rows */}
                            <table className="w-full border-collapse text-[11.5px]">
                              <thead>
                                <tr className="text-[9.5px] text-[#555] uppercase tracking-wider">
                                  <th className="text-left pb-1 pr-3 font-semibold">Job Card</th>
                                  <th className="text-left pb-1 pr-3 font-semibold">Product</th>
                                  <th className="text-left pb-1 pr-3 font-semibold">Promised</th>
                                  <th className="text-right pb-1 pr-3 font-semibold">Ordered</th>
                                  <th className="text-right pb-1 pr-3 font-semibold">Dispatched</th>
                                  <th className="text-right pb-1 pr-3 font-semibold text-[#107E3E]">Ready</th>
                                  <th className="text-right pb-1 font-semibold">Remaining</th>
                                </tr>
                              </thead>
                              <tbody>
                                {po.rows.map(({ job, stats }) => {
                                  const already   = dispatchedByJob[job.id] || 0;
                                  const remaining = job.qty ? Math.max(0, job.qty - already) : null;
                                  const overdue   = job.promised_date && job.promised_date < new Date().toISOString().slice(0, 10);
                                  return (
                                    <tr key={job.id} className="border-t border-[#F3F3F3] hover:bg-[#EEF4FF] cursor-pointer"
                                      onClick={() => navigate(`/production/dispatch/new?jc=${job.id}`)}>
                                      <td className="py-1 pr-3 font-mono text-[#0A6ED1] font-bold whitespace-nowrap">
                                        {job.priority === 'emergency' && <span className="text-[#BB0000] mr-0.5">🔴</span>}{job.id}
                                      </td>
                                      <td className="py-1 pr-3 text-[#111] max-w-[200px] truncate">{productIdentity(job)}</td>
                                      <td className={`py-1 pr-3 font-mono whitespace-nowrap ${overdue ? 'text-[#BB0000] font-semibold' : 'text-[#555]'}`}>
                                        {fmtDate(job.promised_date)}{overdue ? ' ⚠' : ''}
                                      </td>
                                      <td className="py-1 pr-3 text-right font-mono text-[#555]">{(job.qty || 0).toLocaleString()}</td>
                                      <td className="py-1 pr-3 text-right font-mono text-[#555]">{stats.dispatched.toLocaleString()}</td>
                                      <td className="py-1 pr-3 text-right font-mono font-semibold text-[#107E3E]">{stats.readyQty.toLocaleString()}</td>
                                      <td className="py-1 text-right font-mono text-[#111]">{remaining != null ? remaining.toLocaleString() : '—'}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Dispatch Register ── */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[12px] font-semibold text-[#111]">Dispatch Register</span>
            <span className="text-[10px] text-[#555]">{dispatches.length} invoice{dispatches.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="bg-white border border-[#E4E5E6] rounded-[3px] overflow-hidden">
            {dispatches.length === 0 ? (
              <div className="p-6 text-center text-[12px] text-[#555] italic">No dispatches yet.</div>
            ) : (
              <table className="w-full border-collapse text-[12px]">
                <thead className="bg-[#FAFAFA]">
                  <tr>
                    {['', 'DSP ID', 'Invoice No', 'Date', 'Customer', 'Total Qty', 'Mode', 'Courier / Tracking', 'Status', 'Value'].map(h => (
                      <th key={h} className="text-[10px] font-semibold text-[#555] uppercase px-3 py-2 text-left whitespace-nowrap border-b border-[#E4E5E6]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dispatches.map(d => {
                    const isOpen = expanded.has(d.id);
                    const items  = getItemsForDispatch(d.id);
                    const statusColor = d.status === 'Delivered' ? 'text-[#107E3E]' :
                                        d.status === 'Returned'  ? 'text-[#BB0000]' :
                                        d.status === 'In Transit'? 'text-[#0A6ED1]' : 'text-[#E9730C]';
                    return (
                      <>
                        <tr key={d.id} className="border-b border-[#F3F3F3] hover:bg-[#EEF4FF] cursor-pointer"
                          onClick={() => toggleExpand(d.id)}>
                          <td className="px-3 py-2">
                            {isOpen ? <ChevronDown size={12} className="text-[#555]" /> : <ChevronRight size={12} className="text-[#555]" />}
                          </td>
                          <td className="px-3 py-2 font-mono text-[10.5px] font-bold text-[#0A6ED1]">{d.id}</td>
                          <td className="px-3 py-2 font-semibold text-[#111]">{d.invoice_no}</td>
                          <td className="px-3 py-2 text-[#555] whitespace-nowrap">{d.dispatch_date}</td>
                          <td className="px-3 py-2 font-medium text-[#111]">{d.customer_name}</td>
                          <td className="px-3 py-2 font-mono text-[11px]">{d.total_qty_dispatched?.toLocaleString()}</td>
                          <td className="px-3 py-2 text-[#555]">{d.mode || '—'}</td>
                          <td className="px-3 py-2 text-[#555] max-w-[160px] truncate">
                            {d.courier_name || '—'}
                            {d.tracking_number && <span className="ml-1 font-mono text-[10px]">· {d.tracking_number}</span>}
                          </td>
                          <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                            <select
                              value={d.status}
                              onChange={e => handleStatusChange(d.id, e.target.value)}
                              className={`text-[11px] font-medium border border-[#E4E5E6] rounded-[3px] px-1.5 py-0.5 bg-white outline-none ${statusColor}`}
                              title="Update status"
                            >
                              {DISPATCH_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-[#555]">
                            {d.invoice_value ? `₹${Number(d.invoice_value).toLocaleString('en-IN')}` : '—'}
                          </td>
                        </tr>

                        {/* Expanded line items */}
                        {isOpen && (
                          <tr key={`${d.id}-exp`} className="bg-[#FAFAFA] border-b border-[#E4E5E6]">
                            <td colSpan={10} className="px-6 py-3">
                              <div className="text-[10.5px] font-semibold text-[#555] uppercase tracking-wider mb-2">
                                Line Items — {items.length} job card{items.length !== 1 ? 's' : ''}
                              </div>
                              {items.length === 0 ? (
                                <div className="text-[11px] text-[#555] italic">No line items.</div>
                              ) : (
                                <table className="w-full border-collapse text-[11.5px]">
                                  <thead>
                                    <tr className="text-[10px] text-[#555] uppercase">
                                      <th className="text-left pb-1 pr-4">Job Card</th>
                                      <th className="text-left pb-1 pr-4">Description</th>
                                      <th className="text-left pb-1 pr-4">Die No</th>
                                      <th className="text-right pb-1 pr-4">Ordered</th>
                                      <th className="text-right pb-1 pr-4">Dispatched</th>
                                      <th className="text-right pb-1">Remaining</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {items.map(item => (
                                      <tr key={item.id} className="border-t border-[#EBEBEB]">
                                        <td className="py-1 pr-4 font-mono text-[#0A6ED1] font-bold">{item.job_card_id}</td>
                                        <td className="py-1 pr-4 text-[#111]">{item.ordered_item || '—'}</td>
                                        <td className="py-1 pr-4 font-mono text-[#555]">{item.die_no || '—'}</td>
                                        <td className="py-1 pr-4 text-right font-mono">{item.ordered_qty?.toLocaleString() || '—'}</td>
                                        <td className="py-1 pr-4 text-right font-mono font-semibold text-[#107E3E]">{item.qty_dispatched.toLocaleString()}</td>
                                        <td className="py-1 text-right font-mono">{item.remaining_qty?.toLocaleString() ?? '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                              {d.bilty_no && (
                                <div className="mt-2 text-[10.5px] text-[#555]">
                                  Bilty: <strong>{d.bilty_no}</strong>
                                  {d.bilty_date && ` · ${d.bilty_date}`}
                                  {d.no_of_cartons && ` · ${d.no_of_cartons} cartons`}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
