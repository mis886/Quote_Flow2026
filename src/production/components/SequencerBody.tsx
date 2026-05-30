// SequencerBody — the tab strip + active-stage body, headless (no PageHeader).
// Used by the standalone Sequencer page AND embedded in the Dashboard.

import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui';
import {
  Table, THead, TH, TR, TD, EmptyRow, StatusPill, toneForStatus,
} from './table';
import { PressBoard } from './PressBoard';
import { AssignPressModal } from './AssignPressModal';
import { NCRModal } from './NCRModal';
import { PDIApprovalModal } from './PDIApprovalModal';
import { ConfirmDispatchModal } from './ConfirmDispatchModal';
import { ShiftBriefingTab } from '../pages/tabs/ShiftBriefingTab';
import { FinishingTab } from '../pages/tabs/FinishingTab';
import { InspectionTab } from '../pages/tabs/InspectionTab';
import { PDITab } from '../pages/tabs/PDITab';
import { DispatchTab } from '../pages/tabs/DispatchTab';
import {
  assignJobsToPress, markPressDone, advanceJob,
  passInspection, raiseNCR, reworkFromNCR, approvePDI, confirmDispatch,
} from '../lib/actions';
import type { ProductionData } from '../lib/useProductionData';
import type { ProductionJob } from '../lib/types';

export type SequencerTab = 'shift' | 'mould' | 'finish' | 'insp' | 'pdi' | 'dispatch';

export const SEQUENCER_TABS: { k: SequencerTab; label: string; emoji?: string; stage?: string | null }[] = [
  { k: 'shift',    label: 'Shift Briefing',    emoji: '🌅', stage: null },
  { k: 'mould',    label: 'Moulding',           stage: 'moulding' },
  { k: 'finish',   label: 'Finishing',          stage: 'finishing' },
  { k: 'insp',     label: 'Inspection',         stage: 'inspection' },
  { k: 'pdi',      label: 'PDI Awaiting',       stage: 'pdi' },
  { k: 'dispatch', label: 'Ready to Dispatch',  stage: 'dispatch' },
];

interface Props {
  data: ProductionData;
  activeTab: SequencerTab;
  onTabChange: (t: SequencerTab) => void;
  /** When true, the active stage table will also render the action column for jobs. */
  showActions?: boolean;
}

