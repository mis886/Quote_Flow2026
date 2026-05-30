// Production Dashboard — v2 design system (SAP blue/grey).

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Plus, Workflow, Factory } from 'lucide-react';
import { useProductionData } from '../lib/useProductionData';
import { PressBoard } from '../components/PressBoard';
import { AssignPressModal } from '../components/AssignPressModal';
import { StageMilestoneTracker } from '../components/StageMilestoneTracker';
import { TodaysDispatchTargets } from '../components/TodaysDispatchTargets';
import { OTDTrend } from '../components/OTDTrend';
import { SequencerBody, type SequencerTab } from '../components/SequencerBody';
import { assignJobsToPress, markPressDone } from '../lib/actions';

export function ProductionDashboard() {
  const data = useProductionData();
  const { presses, jobs, settings, loading, refresh } = data;
  const [assigning, setAssigning] = useState<{ pressId: string | null } | null>(null);
  const [seqTab, setSeqTab] = useState<SequencerTab>('mould');

  const openJobs      = jobs.filter(j => j.stage !== 'dispatched');
  const today         = new Date().toISOString().slice(0, 10);
  const overdue       = openJobs.filter(j => j.promised_date && j.promised_date < today && j.stage !== 'dispatch');
  const emergencyJobs = openJobs.filter(j => j.priority === 'emergency');
  const runningCount  = presses.filter(p => p.status === 'running').length;
  const pressUtil     = presses.length ? Math.round((runningCount / presses.length) * 100) : 0;
  const dispatched    = jobs.filter(j => j.stage === 'dispatched');
  const dispatchedOn  = dispatched.filter(j => j.otd_result === 'on-time').length;
  const otdPct        = dispatched.length ? Math.round((dispatchedOn / dispatched.length) * 100) : null;
  const queuedNoPress = jobs.filter(j => j.stage === 'moulding' && !j.press_id);

  const handleConfirmAssign = async (jobIds: string[], pressId: string) => {
    await assignJobsToPress(jobIds, pressId); await refresh();
  };
  const handleMarkDone = async (pressId: string) => {
    await markPressDone(pressId); await refresh();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="h-12 bg-white border-b border-[#E4E5E6] px-4 flex items-center gap-3 flex-shrink-0">
        <Factory size={15} className="text-[#333]" />
        <div className="flex-1">
          <span className="text-[14px] font-semibold text-[#111]">Production Dashboard</span>
          <span className="ml-2 text-[11px] text-[#333] hidden sm:inline">Shop-floor at a glance</span>
        </div>
        <Link
          to="/production/jobs/new"
          className="inline-flex items-center gap-1 bg-[#0A6ED1] text-white text-[11px] font-medium px-[11px] py-[5px] rounded-[3px] hover:bg-[#085EA8] transition-colors"
        >
          <Plus size={12} /> New Job
        </Link>
        <Link
          to="/production/sequencer/mould"
          className="inline-flex items-center gap-1 bg-white text-[#0A6ED1] border border-[#0A6ED1] text-[11px] font-medium px-[11px] py-[5px] rounded-[3px] hover:bg-[#E8F0FD] transition-colors"
        >
          <Workflow size={12} /> Sequencer
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Emergency banner */}
        {emergencyJobs.length > 0 && (
          <div className="bg-[#FFF1F0] border border-[#FFCDD2] rounded-[3px] px-3 py-2 flex items-center gap-2">
            <AlertTriangle size={14} className="text-[#BB0000] shrink-0" />
            <div className="flex-1 text-[12px] text-[#BB0000]">
              <strong>🔴 EMERGENCY PO ACTIVE:</strong>{' '}
              {emergencyJobs.slice(0, 2).map(j => (
                <span key={j.id} className="mr-3">
                  <strong>{j.id}</strong> — {j.product_desc} · {j.customer_name}
                </span>
              ))}
              {emergencyJobs.length > 2 && (
                <span className="text-[#333]">+{emergencyJobs.length - 2} more</span>
              )}
              <span className="text-[#333] ml-1">· Ambulance corridor active</span>
            </div>
            <Link
              to="/production/sequencer/mould"
              className="bg-[#BB0000] text-white text-[11px] font-medium px-[10px] py-[3px] rounded-[3px] hover:bg-[#8E0000] whitespace-nowrap transition-colors"
            >
              View in Sequencer
            </Link>
          </div>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <KPI
            value={otdPct !== null ? `${otdPct}%` : '—'}
            label="On-Time Delivery (MTD)"
            accentClass="border-t-[#0A6ED1]"
            sub={dispatched.length ? `${dispatchedOn} of ${dispatched.length} dispatched` : 'No dispatches yet'}
            subClass="text-[#107E3E]"
          />
          <KPI
            value={openJobs.length}
            label="WIP Jobs in Pipeline"
            accentClass="border-t-[#E9730C]"
            sub={emergencyJobs.length ? `${emergencyJobs.length} emergency` : 'All normal'}
            subClass={emergencyJobs.length ? 'text-[#BB0000]' : 'text-[#333]'}
          />
          <KPI
            value={overdue.length}
            label="Overdue / At Risk"
            accentClass="border-t-[#BB0000]"
            sub="Needs action"
            subClass={overdue.length ? 'text-[#BB0000]' : 'text-[#333]'}
          />
          <KPI
            value={`${pressUtil}%`}
            label="Press Utilisation"
            accentClass="border-t-[#107E3E]"
            sub={`${runningCount} of ${presses.length} running`}
            subClass="text-[#107E3E]"
          />
        </div>

        {/* Live press board */}
        <div className="bg-white border border-[#E4E5E6] rounded-[3px]">
          <div className="px-3 py-2 border-b border-[#E4E5E6] flex items-center gap-2">
            <span className="text-[12px] font-semibold text-[#111] flex-1">Live Press Board</span>
            {settings && (
              <span className="text-[10px] text-[#333]">
                Shift: {settings.shift_hours_left}h left · OT {settings.overtime_max}h
              </span>
            )}
            <Link to="/production/presses" className="text-[11px] text-[#0A6ED1] hover:underline">
              Full Board →
            </Link>
          </div>
          <div className="p-2.5">
            {loading
              ? <div className="text-center py-6 text-[12px] text-[#333]">Loading…</div>
              : <PressBoard presses={presses} jobs={jobs} onAssign={pid => setAssigning({ pressId: pid })} onMarkDone={handleMarkDone} />
            }
          </div>
        </div>

        {/* Unassigned alert */}
        {queuedNoPress.length > 0 && (
          <div className="bg-[#FFF8EC] border border-[#FFE0B2] rounded-[3px] px-3 py-2 flex items-center gap-2 text-[12px] text-[#E9730C]">
            <AlertTriangle size={13} className="shrink-0" />
            <div className="flex-1">
              <strong>{queuedNoPress.length}</strong> job{queuedNoPress.length === 1 ? '' : 's'} in Moulding without a press.
            </div>
            <button type="button" onClick={() => setAssigning({ pressId: null })}
              className="bg-[#E9730C] text-white text-[11px] font-medium px-[10px] py-[3px] rounded-[3px] hover:bg-[#BF5D08] border-none cursor-pointer whitespace-nowrap transition-colors">
              Assign Now
            </button>
          </div>
        )}

        {/* Stage Milestone Tracker */}
        <StageMilestoneTracker jobs={jobs} settings={settings} />

        {/* Today's Dispatch Targets */}
        <TodaysDispatchTargets jobs={jobs} />

        {/* 30-week OTD trend */}
        <OTDTrend jobs={jobs} />

        {/* Embedded Sequencer */}
        <div className="bg-white border border-[#E4E5E6] rounded-[3px] overflow-hidden">
          <div className="px-3 py-2 border-b border-[#E4E5E6] flex items-center gap-2">
            <Workflow size={13} className="text-[#333]" />
            <span className="text-[12px] font-semibold text-[#111] flex-1">
              Sequencer
              <span className="ml-2 text-[11px] text-[#333] font-normal">In-line view</span>
            </span>
            <Link to={`/production/sequencer/${seqTab}`} className="text-[11px] text-[#0A6ED1] hover:underline">
              Open Full →
            </Link>
          </div>
          <SequencerBody data={data} activeTab={seqTab} onTabChange={setSeqTab} />
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

function KPI({
  value, label, accentClass, sub, subClass,
}: {
  value: React.ReactNode;
  label: string;
  accentClass: string;
  sub?: string;
  subClass?: string;
}) {
  return (
    <div className={`bg-white border border-[#E4E5E6] border-t-[3px] rounded-[3px] px-[14px] py-3 ${accentClass}`}>
      <div className="text-[26px] font-light leading-none text-[#111]">{value}</div>
      <div className="text-[10px] text-[#333] mt-[3px]">{label}</div>
      {sub && <div className={`text-[10px] mt-[5px] ${subClass ?? 'text-[#333]'}`}>{sub}</div>}
    </div>
  );
}
