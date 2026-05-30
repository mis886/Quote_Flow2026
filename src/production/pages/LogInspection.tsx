// Module 08 — Log Inspection
// Append-only. Split validator blocks save if passed+rejected+rework+scrapped ≠ qtyToInspect.

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, CheckCircle2, XCircle } from 'lucide-react';
import { useProductionData } from '../lib/useProductionData';
import {
  listInspectionSessions, insertInspectionSession,
  listFinishingSessions,
} from '../lib/db';
import { nextInsId, validateInsSplit, calcWorkingMinutes } from '../lib/jcStats';
import { PageHeader } from '../components/table';
import type { InspectionSession, FinishingSession } from '../lib/types';
import { useAppStore } from '../../store';

const REJECTION_OPTIONS = ['Flash', 'Unfill', 'Blow', 'Dimension', 'Damage', 'Surface Defect', 'Other'];

export function LogInspection() {
  const navigate = useNavigate();
  const { jobs } = useProductionData();
  const { user } = useAppStore();

  const [allIns, setAllIns] = useState<InspectionSession[]>([]);
  const [allFin, setAllFin] = useState<FinishingSession[]>([]);
  const [saving, setSaving] = useState(false);

  // Form state
  const [jcId,          setJcId]          = useState('');
  const [date,          setDate]          = useState(new Date().toISOString().slice(0, 10));
  const [qtyToInspect,  setQtyToInspect]  = useState('');
  const [passed,        setPassed]        = useState('');
  const [rejected,      setRejected]      = useState('');
  const [rework,        setRework]        = useState('');
  const [scrapped,      setScrapped]      = useState('');
  const [inspector,     setInspector]     = useState('');
  const [startTime,     setStartTime]     = useState('');
  const [endTime,       setEndTime]       = useState('');
  const [rejReasons,    setRejReasons]    = useState('');
  const [remarks,       setRemarks]       = useState('');

  useEffect(() => {
    Promise.all([listInspectionSessions(), listFinishingSessions()])
      .then(([i, f]) => { setAllIns(i); setAllFin(f); });
  }, []);

  const selectedJob = useMemo(() => jobs.find(j => j.id === jcId), [jobs, jcId]);

  const prevPassed = useMemo(
    () => allIns.filter(i => i.job_card_id === jcId).reduce((a, i) => a + (i.passed || 0), 0),
    [allIns, jcId]
  );

  // Live split validation
  const split = useMemo(() => {
    const n = (v: string) => parseInt(v, 10) || 0;
    const qty = parseInt(qtyToInspect, 10);
    if (!qty || isNaN(qty)) return null;
    return validateInsSplit(qty, n(passed), n(rejected), n(rework), n(scrapped));
  }, [qtyToInspect, passed, rejected, rework, scrapped]);

  const workingHrs = useMemo(() => {
    if (!startTime || !endTime) return null;
    return +(calcWorkingMinutes(startTime, endTime) / 60).toFixed(2);
  }, [startTime, endTime]);

  // Eligible JCs: Finishing stage or already has finishing sessions
  const eligibleJobs = jobs.filter(j =>
    ['finishing', 'inspection', 'dispatch'].includes(j.stage)
    || allFin.some(f => f.job_card_id === j.id)
  );

  const yieldPct = useMemo(() => {
    const p = parseInt(passed, 10) || 0;
    const qty = parseInt(qtyToInspect, 10) || 0;
    if (!qty) return null;
    return Math.round((p / qty) * 100);
  }, [passed, qtyToInspect]);

  const save = async () => {
    if (!jcId || !qtyToInspect || !inspector) {
      alert('Required: Job Card, Qty to Inspect, Inspector Name.');
      return;
    }
    if (!split?.ok) {
      alert(`Split does not balance: ${split?.message}`);
      return;
    }
    setSaving(true);
    try {
      const n = (v: string) => parseInt(v, 10) || 0;
      const qty = parseInt(qtyToInspect, 10);
      const id  = nextInsId(allIns.map(i => i.id));
      const row: InspectionSession = {
        id,
        job_card_id:       jcId,
        inspection_date:   date,
        qty_to_inspect:    qty,
        qty_inspected:     qty,
        passed:            n(passed),
        rejected:          n(rejected),
        rework:            n(rework),
        scrapped:          n(scrapped),
        inspector_name:    inspector.trim(),
        start_time:        startTime || null,
        end_time:          endTime   || null,
        working_hours:     workingHrs,
        rejection_reasons: rejReasons.trim() || null,
        remarks:           remarks.trim() || null,
        entered_by:        user?.email || null,
        order_id:          selectedJob?.order_id || null,
      };
      await insertInspectionSession(row);
      navigate('/production/log-inspection?saved=1');
    } catch (e: any) {
      alert(e?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        module="Production · Log"
        title="Log Inspection"
        subtitle="Module 08 — append-only. Split must balance before saving."
        actions={
          <button type="button" onClick={save} disabled={saving || (split !== null && !split.ok)}
            className="inline-flex items-center gap-1.5 bg-[#0A6ED1] text-white text-[11px] font-medium px-[11px] py-[5px] rounded-[3px] hover:bg-[#085EA8] disabled:opacity-40 transition-colors">
            <Save size={13} /> {saving ? 'Saving…' : 'Save Entry'}
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-w-[720px]">
        <Card title="Inspection Entry">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Job Card *" className="md:col-span-2">
              <select className={inp} value={jcId} onChange={e => setJcId(e.target.value)} title="Job card">
                <option value="">— Select Job Card —</option>
                {eligibleJobs.map(j => (
                  <option key={j.id} value={j.id}>{j.id} · {j.product_desc}</option>
                ))}
              </select>
            </Field>

            {selectedJob && (
              <div className="md:col-span-2 bg-[#E8F0FD] border border-[#C2D8F8] rounded-[3px] px-3 py-2 text-[11px] text-[#0A6ED1]">
                <strong>{selectedJob.id}</strong> · {selectedJob.product_desc} · Ordered: <strong>{selectedJob.qty} pcs</strong> · Previously passed: <strong>{prevPassed} pcs</strong>
              </div>
            )}

            <Field label="Inspection Date">
              <input type="date" className={inp} value={date} onChange={e => setDate(e.target.value)} title="Date" />
            </Field>
            <Field label="Qty to Inspect *">
              <input type="number" className={inp} value={qtyToInspect} onChange={e => setQtyToInspect(e.target.value)} placeholder="0" title="Batch size" />
            </Field>
          </div>
        </Card>

        {/* Split card */}
        <Card title="Inspection Split — must total Qty to Inspect">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Passed ✓">
              <input type="number" className={`${inp} border-[#107E3E] focus:border-[#107E3E]`}
                value={passed} onChange={e => setPassed(e.target.value)} placeholder="0" title="Passed" />
            </Field>
            <Field label="Rejected ✕">
              <input type="number" className={`${inp} border-[#BB0000] focus:border-[#BB0000]`}
                value={rejected} onChange={e => setRejected(e.target.value)} placeholder="0" title="Rejected" />
            </Field>
            <Field label="Rework ↺">
              <input type="number" className={`${inp} border-[#E9730C] focus:border-[#E9730C]`}
                value={rework} onChange={e => setRework(e.target.value)} placeholder="0" title="Rework" />
            </Field>
            <Field label="Scrapped 🗑">
              <input type="number" className={`${inp} border-[#6A6D70] focus:border-[#6A6D70]`}
                value={scrapped} onChange={e => setScrapped(e.target.value)} placeholder="0" title="Scrapped" />
            </Field>
          </div>

          {/* Live split validator */}
          {split !== null && (
            <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-[3px] border text-[12px] font-semibold ${
              split.ok
                ? 'bg-[#E8F5E9] border-[#C5E1A5] text-[#107E3E]'
                : 'bg-[#FFEBEE] border-[#FFCDD2] text-[#BB0000]'
            }`}>
              {split.ok
                ? <CheckCircle2 size={14} />
                : <XCircle size={14} />}
              {split.message}
            </div>
          )}

          {/* Yield preview */}
          {yieldPct !== null && split?.ok && (
            <div className={`mt-2 text-[11px] font-medium px-3 py-1.5 rounded-[3px] inline-block ${
              yieldPct >= 90 ? 'bg-[#E8F5E9] text-[#107E3E]' :
              yieldPct >= 70 ? 'bg-[#FFF3E0] text-[#E9730C]' :
                               'bg-[#FFEBEE] text-[#BB0000]'
            }`}>
              Yield: {yieldPct}%
            </div>
          )}

          {/* Rework notice */}
          {(parseInt(rework, 10) || 0) > 0 && (
            <div className="mt-2 bg-[#FFF8EC] border border-[#FFE0B2] rounded-[3px] px-3 py-2 text-[11px] text-[#E9730C]">
              ⚠ {rework} pcs rework will auto-queue to Finishing (Module 07).
            </div>
          )}
        </Card>

        <Card title="Inspector & Time">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Inspector Name *">
              <input className={inp} value={inspector} onChange={e => setInspector(e.target.value)} placeholder="Inspector name" title="Inspector" />
            </Field>
            <Field label="Start Time">
              <input type="time" className={inp} value={startTime} onChange={e => setStartTime(e.target.value)} title="Start" />
            </Field>
            <Field label="End Time">
              <input type="time" className={inp} value={endTime} onChange={e => setEndTime(e.target.value)} title="End" />
            </Field>
            <Field label="Working Hours (auto)">
              <input className={`${inp} bg-[#FAFAFA]`} readOnly value={workingHrs != null ? `${workingHrs} hrs` : ''} title="Working hours" />
            </Field>
            <Field label="Rejection Reasons" className="md:col-span-2">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {REJECTION_OPTIONS.map(r => (
                  <button key={r} type="button"
                    onClick={() => setRejReasons(prev => prev ? `${prev}, ${r}` : r)}
                    className="text-[10px] px-2 py-0.5 border border-[#E4E5E6] rounded-full hover:bg-[#E8F0FD] hover:border-[#0A6ED1] hover:text-[#0A6ED1] transition-colors text-[#555]">
                    {r}
                  </button>
                ))}
              </div>
              <input className={inp} value={rejReasons} onChange={e => setRejReasons(e.target.value)}
                placeholder="Flash, Unfill, Blow…" title="Rejection reasons" />
            </Field>
            <Field label="Remarks" className="md:col-span-2">
              <textarea className={`${inp} resize-none h-[60px]`} value={remarks} onChange={e => setRemarks(e.target.value)} title="Remarks" />
            </Field>
          </div>
        </Card>

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
