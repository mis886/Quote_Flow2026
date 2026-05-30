// Module 09b — Create Dispatch
// Multi-line form. Each JC row gated by readyQty > 0. readyQty re-checked at save.

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Save, Plus, Trash2 } from 'lucide-react';
import { useProductionData } from '../lib/useProductionData';
import {
  listMoldingSessions, listFinishingSessions,
  listInspectionSessions, listDispatchItems,
  insertDispatch, insertDispatchItem,
} from '../lib/db';
import { jcStats, nextDspId, nextDspItemId } from '../lib/jcStats';
import { PageHeader } from '../components/table';
import type {
  MoldingSession, FinishingSession, InspectionSession, DispatchItem, Dispatch,
} from '../lib/types';
import { useAppStore } from '../../store';

const TRANSPORT_MODES = ['Road', 'Courier', 'Rail', 'Air', 'Hand Delivery'];

interface LineRow {
  key: number;
  jcId: string;
  qty: string;
  unit: string;
}

let keySeq = 0;
const mkRow = (): LineRow => ({ key: ++keySeq, jcId: '', qty: '', unit: 'pcs' });

export function CreateDispatch() {
  const navigate       = useNavigate();
  const [params]       = useSearchParams();
  const { jobs }       = useProductionData();
  const { user }       = useAppStore();

  const [molding,    setMolding]    = useState<MoldingSession[]>([]);
  const [finishing,  setFinishing]  = useState<FinishingSession[]>([]);
  const [inspection, setInspection] = useState<InspectionSession[]>([]);
  const [dispItems,  setDispItems]  = useState<DispatchItem[]>([]);
  const [allDisps,   setAllDisps]   = useState<Dispatch[]>([]);
  const [saving,     setSaving]     = useState(false);

  // Header fields
  const [invoiceNo,    setInvoiceNo]    = useState('');
  const [dispDate,     setDispDate]     = useState(new Date().toISOString().slice(0, 10));
  const [customerName, setCustomerName] = useState('');
  const [poNo,         setPoNo]         = useState('');
  const [mode,         setMode]         = useState('Road');
  const [courier,      setCourier]      = useState('');
  const [tracking,     setTracking]     = useState('');
  const [biltyNo,      setBiltyNo]      = useState('');
  const [biltyDate,    setBiltyDate]    = useState('');
  const [cartons,      setCartons]      = useState('');
  const [invoiceValue, setInvoiceValue] = useState('');
  const [remarks,      setRemarks]      = useState('');

  // Line items
  const [lines, setLines] = useState<LineRow[]>([mkRow()]);

  useEffect(() => {
    Promise.all([
      listMoldingSessions(), listFinishingSessions(),
      listInspectionSessions(), listDispatchItems(),
      import('../lib/db').then(m => m.listDispatches()),
    ]).then(([m, f, i, di, d]) => {
      setMolding(m); setFinishing(f); setInspection(i); setDispItems(di); setAllDisps(d);
      // Pre-select JC from query param
      const preJc = params.get('jc');
      if (preJc) {
        const job = jobs.find(j => j.id === preJc);
        if (job) {
          setCustomerName(job.customer_name || '');
          setLines([{ key: ++keySeq, jcId: preJc, qty: '', unit: 'pcs' }]);
        }
      }
    });
  }, []);

  // Per-JC ready qty
  const readyMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const j of jobs) {
      const s = jcStats(j.id, molding, finishing, inspection, dispItems);
      if (s.readyQty > 0) map[j.id] = s.readyQty;
    }
    return map;
  }, [jobs, molding, finishing, inspection, dispItems]);

  const readyJobs = useMemo(() =>
    jobs.filter(j => (readyMap[j.id] || 0) > 0),
    [jobs, readyMap]
  );

  const updateLine = (key: number, patch: Partial<LineRow>) => {
    setLines(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l));
  };

  const removeLine = (key: number) => {
    setLines(prev => prev.filter(l => l.key !== key));
  };

  const totalQty = lines.reduce((a, l) => a + (parseInt(l.qty, 10) || 0), 0);

  const save = async () => {
    if (!invoiceNo.trim() || !customerName.trim()) {
      alert('Invoice No and Customer are required.');
      return;
    }
    const validLines = lines.filter(l => l.jcId && l.qty);
    if (validLines.length === 0) {
      alert('Add at least one job card line with a quantity.');
      return;
    }
    // Validate readyQty gate
    for (const l of validLines) {
      const ready = readyMap[l.jcId] || 0;
      const qty   = parseInt(l.qty, 10) || 0;
      if (qty <= 0) { alert(`Line ${l.jcId}: qty must be > 0.`); return; }
      if (qty > ready) { alert(`Line ${l.jcId}: qty (${qty}) exceeds ready pool (${ready} pcs).`); return; }
    }
    setSaving(true);
    try {
      const dspId = nextDspId(allDisps.map(d => d.id));
      const dsp: Dispatch = {
        id:                   dspId,
        invoice_no:           invoiceNo.trim(),
        dispatch_date:        dispDate,
        customer_name:        customerName.trim(),
        po_no:                poNo.trim() || null,
        total_qty_dispatched: totalQty,
        mode:                 mode || null,
        courier_name:         courier.trim() || null,
        tracking_number:      tracking.trim() || null,
        bilty_no:             biltyNo.trim() || null,
        bilty_date:           biltyDate || null,
        no_of_cartons:        cartons ? parseInt(cartons, 10) : null,
        invoice_value:        invoiceValue ? parseFloat(invoiceValue) : null,
        status:               'Dispatched',
        remarks:              remarks.trim() || null,
        entered_by:           user?.email || null,
      };
      await insertDispatch(dsp);

      for (let seq = 0; seq < validLines.length; seq++) {
        const l   = validLines[seq];
        const job = jobs.find(j => j.id === l.jcId);
        const orderedQty = job?.qty || null;
        // previously dispatched for this JC (before this save)
        const prevDisp = dispItems
          .filter(di => di.job_card_id === l.jcId)
          .reduce((a, di) => a + (di.qty_dispatched || 0), 0);
        const remainingQty = orderedQty != null
          ? orderedQty - prevDisp - (parseInt(l.qty, 10) || 0)
          : null;
        const item: DispatchItem = {
          id:            nextDspItemId(seq),
          dispatch_id:   dspId,
          job_card_id:   l.jcId,
          qty_dispatched: parseInt(l.qty, 10),
          unit:          l.unit,
          ordered_qty:   orderedQty,
          remaining_qty: remainingQty,
          order_id:      job?.order_id || null,
          po_no:         poNo.trim() || null,
          ordered_item:  job?.product_desc || null,
          die_no:        job?.mould_code || null,
          dispatch_date: dispDate,
          invoice_no:    invoiceNo.trim(),
          entered_by:    user?.email || null,
        };
        await insertDispatchItem(item);
      }
      navigate('/production/dispatch');
    } catch (e: any) {
      alert(e?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        module="Production · Module 09"
        title="Create Dispatch"
        subtitle="One invoice per dispatch. Qty is capped to ready pool per job card."
        actions={
          <button type="button" onClick={save} disabled={saving}
            className="inline-flex items-center gap-1.5 bg-[#107E3E] text-white text-[11px] font-medium px-[11px] py-[5px] rounded-[3px] hover:bg-[#0B5C2A] disabled:opacity-40 transition-colors">
            <Save size={13} /> {saving ? 'Saving…' : 'Save Dispatch'}
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-w-[860px]">

        {/* Invoice & Customer */}
        <Card title="Invoice & Customer">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Invoice No *">
              <input className={inp} value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} placeholder="INV/26/0042" title="Invoice no" />
            </Field>
            <Field label="Dispatch Date *">
              <input type="date" className={inp} value={dispDate} onChange={e => setDispDate(e.target.value)} title="Date" />
            </Field>
            <Field label="Customer *">
              <input className={inp} value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name" title="Customer" />
            </Field>
            <Field label="PO No">
              <input className={inp} value={poNo} onChange={e => setPoNo(e.target.value)} placeholder="PO/26/..." title="PO no" />
            </Field>
          </div>
        </Card>

        {/* Transport */}
        <Card title="Transport Details">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Transport Mode">
              <select className={inp} value={mode} onChange={e => setMode(e.target.value)} title="Mode">
                {TRANSPORT_MODES.map(m => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Courier Name">
              <input className={inp} value={courier} onChange={e => setCourier(e.target.value)} placeholder="Blue Dart" title="Courier" />
            </Field>
            <Field label="Tracking / LR No">
              <input className={inp} value={tracking} onChange={e => setTracking(e.target.value)} title="Tracking" />
            </Field>
            <Field label="Bilty No">
              <input className={inp} value={biltyNo} onChange={e => setBiltyNo(e.target.value)} title="Bilty no" />
            </Field>
            <Field label="Bilty Date">
              <input type="date" className={inp} value={biltyDate} onChange={e => setBiltyDate(e.target.value)} title="Bilty date" />
            </Field>
            <Field label="No of Cartons">
              <input type="number" className={inp} value={cartons} onChange={e => setCartons(e.target.value)} title="Cartons" />
            </Field>
            <Field label="Invoice Value (₹)">
              <input type="number" step="0.01" className={inp} value={invoiceValue} onChange={e => setInvoiceValue(e.target.value)} title="Value" />
            </Field>
            <Field label="Remarks" className="md:col-span-2">
              <input className={inp} value={remarks} onChange={e => setRemarks(e.target.value)} title="Remarks" />
            </Field>
          </div>
        </Card>

        {/* Line items */}
        <div className="bg-white border border-[#E4E5E6] rounded-[3px]">
          <div className="px-3 py-2 border-b border-[#E4E5E6] flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#333] uppercase tracking-wider flex-1">Dispatch Line Items</span>
            <span className="text-[10px] text-[#555]">Total: <strong className="text-[#107E3E]">{totalQty.toLocaleString()} pcs</strong></span>
          </div>
          <div className="p-3 space-y-2">
            {lines.map((line, idx) => {
              const job       = jobs.find(j => j.id === line.jcId);
              const ready     = line.jcId ? (readyMap[line.jcId] || 0) : 0;
              const qtyNum    = parseInt(line.qty, 10) || 0;
              const overLimit = qtyNum > ready && ready > 0;
              return (
                <div key={line.key} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-end">
                  <div>
                    {idx === 0 && <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#555] mb-1">Job Card</label>}
                    <select className={inp} value={line.jcId}
                      onChange={e => {
                        const id = e.target.value;
                        const j  = jobs.find(j2 => j2.id === id);
                        updateLine(line.key, { jcId: id, qty: String(readyMap[id] || ''), unit: 'pcs' });
                        if (j && !customerName) setCustomerName(j.customer_name || '');
                      }}
                      title="Job card">
                      <option value="">— Select Job Card (ready only) —</option>
                      {readyJobs.map(j => (
                        <option key={j.id} value={j.id}>
                          {j.id} · {j.product_desc} · Ready: {readyMap[j.id]} pcs
                        </option>
                      ))}
                    </select>
                    {job && (
                      <div className="text-[10px] text-[#555] mt-0.5">{job.product_desc} · {job.customer_name}</div>
                    )}
                  </div>
                  <div>
                    {idx === 0 && <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#555] mb-1">
                      Qty{ready > 0 ? ` (max ${ready})` : ''}
                    </label>}
                    <input type="number" min={1} max={ready || undefined}
                      className={`${inp} ${overLimit ? 'border-[#BB0000]' : ''}`}
                      value={line.qty}
                      onChange={e => updateLine(line.key, { qty: e.target.value })}
                      title="Qty to dispatch" />
                    {overLimit && <div className="text-[10px] text-[#BB0000] mt-0.5">Exceeds ready pool ({ready})</div>}
                  </div>
                  <div>
                    {idx === 0 && <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#555] mb-1">Unit</label>}
                    <select className={inp} value={line.unit} onChange={e => updateLine(line.key, { unit: e.target.value })} title="Unit">
                      {['pcs', 'kg', 'sets', 'nos'].map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                  <button type="button" onClick={() => removeLine(line.key)} title="Remove line"
                    className="text-[#BB0000] hover:text-[#8E0000] pb-0.5">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
            <button type="button" onClick={() => setLines(prev => [...prev, mkRow()])}
              className="inline-flex items-center gap-1 text-[11px] text-[#0A6ED1] hover:underline mt-1">
              <Plus size={12} /> Add Job Card Line
            </button>
          </div>
        </div>

        <div className="text-[10.5px] text-[#555] border-t border-[#E4E5E6] pt-2">
          Entry is permanent · Corrections require a new entry
        </div>
      </div>
    </div>
  );
}

const inp = 'w-full font-sans text-[12px] text-[#111] bg-white border border-[#E4E5E6] rounded-[3px] px-2.5 py-1.5 outline-none focus:border-[#0A6ED1]';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#E4E5E6] rounded-[3px]">
      <div className="px-3 py-2 border-b border-[#E4E5E6] text-[11px] font-semibold text-[#333] uppercase tracking-wider">{title}</div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#555] mb-1">{label}</label>
      {children}
    </div>
  );
}
