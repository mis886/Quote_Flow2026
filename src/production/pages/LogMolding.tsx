// Module 06 — Log Molding
// Append-only. Prefills from last session history or product master.
// Running-total widget shows prev + this = new / planned live.

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Info } from 'lucide-react';
import { useProductionData } from '../lib/useProductionData';
import {
  listMoldingSessions, insertMoldingSession, listJobs,
} from '../lib/db';
import { nextMldId, calcWorkingMinutes } from '../lib/jcStats';
import { PageHeader } from '../components/table';
import { fmtIST } from '../../lib/utils';
import type { MoldingSession } from '../lib/types';
import { useAppStore } from '../../store';

const SHIFTS = ['A', 'B', 'C'];
const OP_TYPES = ['Production', 'Trial', 'Rework'];

export function LogMolding() {
  const navigate = useNavigate();
  const { jobs, presses } = useProductionData();
  const { user } = useAppStore();

  const [allSessions, setAllSessions] = useState<MoldingSession[]>([]);
  const [saving, setSaving]           = useState(false);
  const [prefillSource, setPrefillSource] = useState<string | null>(null);

  // Form state
  const [jcId, setJcId]               = useState('');
  const [date, setDate]               = useState(new Date().toISOString().slice(0, 10));
  const [shift, setShift]             = useState('A');
  const [opType, setOpType]           = useState('Production');
  const [pressNo, setPressNo]         = useState('');
  const [dieNo, setDieNo]             = useState('');
  const [tikliSize, setTikliSize]     = useState('');
  const [cureTime, setCureTime]       = useState('');
  const [cureTemp, setCureTemp]       = useState('');
  const [scorchTime, setScorchTime]   = useState('');
  const [dieChangeMin, setDieChangeMin] = useState('');
  const [doriKhatam, setDoriKhatam]   = useState('');
  const [spray, setSpray]             = useState('');
  const [wtBefore, setWtBefore]       = useState('');
  const [wtAfter, setWtAfter]         = useState('');
  const [qtyMolded, setQtyMolded]     = useState('');
  const [startTime, setStartTime]     = useState('');
  const [endTime, setEndTime]         = useState('');
  const [operator, setOperator]       = useState('');
  const [remarks, setRemarks]         = useState('');

  useEffect(() => {
    listMoldingSessions().then(setAllSessions);
  }, []);

  const selectedJob = useMemo(() => jobs.find(j => j.id === jcId), [jobs, jcId]);

  // Stats for the selected JC
  const prevMolded = useMemo(
    () => allSessions.filter(s => s.job_card_id === jcId).reduce((a, s) => a + (s.qty_molded || 0), 0),
    [allSessions, jcId]
  );

  // Auto-prefill when JC is selected
  useEffect(() => {
    if (!jcId) { setPrefillSource(null); return; }
    const last = allSessions.find(s => s.job_card_id === jcId);
    if (last) {
      setPressNo(last.press_no || '');
      setDieNo(last.die_no || '');
      setTikliSize(last.tikli_size || '');
      setCureTime(last.cure_time_min ? String(last.cure_time_min) : '');
      setCureTemp(last.cure_temp_c  ? String(last.cure_temp_c)   : '');
      setSpray(last.spray || '');
      setPrefillSource('Last molding session');
    } else if (selectedJob) {
      // Fallback to product master fields on the job itself
      if (selectedJob.cure_time_min) setCureTime(String(selectedJob.cure_time_min));
      if (selectedJob.mould_code)    setDieNo(selectedJob.mould_code);
      if (selectedJob.press_id)      setPressNo(selectedJob.press_id);
      setPrefillSource('Job / product defaults');
    }
  }, [jcId, allSessions, selectedJob]);

  // Working time auto-calc
  const workingTimeMin = useMemo(() => {
    if (startTime && endTime) return calcWorkingMinutes(startTime, endTime);
    return null;
  }, [startTime, endTime]);

  const newTotal    = prevMolded + (parseInt(qtyMolded, 10) || 0);
  const plannedQty  = selectedJob?.qty || 0;
  const totalMet    = plannedQty > 0 && newTotal >= plannedQty;

  const save = async () => {
    if (!jcId || !qtyMolded || !pressNo || !operator) {
      alert('Required: Job Card, Qty Molded, Press No, Operator Name.');
      return;
    }
    setSaving(true);
    try {
      const id = nextMldId(allSessions.map(s => s.id));
      const row: MoldingSession = {
        id,
        job_card_id:      jcId,
        molding_date:     date,
        shift,
        operation_type:   opType,
        press_no:         pressNo.trim(),
        die_no:           dieNo.trim() || null,
        tikli_size:       tikliSize.trim() || null,
        cure_time_min:    cureTime    ? parseInt(cureTime, 10)    : null,
        cure_temp_c:      cureTemp    ? parseInt(cureTemp, 10)    : null,
        scorch_time_min:  scorchTime  ? parseInt(scorchTime, 10)  : null,
        die_change_min:   dieChangeMin ? parseInt(dieChangeMin, 10) : null,
        dori_khatam_min:  doriKhatam  ? parseInt(doriKhatam, 10)  : null,
        spray:            spray.trim() || null,
        weight_before_g:  wtBefore    ? parseFloat(wtBefore)      : null,
        weight_after_g:   wtAfter     ? parseFloat(wtAfter)       : null,
        qty_molded:       parseInt(qtyMolded, 10),
        planned_qty:      plannedQty || null,
        start_time:       startTime || null,
        end_time:         endTime || null,
        working_time_min: workingTimeMin,
        operator_name:    operator.trim(),
        remarks:          remarks.trim() || null,
        entered_by:       user?.email || null,
        order_id:         selectedJob?.order_id || null,
        our_desc:         selectedJob?.product_desc || null,
      };
      await insertMoldingSession(row);
      navigate('/production/log-molding?saved=1');
    } catch (e: any) {
      alert(e?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  // Eligible JCs — exclude fully dispatched
  const eligibleJobs = jobs.filter(j => j.stage !== 'dispatched');

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        module="Production · Log"
        title="Log Molding"
        subtitle="Module 06 — append-only. Each entry is permanent."
        actions={
          <button type="button" onClick={save} disabled={saving}
            className="inline-flex items-center gap-1.5 bg-[#0A6ED1] text-white text-[11px] font-medium px-[11px] py-[5px] rounded-[3px] hover:bg-[#085EA8] disabled:opacity-40 transition-colors">
            <Save size={13} /> {saving ? 'Saving…' : 'Save Entry'}
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-w-[860px]">

        {/* ── Section 1: Job Card & Date ── */}
        <Card title="Job Card & Date">
          <Grid3>
            <Field label="Job Card *">
              <select className={inp} value={jcId} onChange={e => setJcId(e.target.value)} title="Job card">
                <option value="">— Select Job Card —</option>
                {eligibleJobs.map(j => (
                  <option key={j.id} value={j.id}>{j.id} · {j.product_desc} · {j.customer_name}</option>
                ))}
              </select>
            </Field>
            <Field label="Molding Date">
              <input type="date" className={inp} value={date} onChange={e => setDate(e.target.value)} title="Date" />
            </Field>
            <Field label="Shift">
              <select className={inp} value={shift} onChange={e => setShift(e.target.value)} title="Shift">
                {SHIFTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Operation Type">
              <select className={inp} value={opType} onChange={e => setOpType(e.target.value)} title="Operation type">
                {OP_TYPES.map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
          </Grid3>
        </Card>

        {/* ── JC info banner (shows after selection) ── */}
        {selectedJob && (
          <div className="bg-[#E8F0FD] border border-[#C2D8F8] rounded-[3px] px-3 py-2.5 flex items-start gap-2">
            <Info size={14} className="text-[#0A6ED1] mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-[11px] text-[#0A6ED1]">
              <span className="font-bold">{selectedJob.id}</span>
              <span className="mx-1.5 text-[#0A6ED1]/60">·</span>
              {selectedJob.product_desc}
              <span className="mx-1.5 text-[#0A6ED1]/60">·</span>
              {selectedJob.customer_name}
              <span className="mx-1.5 text-[#0A6ED1]/60">·</span>
              Ordered: <strong>{selectedJob.qty} pcs</strong>
              <span className="mx-1.5 text-[#0A6ED1]/60">·</span>
              Previously molded: <strong>{prevMolded} pcs</strong>
              {prefillSource && (
                <span className="ml-3 bg-[#0A6ED1]/10 px-1.5 py-0.5 rounded text-[10px]">
                  Prefilled from: {prefillSource}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Section 2: Press & Die ── */}
        <Card title="Press & Die Details">
          <Grid3>
            <Field label="Press No *">
              <select className={inp} value={pressNo} onChange={e => setPressNo(e.target.value)} title="Press number">
                <option value="">— Select Press —</option>
                {presses.map(p => <option key={p.id} value={p.id}>{p.name} ({p.tonnage}T)</option>)}
                <option value="OTHER">Other</option>
              </select>
            </Field>
            <Field label="Die No (Mould Code)">
              <input className={inp} value={dieNo} onChange={e => setDieNo(e.target.value)} placeholder="M-018" title="Die number" />
            </Field>
            <Field label="Tikli Size">
              <input className={inp} value={tikliSize} onChange={e => setTikliSize(e.target.value)} placeholder="5.4*6 holes" title="Tikli size" />
            </Field>
            <Field label="Cure Time (min) *">
              <input type="number" className={inp} value={cureTime} onChange={e => setCureTime(e.target.value)} placeholder="18" title="Cure time" />
            </Field>
            <Field label="Cure Temp (°C)">
              <input type="number" className={inp} value={cureTemp} onChange={e => setCureTemp(e.target.value)} placeholder="165" title="Cure temp" />
            </Field>
            <Field label="Scorch Time (min)">
              <input type="number" className={inp} value={scorchTime} onChange={e => setScorchTime(e.target.value)} title="Scorch time" />
            </Field>
            <Field label="Die Change (min)">
              <input type="number" className={inp} value={dieChangeMin} onChange={e => setDieChangeMin(e.target.value)} title="Die change duration" />
            </Field>
            <Field label="Dori Khatam (min)">
              <input type="number" className={inp} value={doriKhatam} onChange={e => setDoriKhatam(e.target.value)} title="Dori khatam" />
            </Field>
            <Field label="Mould Release Spray">
              <input className={inp} value={spray} onChange={e => setSpray(e.target.value)} placeholder="e.g. WD-40" title="Spray" />
            </Field>
            <Field label="Weight Before (g)">
              <input type="number" step="0.01" className={inp} value={wtBefore} onChange={e => setWtBefore(e.target.value)} title="Weight before" />
            </Field>
            <Field label="Weight After (g)">
              <input type="number" step="0.01" className={inp} value={wtAfter} onChange={e => setWtAfter(e.target.value)} title="Weight after" />
            </Field>
          </Grid3>
        </Card>

        {/* ── Section 3: Qty & Operator ── */}
        <Card title="Quantity & Operator">
          <Grid3>
            <Field label="Qty Molded *">
              <input type="number" className={inp} value={qtyMolded} onChange={e => setQtyMolded(e.target.value)} placeholder="0" title="Qty molded" />
            </Field>
            <Field label="Planned Qty (readonly)">
              <input className={`${inp} bg-[#FAFAFA]`} readOnly value={plannedQty || ''} title="Planned qty" />
            </Field>
            <Field label="Start Time">
              <input type="time" className={inp} value={startTime} onChange={e => setStartTime(e.target.value)} title="Start time" />
            </Field>
            <Field label="End Time">
              <input type="time" className={inp} value={endTime} onChange={e => setEndTime(e.target.value)} title="End time" />
            </Field>
            <Field label="Working Time (auto)">
              <input className={`${inp} bg-[#FAFAFA]`} readOnly
                value={workingTimeMin != null ? `${workingTimeMin} min` : ''}
                title="Working time" />
            </Field>
            <Field label="Operator Name *">
              <input className={inp} value={operator} onChange={e => setOperator(e.target.value)} placeholder="Operator" title="Operator name" />
            </Field>
            <Field label="Remarks" className="col-span-3">
              <textarea className={`${inp} resize-none h-[60px]`} value={remarks} onChange={e => setRemarks(e.target.value)} title="Remarks" />
            </Field>
          </Grid3>

          {/* Running total widget */}
          {jcId && qtyMolded && (
            <div className={`mt-3 border rounded-[3px] px-3 py-2.5 text-[12px] flex items-center gap-3 ${totalMet ? 'bg-[#E8F5E9] border-[#C5E1A5]' : 'bg-[#E8F0FD] border-[#C2D8F8]'}`}>
              <span className="text-[#555]">Previously molded:</span>
              <strong>{prevMolded}</strong>
              <span className="text-[#555]">+ this entry:</span>
              <strong>{parseInt(qtyMolded, 10) || 0}</strong>
              <span className="text-[#555]">=</span>
              <strong className={totalMet ? 'text-[#107E3E]' : 'text-[#0A6ED1]'}>{newTotal}</strong>
              <span className="text-[#555]">/ {plannedQty} planned</span>
              {totalMet && <span className="ml-auto font-semibold text-[#107E3E]">✓ Planned qty met</span>}
            </div>
          )}
        </Card>

        {/* Append-only notice */}
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

function Grid3({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{children}</div>;
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#555] mb-1">{label}</label>
      {children}
    </div>
  );
}
