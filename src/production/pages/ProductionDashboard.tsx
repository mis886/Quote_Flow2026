// Production Dashboard — Beta vertical slice.
// KPI row + emergency banner + live Press Board. Other widgets land in
// later iterations.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Plus, Workflow } from 'lucide-react';
import { useProductionData } from '../lib/useProductionData';
import { PressBoard } from '../components/PressBoard';
import { AssignPressModal } from '../components/AssignPressModal';
import { assignJobsToPress, markPressDone } from '../lib/actions';

export function ProductionDashboard() {
  const { presses, jobs, settings, loading, refresh } = useProductionData();
  const [assigning, setAssigning] = useState<{ pressId: string | null } | null>(null);

  const openJobs       = jobs.filter(j => j.stage !== 'dispatched');
  const overdue        = openJobs.filter(j => j.promised_date && j.promised_date < new Date().toISOString().slice(0, 10) && j.stage !== 'dispatch');
  const emergencyJobs  = openJobs.filter(j => j.priority === 'emergency');
  const runningCount   = presses.filter(p => p.status === 'running').length;
  const pressUtil      = presses.length ? Math.round((runningCount / presses.length) * 100) : 0;

  // OTD MTD is a placeholder until Phase 4 — surface the math we have:
  // dispatched on-time vs total dispatched this month.
  const dispatched     = jobs.filter(j => j.stage === 'dispatched');
  const dispatchedOn   = dispatched.filter(j => j.otd_result === 'on-time').length;
  const otdPct         = dispatched.length ? Math.round((dispatchedOn / dispatched.length) * 100) : null;

  const queuedNoPress = jobs.filter(j => j.stage === 'moulding' && !j.press_id);

  const handleConfirmAssign = async (jobIds: string[], pressId: string) => {
    await assignJobsToPress(jobIds, pressId);
    await refresh();
  };
  const handleMarkDone = async (pressId: string) => {
    await markPressDone(pressId);
    await refresh();
  };

  return (
    <div className="p-4 lg:p-5 space-y-3">
      {/* Emergency banner */}
      {emergencyJobs.length > 0 && (
        <div className="bg-red-lt border border-red-mrt/30 rounded-[3px] px-3 py-2.5 flex items-center gap-2">
          <AlertTriangle size={15} className="text-red-mrt shrink-0" />
          <div className="flex-1 text-[12px] text-red-mrt">
            <strong>🔴 EMERGENCY PO ACTIVE:</strong>{' '}
            {emergencyJobs.map(j => (
              <span key={j.id} className="mr-3">
                <strong>{j.id}</strong> — {j.product_desc} · {j.customer_name}
              </span>
            ))}
            <span className="text-g600">· Ambulance corridor active</span>
          </div>
          <Link
            to="/production/sequencer/mould"
            className="px-2.5 py-1 bg-red-mrt text-white text-[11px] rounded hover:bg-red-700"
          >
            View in Sequencer →
          </Link>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KPI value={otdPct !== null ? `${otdPct}%` : '—'} label="On-Time Delivery" accent="border-t-blue-500" />
        <KPI value={openJobs.length}                       label="WIP Jobs"          accent="border-t-orange-500" sub={`${emergencyJobs.length} emergency`} />
        <KPI value={overdue.length}                        label="Overdue Jobs"      accent="border-t-red-mrt"    sub="Needs action" />
        <KPI value={`${pressUtil}%`}                       label="Press Utilisation" accent="border-t-green-500"  sub={`${runningCount} of ${presses.length} running`} />
      </div>

      {/* Live press board */}
      <div className="bg-white border border-g200 rounded-[3px]">
        <div className="px-3 py-2 border-b border-g200 flex items-center gap-2">
          <div className="text-[12px] font-semibold text-blk flex-1">Live Press Board</div>
          {settings && (
            <span className="text-[10px] text-g500">
              Shift: {settings.shift_hours_left}h left · OT budget {settings.overtime_max}h
            </span>
          )}
          <Link
            to="/production/sequencer/mould"
            className="text-[11px] text-red-mrt hover:underline flex items-center gap-1"
          >
            <Workflow size={12} /> Full Sequencer
          </Link>
        </div>
        <div className="p-2.5">
          {loading ? (
            <div className="text-center py-6 text-[12px] text-g400">Loading…</div>
          ) : (
            <PressBoard
              presses={presses}
              jobs={jobs}
              onAssign={(pressId) => setAssigning({ pressId })}
              onMarkDone={handleMarkDone}
            />
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <Link
          to="/production/jobs/new"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-mrt text-white text-[12px] rounded-[3px] hover:bg-red-700"
        >
          <Plus size={13} /> New Production Job
        </Link>
        {queuedNoPress.length > 0 && (
          <button
            onClick={() => setAssigning({ pressId: null })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-g300 text-[12px] rounded-[3px] hover:bg-g100"
          >
            {queuedNoPress.length} queued · Assign Press
          </button>
        )}
      </div>

      <AssignPressModal
        open={!!assigning}
        onClose={() => setAssigning(null)}
        jobs={queuedNoPress}
        presses={presses}
        preselectPressId={assigning?.pressId || null}
        onConfirm={handleConfirmAssign}
      />
    </div>
  );
}

function KPI({ value, label, accent, sub }: { value: React.ReactNode; label: string; accent: string; sub?: string }) {
  return (
    <div className={`bg-white border border-g200 border-t-2 rounded-[3px] px-3.5 py-3 ${accent}`}>
      <div className="text-[24px] font-light leading-none text-blk">{value}</div>
      <div className="text-[10px] text-g500 mt-1.5">{label}</div>
      {sub && <div className="text-[10px] text-g500 mt-1">{sub}</div>}
    </div>
  );
}
