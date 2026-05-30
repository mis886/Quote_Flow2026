// Shop-floor settings — workforce master + shift/OT config + press status.

import { useEffect, useState } from 'react';
import { Save, Users, Wrench, Factory } from 'lucide-react';
import { Button } from '../../components/ui';
import { useProductionData } from '../lib/useProductionData';
import {
  updateShopFloorSettings, setWorkerPresent, updatePress,
} from '../lib/db';
import { PageHeader } from '../components/table';
import type { ShopFloorSettings } from '../lib/types';

export function ShopFloorSettingsPage() {
  const { settings, workers, presses, refresh, loading } = useProductionData();
  const [draft, setDraft] = useState<ShopFloorSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyWorker, setBusyWorker] = useState<string | null>(null);

  useEffect(() => { if (settings) setDraft(settings); }, [settings]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await updateShopFloorSettings({
        shift_started: draft.shift_started,
        shift_hours: draft.shift_hours,
        shift_hours_left: draft.shift_hours_left,
        overtime_max: draft.overtime_max,
        planned_finishers: draft.planned_finishers,
        planned_inspectors: draft.planned_inspectors,
        emergency_active: draft.emergency_active,
      });
      await refresh();
    } finally {
      setSaving(false);
    }
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

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      <PageHeader
        module="Production · Settings"
        title="Shop Floor"
        accent="Configuration"
        subtitle="Workforce attendance, shift defaults, and press status."
        actions={
          <Button variant="primary" onClick={save} disabled={saving || !draft} className="gap-2">
            <Save size={14} /> {saving ? 'Saving…' : 'Save Settings'}
          </Button>
        }
      />

      <div className="px-6 pb-7 pt-[14px] flex-1 overflow-y-auto space-y-4">
        {/* Shift config */}
        <section>
          <SectionTitle icon={<Wrench size={11} />} title="Shift & OT defaults" />
          {!draft ? (
            <Loading />
          ) : (
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
                <input
                  type="number" className={inp} min={1} max={24}
                  value={draft.shift_hours}
                  onChange={e => setDraft({ ...draft, shift_hours: Number(e.target.value) || 0 })}
                  title="Shift hours total"
                />
              </Field>
              <Field label="Shift Hours Left">
                <input
                  type="number" step="0.5" className={inp} min={0}
                  value={draft.shift_hours_left}
                  onChange={e => setDraft({ ...draft, shift_hours_left: Number(e.target.value) || 0 })}
                  title="Shift hours remaining"
                />
              </Field>
              <Field label="OT Budget (hrs)">
                <input
                  type="number" className={inp} min={0} max={8}
                  value={draft.overtime_max}
                  onChange={e => setDraft({ ...draft, overtime_max: Number(e.target.value) || 0 })}
                  title="Overtime budget"
                />
              </Field>
              <Field label="Planned Finishers (LSD calc)">
                <input
                  type="number" className={inp} min={1}
                  value={draft.planned_finishers}
                  onChange={e => setDraft({ ...draft, planned_finishers: Number(e.target.value) || 0 })}
                  title="Planned finishers headcount"
                />
              </Field>
              <Field label="Planned Inspectors (LSD calc)">
                <input
                  type="number" className={inp} min={1}
                  value={draft.planned_inspectors}
                  onChange={e => setDraft({ ...draft, planned_inspectors: Number(e.target.value) || 0 })}
                  title="Planned inspectors headcount"
                />
              </Field>
            </div>
          )}
        </section>

        {/* Workforce */}
        <section>
          <SectionTitle
            icon={<Users size={11} />}
            title="Workforce attendance"
            extra={
              <>
                Present today —
                <strong className="text-[#111] ml-1">
                  {workers.filter(w => w.department === 'finishing' && w.present).length}
                </strong> finishers ·
                <strong className="text-[#111] ml-1">
                  {workers.filter(w => w.department === 'inspection' && w.present).length}
                </strong> inspectors
              </>
            }
          />
          <div className="bg-white border border-[#E4E5E6] rounded-[3px] grid grid-cols-1 md:grid-cols-2 divide-x divide-[#F3F3F3]">
            {(['finishing', 'inspection'] as const).map(dept => (
              <div key={dept} className="p-3">
                <div className="font-mono text-[9px] font-bold tracking-[2.5px] uppercase text-[#333] mb-2">
                  {dept === 'finishing' ? 'Finishing Team' : 'Inspection Team'}
                </div>
                <ul className="divide-y divide-[#F3F3F3]">
                  {workers.filter(w => w.department === dept).map(w => (
                    <li key={w.id} className="flex items-center gap-3 py-2">
                      <div className="flex-1">
                        <div className="text-[12.5px] font-semibold text-[#111]">{w.name}</div>
                        <div className="text-[10.5px] font-mono text-[#333]">{w.id} · {w.role}</div>
                      </div>
                      <button
                        type="button"
                        disabled={busyWorker === w.id || loading}
                        onClick={() => togglePresent(w.id, !w.present)}
                        className={`px-2.5 py-1 text-[11px] rounded-[3px] border transition-colors disabled:opacity-50 ${
                          w.present
                            ? 'bg-sW/10 border-sW/20 text-[#107E3E] hover:bg-sW/20'
                            : 'bg-[#FAFAFA] border-[#E4E5E6] text-[#333] hover:bg-[#EBEBEB]'
                        }`}
                      >
                        {w.present ? 'Present ✓' : 'Absent'}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Press master */}
        <section>
          <SectionTitle icon={<Factory size={11} />} title="Press master" />
          <div className="bg-white border border-[#E4E5E6] rounded-[3px] divide-y divide-[#F3F3F3]">
            {presses.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-[#111]">{p.name} · {p.tonnage}</div>
                  <div className="text-[10.5px] font-mono text-[#333]">
                    {p.status === 'idle'
                      ? 'Idle — available'
                      : p.status === 'maintenance'
                      ? 'Under maintenance'
                      : `Active job: ${p.active_job_id || '—'} · ${p.pct_done || 0}%`}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={p.status === 'running' || p.status === 'setup'}
                  onClick={() => togglePressMaintenance(p.id, p.status !== 'maintenance')}
                  className={`px-2.5 py-1 text-[11px] rounded-[3px] border transition-colors disabled:opacity-30 ${
                    p.status === 'maintenance'
                      ? 'bg-sP/10 border-sP/30 text-[#E9730C] hover:bg-sP/20'
                      : 'bg-white border-[#CCC] text-[#666] hover:bg-[#FAFAFA]'
                  }`}
                  title={p.status === 'running' || p.status === 'setup' ? 'Press is busy — finish first' : ''}
                >
                  {p.status === 'maintenance' ? 'Bring online' : 'Mark Maintenance'}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

const inp = 'w-full font-sans text-[12.5px] text-[#111] bg-white border border-[#CCC] rounded-[3px] px-2.5 py-1.5 outline-none focus:border-[#0A6ED1] focus:ring-2 focus:ring-red-lt';

function SectionTitle({ icon, title, extra }: { icon: React.ReactNode; title: string; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[#333]">{icon}</span>
      <div className="font-mono text-[9px] font-bold tracking-[2.5px] uppercase text-[#333]">{title}</div>
      {extra && <div className="ml-auto text-[11px] text-[#333]">{extra}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10.5px] font-mono font-bold tracking-wider uppercase text-[#333] mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function Loading() {
  return <div className="bg-white border border-[#E4E5E6] rounded-[3px] p-8 text-center text-[12px] text-[#555]">Loading…</div>;
}
