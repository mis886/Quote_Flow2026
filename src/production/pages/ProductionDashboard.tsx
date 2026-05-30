// Production Dashboard — Beta vertical slice with v2 milestone widgets.
// CRM-styled header, KPI row, emergency banner, live press board,
// Stage Milestone Tracker, Today's Dispatch Targets, 30-week OTD trend,
// and the embedded Sequencer.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Plus, Workflow } from 'lucide-react';
import { useProductionData } from '../lib/useProductionData';
import { PressBoard } from '../components/PressBoard';
import { AssignPressModal } from '../components/AssignPressModal';
import { StageMilestoneTracker } from '../components/StageMilestoneTracker';
import { TodaysDispatchTargets } from '../components/TodaysDispatchTargets';
import { OTDTrend } from '../components/OTDTrend';
import { SequencerBody, type SequencerTab } from '../components/SequencerBody';
import { Button } from '../../components/ui';
import { assignJobsToPress, markPressDone } from '../lib/actions';
import { PageHeader } from '../components/table';

export function ProductionDashboard() {
  const data = useProductionData();
  const { presses, jobs, settings, loading, refresh } = data;
  const [assigning, setAssigning] = useState<{ pressId: string | null } | null>(null);
  const [seqTab, setSeqTab] = useState<SequencerTab>('mould');

  const openJobs       = jobs.filter(j => j.stage !== 'dispatched');
  const today          = new Date().toISOString().slice(0, 10);
  const overdue        = openJobs.filter(j => j.promised_date && j.promised_date < today && j.stage !== 'dispatch');
  const emergencyJobs  = openJobs.filter(j => j.priority === 'emergency');
  const runningCount   = presses.filter(p => p.status === 'running').length;
  const pressUtil      = presses.length ? Math.round((runningCount / presses.length) * 100) : 0;

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
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      <PageHeader
        module="Production"
        title="Production"
        accent="Dashboard"
        subtitle="Shop-floor at a glance — capacity, milestones, dispatch, OTD."
        actions={
          <>
            <Link to="/production/jobs/new">
              <Button variant="primary" className="gap-2">
                <Plus size={14} className="stroke-2" /> New Job
              </Button>
            </Link>
            <Link to="/production/sequencer/mould">
              <Button variant="secondary" className="gap-1">
                <Workflow size={12} /> Sequencer
              </Button>
            </Link>
          </>
        }
      />

      <div className="px-6 pb-7 pt-[14px] flex-1 overflow-y-auto space-y-4">
        {/* Emergency banner */}
        {emergencyJobs.length > 0 && (
          <div className="bg-red-lt border border-red-mrt/30 rounded-[3px] px-3 py-2.5 flex items-center gap-2">
            <AlertTriangle size={15} className="text-red-mrt shrink-0" />
            <div className="flex-1 text-[12px] text-red-mrt">
              <strong>🔴 EMERGENCY PO ACTIVE:</strong>{' '}
              {emergencyJobs.slice(0, 2).map(j => (
                <span key={j.id} className="mr-3">
                  <strong>{j.id}</strong> — {j.product_desc} · {j.customer_name}
                </span>
              ))}
              {emergencyJobs.length > 2 && <span className="text-g600">+{emergencyJobs.length - 2} more</span>}
              <span className="text-g600 ml-1">· Ambulance corridor active</span>
            </div>
            <Link to="/production/sequencer/mould">
              <Button variant="primary" size="sm">View in Sequencer</Button>
            </Link>
          </div>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <KPI value={otdPct !== null ? `${otdPct}%` : '—'}   label="On-Time Delivery" accent="border-t-sN"     sub={dispatched.length ? `${dispatchedOn} of ${dispatched.length} dispatched` : 'No dispatches yet'} />
          <KPI value={openJobs.length}                         label="WIP Jobs"          accent="border-t-sP"     sub={`${emergencyJobs.length} emergency`} />
          <KPI value={overdue.length}                          label="Overdue Jobs"      accent="border-t-red-mrt" sub="Needs action" />
          <KPI value={`${pressUtil}%`}                         label="Press Utilisation" accent="border-t-sW"     sub={`${runningCount} of ${presses.length} running`} />
        </div>

        {/* Live press board */}
        <div className="bg-white border border-g200 rounded-[3px]">
          <div className="px-3 py-2 border-b border-g200 flex items-center gap-2">
            <div className="font-mono text-[9px] font-bold tracking-[2.5px] uppercase text-g500 flex-1">
              Live Press Board
            </div>
            {settings && (
              <span className="text-[10px] text-g500">
                Shift: {settings.shift_hours_left}h left · OT budget {settings.overtime_max}h
              </span>
            )}
            <Link to="/production/presses" className="text-[11px] text-red-mrt hover:underline flex items-center gap-1">
              Full Press Board →
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

        {/* Unassigned alert */}
        {queuedNoPress.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-[3px] px-3 py-2.5 flex items-center gap-2 text-[12px] text-orange-900">
            <AlertTriangle size={13} className="shrink-0" />
            <div className="flex-1">
              <strong>{queuedNoPress.length}</strong> job{queuedNoPress.length === 1 ? '' : 's'} in Moulding queue without a press.
            </div>
            <Button variant="primary" size="sm" onClick={() => setAssigning({ pressId: null })}>
              Assign Now
            </Button>
          </div>
        )}

        {/* Stage Milestone Tracker */}
        <StageMilestoneTracker jobs={jobs} settings={settings} />

        {/* Today's Dispatch Targets */}
        <TodaysDispatchTargets jobs={jobs} />

        {/* 30-week OTD trend */}
        <OTDTrend jobs={jobs} />

        {/* Embedded Sequencer */}
        <div className="bg-white border border-g200 rounded-[3px] overflow-hidden">
          <div className="px-3 py-2 border-b border-g200 flex items-center gap-2">
            <Workflow size={13} className="text-g500" />
            <div className="font-mono text-[9px] font-bold tracking-[2.5px] uppercase text-g500 flex-1">
              Sequencer
              <span className="ml-2 text-g600 font-normal tracking-normal normal-case">
                In-line view — switch tabs to action jobs in place
              </span>
            </div>
            <Link
              to={`/production/sequencer/${seqTab}`}
              className="text-[11px] text-red-mrt hover:underline"
            >
              Open Full →
            </Link>
          </div>
          <div className="-mx-6 -mb-7">
            {/* SequencerBody uses px-6 internally; cancel the outer padding so it sits flush */}
            <SequencerBody data={data} activeTab={seqTab} onTabChange={setSeqTab} />
          </div>
        </div>
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
      <div className="text-[28px] font-light leading-none text-blk">{value}</div>
      <div className="font-mono text-[9px] font-bold tracking-[1.5px] uppercase text-g500 mt-1.5">{label}</div>
      {sub && <div className="text-[10px] text-g500 mt-1">{sub}</div>}
    </div>
  );
}
