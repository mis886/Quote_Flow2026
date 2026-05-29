// New Production Job — minimal form for Beta vertical slice.
// Header fields + one-or-more line items. Each line becomes a prod_jobs row.
//
// Phase 2 will let the user pick a CRM order to import lines from.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { useProductionData } from '../lib/useProductionData';
import { insertJob, logStageEvent, nextJobId } from '../lib/db';
import { localDateStr } from '../../lib/utils';
import type { ProductionJob } from '../lib/types';

interface DraftLine {
  product_desc: string;
  qty: string;
  mould_code: string;
  cavities: string;
  cure_time_min: string;
  cure_temp_c: string;
  compound_code: string;
  tikli_size: string;
}

const blankLine = (): DraftLine => ({
  product_desc: '',
  qty: '',
  mould_code: '',
  cavities: '',
  cure_time_min: '',
  cure_temp_c: '',
  compound_code: '',
  tikli_size: '',
});

export function NewProductionJob() {
  const navigate = useNavigate();
  const { jobs, refresh, loading } = useProductionData();

  const [customerName, setCustomerName] = useState('');
  const [orderRef, setOrderRef]         = useState('');
  const [promised, setPromised]         = useState(localDateStr(new Date(Date.now() + 7 * 86400000)));
  const [priority, setPriority]         = useState<'normal' | 'emergency'>('normal');
  const [emergencyReason, setEmergencyReason] = useState('');
  const [notes, setNotes]               = useState('');
  const [lines, setLines]               = useState<DraftLine[]>([blankLine()]);
  const [saving, setSaving]             = useState(false);
  const [err, setErr]                   = useState<string | null>(null);

  const existingIds = useMemo(() => jobs.map(j => j.id), [jobs]);

  useEffect(() => { setErr(null); }, [customerName, lines, promised]);

  const updateLine = (i: number, patch: Partial<DraftLine>) => {
    setLines(ls => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };
  const addLine    = () => setLines(ls => [...ls, blankLine()]);
  const removeLine = (i: number) => setLines(ls => ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls);

  const canSave =
    customerName.trim().length > 0 &&
    promised &&
    lines.every(l => l.product_desc.trim() && Number(l.qty) > 0) &&
    (priority !== 'emergency' || emergencyReason.trim().length > 0);

  const save = async () => {
    if (!canSave) {
      setErr('Customer name, promised date, and product/qty per line are required. Emergency requires a reason.');
      return;
    }
    setSaving(true);
    try {
      const ids = [...existingIds];
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const id = nextJobId(ids);
        ids.push(id);
        const job: ProductionJob = {
          id,
          order_id: orderRef || null,
          order_line_seq: i + 1,
          customer_name: customerName.trim(),
          product_desc: l.product_desc.trim(),
          qty: Number(l.qty),
          qty_to_mould: Number(l.qty),
          qty_done: 0,
          promised_date: promised,
          priority,
          emergency_reason: priority === 'emergency' ? emergencyReason.trim() : null,
          notes: notes.trim() || null,
          stage: 'moulding',
          status: 'queued',
          mould_code: l.mould_code.trim() || null,
          cavities: l.cavities ? Number(l.cavities) : null,
          cure_time_min: l.cure_time_min ? Number(l.cure_time_min) : null,
          cure_temp_c: l.cure_temp_c ? Number(l.cure_temp_c) : null,
          compound_code: l.compound_code.trim() || null,
          tikli_size: l.tikli_size.trim() || null,
          job_card_no: `JC${id.split('-').pop()}`,
        };
        await insertJob(job);
        await logStageEvent(id, 'moulding', null, null, 'Job created');
      }
      await refresh();
      navigate('/production/sequencer/mould');
    } catch (e: any) {
      setErr(e?.message || 'Failed to save');
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-[12px] text-g500">Loading…</div>;
  }

  const input = 'w-full font-sans text-[13px] text-blk bg-white border border-g300 rounded-[3px] px-2.5 py-2 outline-none focus:border-red-mrt focus:ring-[3px] focus:ring-red-lt';
  const lbl   = 'block text-[10.5px] font-mono font-bold tracking-wider uppercase text-g500 mb-1';

  return (
    <div className="p-4 lg:p-6 max-w-[1100px]">
      <button
        onClick={() => navigate('/production')}
        className="flex items-center gap-1 text-[12px] text-red-mrt hover:underline mb-3"
      >
        <ArrowLeft size={13} /> Back to Production
      </button>

      <h1 className="text-[18px] font-semibold text-blk mb-1">New Production Job</h1>
      <p className="text-[12px] text-g500 mb-4">
        One row per line item. Each line becomes a separate Job Card and enters the Moulding queue.
      </p>

      {/* Header */}
      <div className="bg-white border border-g200 rounded-[3px] p-4 mb-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Customer / Party <span className="text-red-mrt">*</span></label>
          <input
            className={input}
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            placeholder="e.g. Varalka Engineers Pvt Ltd"
          />
        </div>
        <div>
          <label className={lbl}>Customer PO / Reference</label>
          <input
            className={input}
            value={orderRef}
            onChange={e => setOrderRef(e.target.value)}
            placeholder="e.g. Dom2627/7059"
          />
        </div>
        <div>
          <label className={lbl}>Promised Date <span className="text-red-mrt">*</span></label>
          <input type="date" className={input} value={promised} onChange={e => setPromised(e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Priority</label>
          <select
            className={input}
            value={priority}
            onChange={e => setPriority(e.target.value as any)}
          >
            <option value="normal">Normal</option>
            <option value="emergency">🔴 Emergency</option>
          </select>
        </div>
        {priority === 'emergency' && (
          <div className="md:col-span-2">
            <label className={lbl}>Emergency Reason <span className="text-red-mrt">*</span></label>
            <input
              className={input}
              value={emergencyReason}
              onChange={e => setEmergencyReason(e.target.value)}
              placeholder="e.g. Plant shutdown risk, site commissioning…"
            />
          </div>
        )}
        <div className="md:col-span-2">
          <label className={lbl}>Internal Notes</label>
          <input className={input} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional remarks…" />
        </div>
      </div>

      {/* Lines */}
      <div className="bg-white border border-g200 rounded-[3px]">
        <div className="px-3 py-2 border-b border-g200 flex items-center justify-between">
          <div className="text-[11px] font-mono font-bold tracking-wider uppercase text-g500">
            Line Items
            <span className="ml-2 font-normal text-g400 normal-case tracking-normal">
              one production job per line
            </span>
          </div>
          <button
            onClick={addLine}
            className="text-[11px] text-red-mrt border border-red-mrt/30 rounded px-2 py-1 hover:bg-red-lt flex items-center gap-1"
          >
            <Plus size={12} /> Add Line
          </button>
        </div>

        <div className="divide-y divide-g100">
          {lines.map((l, i) => (
            <div key={i} className="p-3 grid grid-cols-12 gap-2 items-start">
              <div className="col-span-12 md:col-span-4">
                <label className={lbl}>Product Description <span className="text-red-mrt">*</span></label>
                <input
                  className={input}
                  value={l.product_desc}
                  onChange={e => updateLine(i, { product_desc: e.target.value })}
                  placeholder="e.g. PHE Gasket M10 EPDM"
                />
              </div>
              <div className="col-span-6 md:col-span-1">
                <label className={lbl}>Qty <span className="text-red-mrt">*</span></label>
                <input
                  type="number"
                  className={input}
                  value={l.qty}
                  onChange={e => updateLine(i, { qty: e.target.value })}
                />
              </div>
              <div className="col-span-6 md:col-span-2">
                <label className={lbl}>Die / Mould</label>
                <input
                  className={input}
                  value={l.mould_code}
                  onChange={e => updateLine(i, { mould_code: e.target.value })}
                  placeholder="e.g. 551/1100"
                />
              </div>
              <div className="col-span-3 md:col-span-1">
                <label className={lbl}>Cav</label>
                <input
                  type="number"
                  className={input}
                  value={l.cavities}
                  onChange={e => updateLine(i, { cavities: e.target.value })}
                />
              </div>
              <div className="col-span-3 md:col-span-1">
                <label className={lbl}>Cure (m)</label>
                <input
                  type="number"
                  className={input}
                  value={l.cure_time_min}
                  onChange={e => updateLine(i, { cure_time_min: e.target.value })}
                />
              </div>
              <div className="col-span-3 md:col-span-1">
                <label className={lbl}>Temp (°C)</label>
                <input
                  type="number"
                  className={input}
                  value={l.cure_temp_c}
                  onChange={e => updateLine(i, { cure_temp_c: e.target.value })}
                />
              </div>
              <div className="col-span-3 md:col-span-2">
                <label className={lbl}>Compound</label>
                <input
                  className={input}
                  value={l.compound_code}
                  onChange={e => updateLine(i, { compound_code: e.target.value })}
                  placeholder="GCH_M6M_NBR"
                />
              </div>
              <div className="col-span-12 flex items-center justify-end">
                {lines.length > 1 && (
                  <button
                    onClick={() => removeLine(i)}
                    className="text-[11px] text-red-mrt hover:underline flex items-center gap-1"
                  >
                    <Trash2 size={11} /> Remove line
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {err && (
        <div className="mt-3 text-[12px] text-red-mrt bg-red-lt border border-red-mrt/30 rounded px-3 py-2">
          {err}
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          onClick={() => navigate('/production')}
          className="px-3 py-2 text-[12px] border border-g300 rounded-[3px] hover:bg-g100"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={!canSave || saving}
          className="px-4 py-2 text-[12px] bg-red-mrt text-white rounded-[3px] hover:bg-red-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save & Send to Moulding'}
        </button>
      </div>
    </div>
  );
}
