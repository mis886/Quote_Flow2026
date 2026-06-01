// Module 08 — Log Inspection
// Append-only. Multi-inspector rows with split validator per row. Log panel on right.

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, CheckCircle2, XCircle, Plus, Trash2 } from 'lucide-react';
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

interface InspectorRow {
  id: number;
  inspector: string;
  qtyToInspect: string;
  passed: string;
  rejected: string;
  rework: string;
  scrapped: string;
  startTime: string;
  endTime: string;
  rejReasons: string;
}

let _rowId = 0;
const newRow = (): InspectorRow => ({
  id: ++_rowId,
  inspector: '',
  qtyToInspect: '',
  passed: '',
  rejected: '',
  rework: '',
  scrapped: '',
  startTime: '',
  endTime: '',
  rejReasons: '',
});

export function LogInspection() {
  const navigate = useNavigate();
  const { jobs } = useProductionData();
  const { user } = useAppStore();

  const [allIns, setAllIns] = useState<InspectionSession[]>([]);
  const [allFin, setAllFin] = useState<FinishingSession[]>([]);
  const [saving, setSaving] = useState(false);

  const [jcId,    setJcId]    = useState('');
  const [date,    setDate]    = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState('');

  // Multi-inspector rows
  const [insRows, setInsRows] = useState<InspectorRow[]>([newRow()]);

  useEffect(() => {
    Promise.all([listInspectionSessions(), listFinishingSessions()])
      .then(([i, f]) => { setAllIns(i); setAllFin(f); });
  }, []);

  const selectedJob = useMemo(() => jobs.find(j => j.id === jcId), [jobs, jcId]);

  const prevPassed = useMemo(
    () => allIns.filter(i => i.job_card_id === jcId).reduce((a, i) => a + (i.passed || 0), 0),
    [allIns, jcId]
  );

  // Sessions for selected JC (log panel), newest first
  const jcSessions = useMemo(
    () => allIns.filter(i => i.job_card_id === jcId)
           .sort((a, b) => (b.inspection_date || '').localeCompare(a.inspection_date || '') || (b.id || '').localeCompare(a.id || '')),
    [allIns, jcId]
  );

  const eligibleJobs = jobs.filter(j =>
    ['finishing', 'inspection', 'dispatch'].includes(j.stage)
    || allFin.some(f => f.job_card_id === j.id)
  );

  const updateRow = (id: number, field: keyof InspectorRow, value: string) => {
    setInsRows(rows => rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };
  const addRow    = () => setInsRows(rows => [...rows, newRow()]);
  const removeRow = (id: number) => setInsRows(rows => rows.length > 1 ? rows.filter(r => r.id !== id) : rows);

  const appendReason = (rowId: number, reason: string) => {
    setInsRows(rows => rows.map(r => {
      if (r.id !== rowId) return r;
      const prev = r.rejReasons.trim();
      return { ...r, rejReasons: prev ? `${prev}, ${reason}` : reason };
    }));
  };

  // Validate each row
  const rowValidations = useMemo(() => {
    const n = (v: string) => parseInt(v, 10) || 0;
    return insRows.map(row => {
      const qty = parseInt(row.qtyToInspect, 10);
      if (!qty || isNaN(qty)) return null;
      return validateInsSplit(qty, n(row.passed), n(row.rejected), n(row.rework), n(row.scrapped));
    });
  }, [insRows]);

  const allRowsOk = insRows.every((r, i) => {
    if (!r.inspector.trim() || !r.qtyToInspect) return false;
    return rowValidations[i]?.ok === true;
  });

  const save = async () => {
    if (!jcId) { alert('Select a Job Card.'); return; }
    const validRows = insRows.filter(r => r.inspector.trim() && r.qtyToInspect);
    if (validRows.length === 0) {
      alert('Add at least one inspector row with Qty and Inspector Name.');
      return;
    }
    const badRow = validRows.find((r, i) => {
      const idx = insRows.indexOf(r);
      return rowValidations[idx]?.ok === false;
    });
    if (badRow) {
      alert('One or more inspection splits do not balance. Fix before saving.');
      return;
    }
    setSaving(true);
    try {
      const n = (v: string) => parseInt(v, 10) || 0;
      const existingIds = allIns.map(i => i.id);
      for (const row of validRows) {
        const id  = nextInsId(existingIds);
        existingIds.push(id);
        const qty = parseInt(row.qtyToInspect, 10);
        const workingHrs = (row.startTime && row.endTime)
          ? +(calcWorkingMinutes(row.startTime, row.endTime) / 60).toFixed(2)
          : null;
        const record: InspectionSession = {
          id,
          job_card_id:       jcId,
          inspection_date:   date,
          qty_to_inspect:    qty,
          qty_inspected:     qty,
          passed:            n(row.passed),
          rejected:          n(row.rejected),
          rework:            n(row.rework),
          scrapped:          n(row.scrapped),
          inspector_name:    row.inspector.trim(),
          start_time:        row.startTime || null,
          end_time:          row.endTime   || null,
          working_hours:     workingHrs,
          rejection_reasons: row.rejReasons.trim() || null,
          remarks:           remarks.trim() || null,
          entered_by:        user?.email || null,
          order_id:          selectedJob?.order_id || null,
        };
        await insertInspectionSession(record);
      }
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
          <button type="button" onClick={save} disabled={saving || (insRows.some(r => r.qtyToInspect) && !allRowsOk)}
            className="inline-flex items-center gap-1.5 bg-[#0A6ED1] text-white text-[11px] font-medium px-[11px] py-[5px] rounded-[3px] hover:bg-[#085EA8] disabled:opacity-40 transition-colors">
            <Save size={13} /> {saving ? 'Saving…' : 'Save Entry'}
          </button>
        }
      />

      {/* Two-panel layout */}
      <div className="flex-1 overflow-hidden flex gap-3 p-4">

        {/* LEFT — form */}
        <div className="flex-1 overflow-y-auto space-y-3 min-w-0">

          {/* Job Card + Date */}
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
              <Field label="Shared Remarks">
                <input className={inp} value={remarks} onChange={e => setRemarks(e.target.value)}
                  placeholder="Remarks for all rows" title="Remarks" />
              </Field>
            </div>
          </Card>

          {/* Multi-inspector rows */}
          <Card
            title="Inspectors & Split"
            action={
              <button type="button" onClick={addRow}
                className="inline-flex items-center gap-1 text-[10.5px] bg-[#E8F0FD] text-[#0A6ED1] border border-[#C2D8F8] px-2 py-0.5 rounded-[3px] hover:bg-[#C2D8F8] transition-colors">
                <Plus size={10} /> Add Inspector
              </button>
            }
          >
            <div className="space-y-4">
              {insRows.map((row, idx) => {
                const validation = rowValidations[idx];
                const n = (v: string) => parseInt(v, 10) || 0;
                const yieldPct = (validation?.ok && n(row.qtyToInspect))
                  ? Math.round((n(row.passed) / n(row.qtyToInspect)) * 100)
                  : null;
                const workingHrs = (row.startTime && row.endTime)
                  ? +(calcWorkingMinutes(row.startTime, row.endTime) / 60).toFixed(2)
                  : null;

                return (
                  <div key={row.id} className="border border-[#E4E5E6] rounded-[3px] overflow-hidden">
                    {/* Row header */}
                    <div className="bg-[#FAFAFA] px-3 py-1.5 border-b border-[#E4E5E6] flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-[#555] uppercase tracking-wider flex-1">
                        Inspector {idx + 1}
                      </span>
                      {insRows.length > 1 && (
                        <button type="button" onClick={() => removeRow(row.id)}
                          className="flex items-center gap-1 text-[10px] text-[#BB0000] hover:bg-[#FFEBEE] px-1.5 py-0.5 rounded-[3px] transition-colors">
                          <Trash2 size={10} /> Remove
                        </button>
                      )}
                    </div>

                    <div className="p-3 space-y-3">
                      {/* Inspector + time */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Field label="Inspector Name *" className="md:col-span-2">
                          <input className={inp} value={row.inspector}
                            onChange={e => updateRow(row.id, 'inspector', e.target.value)}
                            placeholder="Inspector name" title="Inspector name" />
                        </Field>
                        <Field label="Qty to Inspect *">
                          <input type="number" className={inp} value={row.qtyToInspect}
                            onChange={e => updateRow(row.id, 'qtyToInspect', e.target.value)}
                            placeholder="0" title="Batch size" />
                        </Field>
                        <div className="text-[10px] text-[#555]">
                          <div className="font-semibold uppercase tracking-wider mb-1">Working Hrs</div>
                          <div className="h-[30px] flex items-center text-[12px] text-[#333] font-medium">
                            {workingHrs !== null ? `${workingHrs} hrs` : '—'}
                          </div>
                        </div>
                      </div>

                      {/* Split */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Field label="Passed ✓">
                          <input type="number" className={`${inp} border-[#107E3E] focus:border-[#107E3E]`}
                            value={row.passed} onChange={e => updateRow(row.id, 'passed', e.target.value)}
                            placeholder="0" title="Passed" />
                        </Field>
                        <Field label="Rejected ✕">
                          <input type="number" className={`${inp} border-[#BB0000] focus:border-[#BB0000]`}
                            value={row.rejected} onChange={e => updateRow(row.id, 'rejected', e.target.value)}
                            placeholder="0" title="Rejected" />
                        </Field>
                        <Field label="Rework ↺">
                          <input type="number" className={`${inp} border-[#E9730C] focus:border-[#E9730C]`}
                            value={row.rework} onChange={e => updateRow(row.id, 'rework', e.target.value)}
                            placeholder="0" title="Rework" />
                        </Field>
                        <Field label="Scrapped 🗑">
                          <input type="number" className={`${inp} border-[#6A6D70] focus:border-[#6A6D70]`}
                            value={row.scrapped} onChange={e => updateRow(row.id, 'scrapped', e.target.value)}
                            placeholder="0" title="Scrapped" />
                        </Field>
                      </div>

                      {/* Time */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Field label="Start Time">
                          <input type="time" className={inp} value={row.startTime}
                            onChange={e => updateRow(row.id, 'startTime', e.target.value)} title="Start" />
                        </Field>
                        <Field label="End Time">
                          <input type="time" className={inp} value={row.endTime}
                            onChange={e => updateRow(row.id, 'endTime', e.target.value)} title="End" />
                        </Field>
                        <Field label="Rejection Reasons" className="md:col-span-2">
                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {REJECTION_OPTIONS.map(r => (
                              <button key={r} type="button"
                                onClick={() => appendReason(row.id, r)}
                                className="text-[9.5px] px-1.5 py-0.5 border border-[#E4E5E6] rounded-full hover:bg-[#E8F0FD] hover:border-[#0A6ED1] hover:text-[#0A6ED1] transition-colors text-[#555]">
                                {r}
                              </button>
                            ))}
                          </div>
                          <input className={inp} value={row.rejReasons}
                            onChange={e => updateRow(row.id, 'rejReasons', e.target.value)}
                            placeholder="Flash, Unfill…" title="Rejection reasons" />
                        </Field>
                      </div>

                      {/* Split validator */}
                      {validation !== null && (
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-[3px] border text-[12px] font-semibold ${
                          validation.ok
                            ? 'bg-[#E8F5E9] border-[#C5E1A5] text-[#107E3E]'
                            : 'bg-[#FFEBEE] border-[#FFCDD2] text-[#BB0000]'
                        }`}>
                          {validation.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                          {validation.message}
                          {yieldPct !== null && (
                            <span className={`ml-3 text-[11px] font-medium px-2 py-0.5 rounded-[3px] ${
                              yieldPct >= 90 ? 'bg-[#E8F5E9] text-[#107E3E]' :
                              yieldPct >= 70 ? 'bg-[#FFF3E0] text-[#E9730C]' :
                                               'bg-[#FFEBEE] text-[#BB0000]'
                            }`}>
                              Yield: {yieldPct}%
                            </span>
                          )}
                        </div>
                      )}

                      {(parseInt(row.rework, 10) || 0) > 0 && (
                        <div className="bg-[#FFF8EC] border border-[#FFE0B2] rounded-[3px] px-3 py-1.5 text-[11px] text-[#E9730C]">
                          ⚠ {row.rework} pcs rework will auto-queue to Finishing (Module 07).
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="text-[10.5px] text-[#555] border-t border-[#E4E5E6] pt-2">
            Entry is permanent · Corrections require a new entry
          </div>
        </div>

        {/* RIGHT — inspection log for selected JC */}
        <div className="w-[300px] flex-shrink-0 flex flex-col gap-2 overflow-y-auto">
          <div className="bg-white border border-[#E4E5E6] rounded-[3px] flex-1 min-h-0 flex flex-col">
            <div className="px-3 py-2 border-b border-[#E4E5E6] text-[11px] font-semibold text-[#333] uppercase tracking-wider flex items-center gap-2">
              Inspection Log
              {jcId && (
                <span className="font-normal normal-case text-[10.5px] text-[#555]">
                  — {jcSessions.length} entries · {prevPassed} passed
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {!jcId ? (
                <div className="p-4 text-[11px] text-[#888] text-center">
                  Select a Job Card to see inspection history
                </div>
              ) : jcSessions.length === 0 ? (
                <div className="p-4 text-[11px] text-[#888] text-center">
                  No inspection entries yet
                </div>
              ) : (
                <div className="divide-y divide-[#F0F0F0]">
                  {jcSessions.map(s => {
                    const yPct = s.qty_to_inspect
                      ? Math.round(((s.passed || 0) / s.qty_to_inspect) * 100)
                      : null;
                    return (
                      <div key={s.id} className="px-3 py-2.5 hover:bg-[#FAFAFA]">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono text-[10px] text-[#0A6ED1] font-bold">{s.id}</span>
                            <span className="ml-2 text-[10px] text-[#555]">{s.inspection_date}</span>
                          </div>
                          {yPct !== null && (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                              yPct >= 90 ? 'bg-[#E8F5E9] text-[#107E3E]' :
                              yPct >= 70 ? 'bg-[#FFF3E0] text-[#E9730C]' :
                                           'bg-[#FFEBEE] text-[#BB0000]'
                            }`}>
                              {yPct}%
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-[10px] text-[#555]">
                          <span>Inspector: <strong className="text-[#333]">{s.inspector_name || '—'}</strong></span>
                          <span className="ml-2">Batch: {s.qty_to_inspect}</span>
                        </div>
                        <div className="mt-0.5 text-[9.5px] text-[#555] flex gap-2 flex-wrap">
                          <span className="text-[#107E3E]">✓ {s.passed ?? 0}</span>
                          <span className="text-[#BB0000]">✕ {s.rejected ?? 0}</span>
                          {(s.rework ?? 0) > 0 && <span className="text-[#E9730C]">↺ {s.rework}</span>}
                          {(s.scrapped ?? 0) > 0 && <span className="text-[#6A6D70]">🗑 {s.scrapped}</span>}
                        </div>
                        {s.rejection_reasons && (
                          <div className="mt-0.5 text-[9.5px] text-[#666] italic truncate">{s.rejection_reasons}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

const inp = 'w-full font-sans text-[12px] text-[#111] bg-white border border-[#E4E5E6] rounded-[3px] px-2.5 py-1.5 outline-none focus:border-[#0A6ED1]';

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#E4E5E6] rounded-[3px]">
      <div className="px-3 py-2 border-b border-[#E4E5E6] text-[11px] font-semibold text-[#333] uppercase tracking-wider flex items-center gap-2">
        <span className="flex-1">{title}</span>
        {action}
      </div>
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
