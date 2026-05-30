// Shop Floor Settings — attendance register (v2 style) + shift config + press status.
// Add / edit / remove workers; toggle present/absent with live OTD impact.

import { useEffect, useState } from 'react';
import { Save, Users, Wrench, Factory, Plus, Trash2, X, Check } from 'lucide-react';
import { useProductionData } from '../lib/useProductionData';
import {
  updateShopFloorSettings, setWorkerPresent,
  updatePress, insertWorker, updateWorker, deleteWorker,
} from '../lib/db';
import { PageHeader } from '../components/table';
import { fmtIST } from '../../lib/utils';
import type { ShopFloorSettings, Worker } from '../lib/types';

const ROLES_FINISHING  = ['Senior Finisher', 'Finisher', 'Trainee Finisher'];
const ROLES_INSPECTION = ['Sr. Inspector', 'Inspector', 'Trainee Inspector'];

export function ShopFloorSettingsPage() {
  const { settings, workers, presses, refresh, loading } = useProductionData();
  const [draft, setDraft]           = useState<ShopFloorSettings | null>(null);
  const [saving, setSaving]         = useState(false);
  const [busyWorker, setBusyWorker] = useState<string | null>(null);
  const [workerModal, setWorkerModal] = useState<'add-finishing' | 'add-inspection' | { edit: Worker } | null>(null);
  const [delConfirm, setDelConfirm] = useState<Worker | null>(null);

  useEffect(() => { if (settings) setDraft(settings); }, [settings]);

  const saveSettings = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await updateShopFloorSettings({
        shift_started:      draft.shift_started,
        shift_hours:        draft.shift_hours,
        shift_hours_left:   draft.shift_hours_left,
        overtime_max:       draft.overtime_max,
        planned_finishers:  draft.planned_finishers,
        planned_inspectors: draft.planned_inspectors,
        emergency_active:   draft.emergency_active,
      });
      await refresh();
    } finally { setSaving(false); }
  };

  const togglePresent = async (id: string, present: boolean) => {
    setBusyWorker(id);
    try { await setWorkerPresent(id, present); await refresh(); }
    finally { setBusyWorker(null); }
  };

  const togglePressMaintenance = async (id: string, on: boolean) => {
    await updatePress(id, { status: on ? 'maintenance' : 'idle' });
    await refresh();
  };

  const presentF = workers.filter(w => w.department === 'finishing'  && w.present).length;
  const presentI = workers.filter(w => w.department === 'inspection' && w.present).length;
  const today    = fmtIST(new Date(), 'dd MMM yyyy');

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        module="Production · Settings"
        title="Shop Floor"
        accent="Configuration"
        subtitle="Workforce attendance, shift defaults, press status."
        actions={
          <button
            type="button"
            onClick={saveSettings}
            disabled={saving || !draft}
            className="inline-flex items-center gap-1.5 bg-[#0A6ED1] text-white text-[11px] font-medium px-[11px] py-[5px] rounded-[3px] hover:bg-[#085EA8] disabled:opacity-40 transition-colors"
          >
            <Save size={13} /> {saving ? 'Saving…' : 'Save Settings'}
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ── Attendance Register ─────────────────────────────────── */}
        <section>
          <div className="bg-white border border-[#E4E5E6] rounded-[3px] overflow-hidden">
            {/* Header */}
            <div className="px-3 py-2 border-b border-[#E4E5E6] flex items-center gap-2">
              <Users size={14} className="text-[#333]" />
              <div className="text-[12px] font-semibold text-[#111] flex-1">
                Attendance Register — {today} · Day Shift
              </div>
              <div className="text-[10px] text-[#555]">
                Tick/untick each worker → OTD projections update instantly
              </div>
            </div>

            {/* Two-column roster */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#F3F3F3]">
              {(['finishing', 'inspection'] as const).map(dept => {
                const deptWorkers = workers.filter(w => w.department === dept);
                const here = deptWorkers.filter(w => w.present).length;
                const out  = deptWorkers.length - here;
                const emoji = dept === 'finishing' ? '✂' : '🔍';
                const label = dept === 'finishing' ? 'FINISHING' : 'INSPECTION';
                const addKey = dept === 'finishing' ? 'add-finishing' : 'add-inspection';
                return (
                  <div key={dept}>
                    {/* Dept header */}
                    <div className="px-3 py-2 bg-[#FAFAFA] border-b border-[#F3F3F3] flex items-center gap-2">
                      <span className="text-[11px] font-bold text-[#0A6ED1]">{emoji} {label}</span>
                      <span className="text-[10px] text-[#555]">
                        {here} present · {out} absent of {deptWorkers.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => setWorkerModal(addKey as 'add-finishing' | 'add-inspection')}
                        className="ml-auto inline-flex items-center gap-1 text-[10px] text-[#0A6ED1] border border-[#0A6ED1] rounded-[3px] px-2 py-0.5 hover:bg-[#E8F0FD] transition-colors"
                      >
                        <Plus size={10} /> Add
                      </button>
                    </div>

                    {/* Worker rows */}
                    <div>
                      {deptWorkers.length === 0 && (
                        <div className="px-3 py-4 text-center text-[11px] text-[#555] italic">No workers added yet.</div>
                      )}
                      {deptWorkers.map(w => (
                        <div
                          key={w.id}
                          className={`flex items-center gap-3 px-3 py-2 border-b border-[#F3F3F3] last:border-b-0 ${
                            w.present ? 'bg-[#F1F8E9]' : 'bg-[#FFF5F5]'
                          }`}
                        >
                          {/* Status dot */}
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${w.present ? 'bg-[#107E3E]' : 'bg-[#BB0000]'}`} />

                          {/* Name + role */}
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-semibold text-[#111] truncate">{w.name}</div>
                            <div className="text-[10px] text-[#555]">{w.role}</div>
                          </div>

                          {/* Present/Absent toggle */}
                          <label className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={w.present}
                              disabled={busyWorker === w.id || loading}
                              onChange={() => togglePresent(w.id, !w.present)}
                              className="w-3.5 h-3.5 accent-[#107E3E] cursor-pointer disabled:opacity-50"
                            />
                            <span className={`text-[11px] font-medium ${w.present ? 'text-[#107E3E]' : 'text-[#BB0000]'}`}>
                              {w.present ? 'Present' : 'Absent'}
                            </span>
                          </label>

                          {/* Edit / Delete */}
                          <button
                            type="button"
                            onClick={() => setWorkerModal({ edit: w })}
                            className="text-[10px] text-[#555] hover:text-[#0A6ED1] px-1"
                            title="Edit worker"
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            onClick={() => setDelConfirm(w)}
                            className="text-[10px] text-[#555] hover:text-[#BB0000] px-1"
                            title="Remove worker"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom config strip */}
            <div className="px-3 py-2.5 border-t border-[#E4E5E6] bg-[#FAFAFA] flex flex-wrap items-center gap-3 text-[12px]">
              <span className="bg-[#E8F0FD] text-[#0A6ED1] text-[11px] font-medium px-2.5 py-1 rounded-[3px]">
                <strong>{presentF}</strong> finishers on floor
              </span>
              <span className="bg-[#FFF8EC] text-[#E9730C] text-[11px] font-medium px-2.5 py-1 rounded-[3px]">
                <strong>{presentI}</strong> inspectors on floor
              </span>
              {draft && (
                <>
                  <span className="flex items-center gap-1.5 bg-[#F7F7F7] border border-[#E4E5E6] rounded-[3px] px-2 py-1 text-[11px] text-[#333]">
                    Shift hrs left:
                    <input
                      type="number" step="0.5" min="0" max="12"
                      value={draft.shift_hours_left}
                      onChange={e => setDraft({ ...draft, shift_hours_left: parseFloat(e.target.value) || 0 })}
                      className="w-[46px] font-mono text-[11px] text-[#111] border border-[#E4E5E6] rounded-[2px] px-1 py-0.5 outline-none focus:border-[#0A6ED1] text-center bg-white"
                      title="Shift hours left"
                    />
                    hrs
                  </span>
                  <span className="flex items-center gap-1.5 bg-[#F7F7F7] border border-[#E4E5E6] rounded-[3px] px-2 py-1 text-[11px] text-[#333]">
                    OT authorised:
                    <input
                      type="number" step="0.5" min="0" max="4"
                      value={draft.overtime_max}
                      onChange={e => setDraft({ ...draft, overtime_max: parseFloat(e.target.value) || 0 })}
                      className="w-[46px] font-mono text-[11px] text-[#111] border border-[#E4E5E6] rounded-[2px] px-1 py-0.5 outline-none focus:border-[#0A6ED1] text-center bg-white"
                      title="OT authorised"
                    />
                    hrs
                  </span>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ── Shift & LSD defaults ────────────────────────────────── */}
        <section>
          <SectionTitle icon={<Wrench size={11} />} title="Shift & LSD defaults" />
          {!draft ? <Loading /> : (
            <div className="bg-white border border-[#E4E5E6] rounded-[3px] p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Shift Started">
                <select
                  className={inp}
                  value={draft.shift_started ? 'yes' : 'no'}
                  onChange={e => setDraft({ ...draft, shift_started: e.target.value === 'yes' })}
                  title="Shift started flag"
                >
                  <option value="no">No — pre-shift</option>
                  <option value="yes">Yes — running</option>
                </select>
              </Field>
              <Field label="Shift Hours (total)">
                <input type="number" className={inp} min={1} max={24}
                  value={draft.shift_hours}
                  onChange={e => setDraft({ ...draft, shift_hours: Number(e.target.value) || 0 })}
                  title="Total shift hours" />
              </Field>
              <Field label="OT Budget (hrs)">
                <input type="number" className={inp} min={0} max={8}
                  value={draft.overtime_max}
                  onChange={e => setDraft({ ...draft, overtime_max: Number(e.target.value) || 0 })}
                  title="OT budget hours" />
              </Field>
              <Field label="Planned Finishers (LSD calc)">
                <input type="number" className={inp} min={1}
                  value={draft.planned_finishers}
                  onChange={e => setDraft({ ...draft, planned_finishers: Number(e.target.value) || 0 })}
                  title="Planned finishers" />
              </Field>
              <Field label="Planned Inspectors (LSD calc)">
                <input type="number" className={inp} min={1}
                  value={draft.planned_inspectors}
                  onChange={e => setDraft({ ...draft, planned_inspectors: Number(e.target.value) || 0 })}
                  title="Planned inspectors" />
              </Field>
            </div>
          )}
        </section>

        {/* ── Press master ────────────────────────────────────────── */}
        <section>
          <SectionTitle icon={<Factory size={11} />} title="Press master" />
          <div className="bg-white border border-[#E4E5E6] rounded-[3px] divide-y divide-[#F3F3F3]">
            {presses.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  p.status === 'running'     ? 'bg-[#107E3E]' :
                  p.status === 'setup'       ? 'bg-[#E9730C]' :
                  p.status === 'maintenance' ? 'bg-[#BB0000]' : 'bg-[#C0C0C0]'
                }`} />
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-[#111]">{p.name} · {p.tonnage}T</div>
                  <div className="text-[10.5px] text-[#555]">
                    {p.status === 'idle'        ? 'Idle — available' :
                     p.status === 'maintenance' ? 'Under maintenance' :
                     `Active job: ${p.active_job_id || '—'} · ${p.pct_done || 0}%`}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={p.status === 'running' || p.status === 'setup'}
                  onClick={() => togglePressMaintenance(p.id, p.status !== 'maintenance')}
                  className={`px-2.5 py-1 text-[11px] rounded-[3px] border transition-colors disabled:opacity-30 ${
                    p.status === 'maintenance'
                      ? 'bg-[#FFF3E0] border-[#E9730C]/30 text-[#E9730C] hover:bg-[#FFE0B2]/60'
                      : 'bg-white border-[#CCC] text-[#555] hover:bg-[#FAFAFA]'
                  }`}
                  title={p.status === 'running' || p.status === 'setup' ? 'Press is busy — finish first' : ''}
                >
                  {p.status === 'maintenance' ? 'Bring Online' : 'Mark Maintenance'}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Add / Edit Worker Modal ──────────────────────────────── */}
      {workerModal !== null && (
        <WorkerModal
          mode={workerModal}
          workers={workers}
          onClose={() => setWorkerModal(null)}
          onSaved={async () => { await refresh(); setWorkerModal(null); }}
        />
      )}

      {/* ── Delete confirmation ──────────────────────────────────── */}
      {delConfirm && (
        <div className="fixed inset-0 bg-black/40 z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-[4px] w-full max-w-[360px] shadow-xl">
            <div className="px-4 py-3 border-b border-[#E4E5E6] flex items-center justify-between">
              <div className="text-[13px] font-semibold text-[#111]">Remove Worker</div>
              <button type="button" title="Close" aria-label="Close" onClick={() => setDelConfirm(null)} className="text-[#555] hover:text-[#111]"><X size={16} /></button>
            </div>
            <div className="px-4 py-4 text-[12px] text-[#333]">
              Remove <strong className="text-[#111]">{delConfirm.name}</strong> ({delConfirm.role}) from the roster?
              This cannot be undone.
            </div>
            <div className="px-4 py-3 border-t border-[#E4E5E6] flex justify-end gap-2">
              <button type="button" onClick={() => setDelConfirm(null)}
                className="px-[11px] py-[5px] text-[11px] font-medium border border-[#E4E5E6] rounded-[3px] text-[#333] bg-white hover:bg-[#F5F6F7]">
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await deleteWorker(delConfirm.id);
                  await refresh();
                  setDelConfirm(null);
                }}
                className="px-[11px] py-[5px] text-[11px] font-medium bg-[#BB0000] text-white rounded-[3px] hover:bg-[#8E0000]"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Worker Add/Edit Modal ───────────────────────────────────────────────────

function WorkerModal({
  mode, workers, onClose, onSaved,
}: {
  mode: 'add-finishing' | 'add-inspection' | { edit: Worker };
  workers: Worker[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const isEdit   = typeof mode === 'object' && 'edit' in mode;
  const editW    = isEdit ? mode.edit : null;
  const defaultDept: 'finishing' | 'inspection' = isEdit
    ? editW!.department
    : mode === 'add-finishing' ? 'finishing' : 'inspection';

  const [name, setName]   = useState(editW?.name ?? '');
  const [role, setRole]   = useState(editW?.role ?? (defaultDept === 'finishing' ? ROLES_FINISHING[1] : ROLES_INSPECTION[1]));
  const [dept, setDept]   = useState<'finishing' | 'inspection'>(defaultDept);
  const [saving, setSaving] = useState(false);

  const roles = dept === 'finishing' ? ROLES_FINISHING : ROLES_INSPECTION;

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (isEdit && editW) {
        await updateWorker(editW.id, { name: name.trim(), role, department: dept });
      } else {
        // Generate next worker ID
        const prefix = dept === 'finishing' ? 'F' : 'I';
        const existing = workers.filter(w => w.id.startsWith(prefix));
        const nums = existing.map(w => parseInt(w.id.replace(prefix, ''), 10) || 0);
        const nextNum = (Math.max(0, ...nums) + 1).toString().padStart(3, '0');
        const newId = `${prefix}${nextNum}`;
        await insertWorker({ id: newId, name: name.trim(), role, department: dept, present: true });
      }
      await onSaved();
    } catch (e: any) {
      alert(e?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[300] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[4px] w-full max-w-[420px] shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-[#E4E5E6] flex items-center justify-between">
          <div className="text-[13px] font-semibold text-[#111]">
            {isEdit ? 'Edit Worker' : `Add Worker — ${defaultDept === 'finishing' ? 'Finishing' : 'Inspection'}`}
          </div>
          <button type="button" title="Close" aria-label="Close" onClick={onClose} className="text-[#555] hover:text-[#111]"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3">
          <WField label="Name *">
            <input
              className={winp} value={name} autoFocus
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && save()}
              placeholder="e.g. Ramesh K." title="Worker name"
            />
          </WField>
          <WField label="Department">
            <select className={winp} value={dept}
              onChange={e => {
                const d = e.target.value as 'finishing' | 'inspection';
                setDept(d);
                setRole(d === 'finishing' ? ROLES_FINISHING[1] : ROLES_INSPECTION[1]);
              }}
              title="Department"
            >
              <option value="finishing">Finishing</option>
              <option value="inspection">Inspection</option>
            </select>
          </WField>
          <WField label="Role">
            <select className={winp} value={role} onChange={e => setRole(e.target.value)} title="Role">
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </WField>
        </div>
        <div className="px-4 py-3 border-t border-[#E4E5E6] flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="px-[11px] py-[5px] text-[11px] font-medium border border-[#E4E5E6] rounded-[3px] text-[#333] bg-white hover:bg-[#F5F6F7]">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={!name.trim() || saving}
            className="inline-flex items-center gap-1 px-[11px] py-[5px] text-[11px] font-medium bg-[#0A6ED1] text-white rounded-[3px] hover:bg-[#085EA8] disabled:opacity-40">
            <Check size={12} /> {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Worker'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const inp  = 'w-full font-sans text-[12.5px] text-[#111] bg-white border border-[#CCC] rounded-[3px] px-2.5 py-1.5 outline-none focus:border-[#0A6ED1]';
const winp = 'w-full font-sans text-[12px] text-[#111] bg-white border border-[#E4E5E6] rounded-[3px] px-2.5 py-1.5 outline-none focus:border-[#0A6ED1]';

function SectionTitle({ icon, title, extra }: { icon: React.ReactNode; title: string; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[#555]">{icon}</span>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#333]">{title}</div>
      {extra && <div className="ml-auto text-[11px] text-[#555]">{extra}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10.5px] font-semibold uppercase tracking-wider text-[#555] mb-1">{label}</label>
      {children}
    </div>
  );
}

function WField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10.5px] font-semibold uppercase tracking-wider text-[#555] mb-1">{label}</label>
      {children}
    </div>
  );
}

function Loading() {
  return <div className="bg-white border border-[#E4E5E6] rounded-[3px] p-8 text-center text-[12px] text-[#555]">Loading…</div>;
}
