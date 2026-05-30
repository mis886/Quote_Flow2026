// Module 07 — Log Finishing
// Append-only. Rework queue banner at top. isRework flag.

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, AlertTriangle, ArrowRight } from 'lucide-react';
import { useProductionData } from '../lib/useProductionData';
import {
  listFinishingSessions, insertFinishingSession,
  listInspectionSessions, listMoldingSessions,
} from '../lib/db';
import { nextFinId, getReworkQueue } from '../lib/jcStats';
import { PageHeader } from '../components/table';
import type { FinishingSession, InspectionSession, MoldingSession } from '../lib/types';
import { useAppStore } from '../../store';

export function LogFinishing() {
  const navigate  = useNavigate();
  const { jobs }  = useProductionData();
  const { user }  = useAppStore();

  const [allFin,  setAllFin]  = useState<FinishingSession[]>([]);
  const [allIns,  setAllIns]  = useState<InspectionSession[]>([]);
  const [allMld,  setAllMld]  = useState<MoldingSession[]>([]);
  const [saving,  setSaving]  = useState(false);

  // Form state
  const [jcId,          setJcId]          = useState('');
  const [date,          setDate]          = useState(new Date().toISOString().slice(0, 10));
  const [actualQty,     setActualQty]     = useState('');
  const [workingHours,  setWorkingHours]  = useState('');
  const [finisherName,  setFinisherName]  = useState('');
  const [isRework,      setIsRework]      = useState(false);
  const [remarks,       setRemarks]       = useState('');

  useEffect(() => {
    Promise.all([
      listFinishingSessions(),
      listInspectionSessions(),
      listMoldingSessions(),
    ]).then(([f, i, m]) => { setAllFin(f); setAllIns(i); setAllMld(m); });
  }, []);

  // Eligible JCs: Molding/Finishing/Inspection/Ready/Partially dispatched
  const eligibleJobs = jobs.filter(j =>
    ['moulding', 'finishing', 'inspection', 'dispatch', 'dispatched'].includes(j.stage)
    || allMld.some(m => m.job_card_id === j.id)
  );

  const selectedJob = useMemo(() => jobs.find(j => j.id === jcId), [jobs, jcId]);

  const prevFinished = useMemo(
    () => allFin.filter(f => f.job_card_id === jcId).reduce((a, f) => a + (f.actual_qty || 0), 0),
    [allFin, jcId]
  );

  // Rework queue
  const reworkQueue = useMemo(
    () => getReworkQueue(allIns, allFin, jobs),
    [allIns, allFin, jobs]
  );

  const fillRework = (task: ReturnType<typeof getReworkQueue>[0]) => {
    setJcId(task.jcId);
    setActualQty(String(task.qty));
    setIsRework(true);
  };

  const save = async () => {
    if (!jcId || !actualQty || !finisherName) {
      alert('Required: Job Card, Qty Finished, Finisher Name.');
      return;
    }
    setSaving(true);
    try {
      const id = nextFinId(allFin.map(f => f.id));
      const row: FinishingSession = {
        id,
        job_card_id:   jcId,
        finishing_date: date,
        actual_qty:    parseInt(actualQty, 10),
        planned_qty:   selectedJob?.qty || null,
        working_hours: workingHours ? parseFloat(workingHours) : null,
        finisher_name: finisherName.trim(),
        is_rework:     isRework,
        remarks:       remarks.trim() || null,
        entered_by:    user?.email || null,
        order_id:      selectedJob?.order_id || null,
      };
      await insertFinishingSession(row);
      navigate('/production/log-finishing?saved=1');
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
        title="Log Finishing"
        subtitle="Module 07 — append-only. Each entry is permanent."
        actions={
          <button type="button" onClick={save} disabled={saving}
            className="inline-flex items-center gap-1.5 bg-[#0A6ED1] text-white text-[11px] font-medium px-[11px] py-[5px] rounded-[3px] hover:bg-[#085EA8] disabled:opacity-40 transition-colors">
            <Save size={13} /> {saving ? 'Saving…' : 'Save Entry'}
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-w-[720px]">

        {/* Rework queue banner */}
        {reworkQueue.length > 0 && (
          <div className="bg-[#FFF8EC] border border-[#FFE0B2] rounded-[3px] overflow-hidden">
            <div className="px-3 py-2 flex items-center gap-2 border-b border-[#FFE0B2]">
              <AlertTriangle size={13} className="text-[#E9730C]" />
              <span className="text-[11.5px] font-semibold text-[#E9730C]">Rework Queue — {reworkQueue.length} item{reworkQueue.length > 1 ? 's' : ''} need re-finishing</span>
            </div>
            <div className="divide-y divide-[#FFE0B2]">
              {reworkQueue.map(task => (
                <div key={task.inspId} className="px-3 py-2 flex items-center gap-3">
                  <div className="flex-1">
                    <span className="text-[11.5px] font-semibold text-[#111]">{task.jcId}</span>
                    {task.productDesc && <span className="text-[11px] text-[#555] ml-1.5">· {task.productDesc}</span>}
                    <span className="text-[11px] text-[#E9730C] ml-1.5">· Rework from {task.inspId} · <strong>{task.qty} pcs</strong> need re-finishing</span>
                  </div>
                  <button type="button" onClick={() => fillRework(task)}
                    className="inline-flex items-center gap-1 text-[10.5px] bg-[#E9730C] text-white px-2 py-1 rounded-[3px] hover:bg-[#BF5D08] transition-colors">
                    <ArrowRight size={10} /> Fill
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main form */}
        <Card title="Finishing Entry">
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
                <strong>{selectedJob.id}</strong> · {selectedJob.product_desc} · {selectedJob.customer_name}
                · Ordered: <strong>{selectedJob.qty} pcs</strong>
                · Previously finished: <strong>{prevFinished} pcs</strong>
              </div>
            )}

            <Field label="Finishing Date">
              <input type="date" className={inp} value={date} onChange={e => setDate(e.target.value)} title="Date" />
            </Field>
            <Field label="Actual Qty Finished *">
              <input type="number" className={inp} value={actualQty} onChange={e => setActualQty(e.target.value)} placeholder="0" title="Actual qty" />
            </Field>
            <Field label="Working Hours">
              <input type="number" step="0.25" className={inp} value={workingHours} onChange={e => setWorkingHours(e.target.value)} placeholder="2.5" title="Working hours" />
            </Field>
            <Field label="Finisher Name *">
              <input className={inp} value={finisherName} onChange={e => setFinisherName(e.target.value)} placeholder="Finisher name" title="Finisher name" />
            </Field>
            <Field label="Is Rework?" className="md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
                <input type="checkbox" checked={isRework} onChange={e => setIsRework(e.target.checked)} className="w-3.5 h-3.5 accent-[#E9730C]" />
                <span className="text-[12px] text-[#333]">This entry is a rework session</span>
              </label>
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