export function SequencerBody({ data, activeTab, onTabChange, showActions = true }: Props) {
  const { presses, jobs, workers, loading, refresh } = data;
  const navigate = useNavigate();

  const [assigning, setAssigning] = useState<{ pressId: string | null; jobId: string | null } | null>(null);
  const [ncrJob, setNcrJob]       = useState<ProductionJob | null>(null);
  const [pdiJob, setPdiJob]       = useState<ProductionJob | null>(null);
  const [dispJob, setDispJob]     = useState<ProductionJob | null>(null);

  // If the active tab gets removed/changed externally, sync.
  useEffect(() => {}, [activeTab]);

  const stageJobs = useMemo(() => {
    const t = SEQUENCER_TABS.find(x => x.k === activeTab);
    if (!t || !t.stage) return [];
    return jobs
      .filter(j => j.stage === t.stage)
      .slice()
      .sort((a, b) => {
        if (a.priority === 'emergency' && b.priority !== 'emergency') return -1;
        if (b.priority === 'emergency' && a.priority !== 'emergency') return 1;
        return (a.lsd || a.promised_date || '').localeCompare(b.lsd || b.promised_date || '');
      });
  }, [jobs, activeTab]);

  const queuedNoPress = useMemo(
    () => jobs.filter(j => j.stage === 'moulding' && !j.press_id),
    [jobs]
  );

  const handleConfirmAssign = async (jobIds: string[], pressId: string) => {
    await assignJobsToPress(jobIds, pressId); await refresh();
  };
  const handleMarkDone = async (pressId: string) => {
    await markPressDone(pressId); await refresh();
  };
  const handleAdvance = async (jobId: string, toStage: 'finishing' | 'inspection' | 'pdi' | 'dispatch') => {
    await advanceJob(jobId, toStage); await refresh();
  };
  const handlePassInspection = async (jobId: string) => {
    await passInspection(jobId); await refresh();
  };
  const handleSubmitNCR = async (payload: { defect_desc: string; defect_code: string; responsible_stage: string; action: 'rework' | 'reject' }) => {
    if (!ncrJob) return;
    await raiseNCR(ncrJob.id, payload); await refresh(); setNcrJob(null);
  };
  const handleRework = async (jobId: string) => {
    await reworkFromNCR(jobId); await refresh();
  };
  const handleApprovePDI = async (officer: string) => {
    if (!pdiJob) return;
    await approvePDI(pdiJob.id, officer); await refresh(); setPdiJob(null);
  };
  const handleConfirmDispatch = async (payload: { courier: string; consignment_no: string }) => {
    if (!dispJob) return;
    await confirmDispatch(dispJob.id, payload); await refresh(); setDispJob(null);
  };

  return (
    <div>
      {/* Tab bar */}
      <div className="px-6 pt-2 bg-white border-b border-g200 overflow-x-auto">
        <div className="flex items-center gap-0">
          {SEQUENCER_TABS.map(t => {
            const isActive = activeTab === t.k;
            const count = t.stage ? jobs.filter(j => j.stage === t.stage).length : null;
            const hasEm = t.stage === 'moulding' && jobs.some(j => j.stage === 'moulding' && j.priority === 'emergency');
            return (
              <button
                key={t.k}
                type="button"
                onClick={() => onTabChange(t.k)}
                className={`px-3 py-2 text-[11.5px] whitespace-nowrap border-b-2 transition-colors -mb-px ${
                  isActive
                    ? 'border-red-mrt text-red-mrt font-semibold'
                    : 'border-transparent text-g500 hover:text-blk'
                }`}
              >
                {hasEm && <span className="mr-1">🔴</span>}
                {t.emoji && <span className="mr-1">{t.emoji}</span>}
                {t.label}
                {count !== null && (
                  <span className={`ml-1.5 inline-block px-1.5 py-0.5 rounded-full text-[9px] ${
                    isActive ? 'bg-red-mrt text-white' : 'bg-g200 text-g600'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-6 pb-7 pt-[14px]">
        {activeTab === 'shift' && <ShiftBriefingTab data={data} />}

        {activeTab === 'mould' && (
          <div className="space-y-3">
            <PressBoard
              presses={presses}
              jobs={jobs}
              onAssign={(pressId) => setAssigning({ pressId, jobId: null })}
              onMarkDone={handleMarkDone}
            />

            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="font-mono text-[9px] font-bold tracking-[2.5px] uppercase text-g500 flex-1">
                  Moulding Queue —
                  <span className="ml-1 text-g600 font-normal tracking-normal normal-case">
                    {stageJobs.length} jobs · sorted by LSD
                  </span>
                </div>
                {queuedNoPress.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setAssigning({ pressId: null, jobId: null })}
                  >
                    Assign Press ({queuedNoPress.length})
                  </Button>
                )}
              </div>

              <Table>
                <THead>
                  <tr>
                    <TH>Job ID</TH>
                    <TH>Product</TH>
                    <TH>Customer</TH>
                    <TH>Qty</TH>
                    <TH>LSD</TH>
                    <TH>Promised</TH>
                    <TH>Mould</TH>
                    <TH>Press</TH>
                    <TH>Status</TH>
                    {showActions && <TH>Action</TH>}
                  </tr>
                </THead>
                <tbody>
                  {loading ? (
                    <EmptyRow colSpan={showActions ? 10 : 9} text="Loading…" />
                  ) : stageJobs.length === 0 ? (
                    <EmptyRow colSpan={showActions ? 10 : 9} text="No jobs in Moulding." />
                  ) : stageJobs.map(j => (
                    <TR key={j.id} onClick={() => navigate(`/production/jobs/${j.id}`)}>
                      <TD>
                        <span className="font-mono text-[10.5px] font-bold text-red-mrt">
                          {j.priority === 'emergency' && <span className="mr-1">🔴</span>}{j.id}
                        </span>
                      </TD>
                      <TD className="font-semibold text-blk text-[12.5px]">{j.product_desc}</TD>
                      <TD className="text-[12.5px]">{j.customer_name || '—'}</TD>
                      <TD className="font-mono text-[11.5px]">{j.qty.toLocaleString()}</TD>
                      <TD className="font-mono text-[11px] text-g600">{j.lsd || '—'}</TD>
                      <TD className="font-mono text-[11px] text-g600">{j.promised_date || '—'}</TD>
                      <TD className="font-mono text-[11px]">
                        {j.mould_code || '—'}
                        {j.cavities ? <span className="text-g500 text-[10px]"> ({j.cavities})</span> : null}
                      </TD>
                      <TD className="font-mono text-[11px] text-g600">
                        {j.press_id ? <span className="bg-g100 px-1.5 py-0.5 rounded-[2px]">{j.press_id}</span> : <span className="text-g400">—</span>}
                      </TD>
                      <TD><StatusPill status={j.status} tone={toneForStatus(j.status)} /></TD>
                      {showActions && (
                        <TD onClick={e => e.stopPropagation()}>
                          {!j.press_id ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setAssigning({ pressId: null, jobId: j.id })}
                            >
                              Assign Press
                            </Button>
                          ) : (
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => handleAdvance(j.id, 'finishing')}
                              className="gap-1"
                            >
                              <ArrowRight size={11} /> Finishing
                            </Button>
                          )}
                        </TD>
                      )}
                    </TR>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        )}

        {activeTab === 'finish' && (
          <FinishingTab
            jobs={stageJobs}
            workers={workers}
            settings={data.settings}
            onQtyDoneChange={() => refresh()}
            onAdvance={(jobId) => handleAdvance(jobId, 'inspection')}
          />
        )}

        {activeTab === 'insp' && (
          <InspectionTab
            jobs={stageJobs}
            workers={workers}
            onPass={handlePassInspection}
            onFail={(j) => setNcrJob(j)}
            onRework={handleRework}
          />
        )}

        {activeTab === 'pdi' && (
          <PDITab
            jobs={stageJobs}
            onApprove={(j) => setPdiJob(j)}
          />
        )}

        {activeTab === 'dispatch' && (
          <DispatchTab
            jobs={stageJobs}
            onConfirmDispatch={(j) => setDispJob(j)}
          />
        )}
      </div>

      <AssignPressModal
        open={!!assigning}
        onClose={() => setAssigning(null)}
        jobs={queuedNoPress}
        presses={presses}
        preselectPressId={assigning?.pressId || null}
        preselectJobId={assigning?.jobId || null}
        onConfirm={handleConfirmAssign}
      />
      <NCRModal
        open={!!ncrJob}
        job={ncrJob}
        onClose={() => setNcrJob(null)}
        onSubmit={handleSubmitNCR}
      />
      <PDIApprovalModal
        open={!!pdiJob}
        job={pdiJob}
        onClose={() => setPdiJob(null)}
        onConfirm={handleApprovePDI}
      />
      <ConfirmDispatchModal
        open={!!dispJob}
        job={dispJob}
        onClose={() => setDispJob(null)}
        onConfirm={handleConfirmDispatch}
      />
    </div>
  );
}
