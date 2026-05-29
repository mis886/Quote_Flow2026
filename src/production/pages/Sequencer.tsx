// Sequencer wrapper — 6 tabs (Shift Briefing + 5 stages).
// Vertical slice ships Moulding fully wired; other tabs render a
// placeholder so the workflow is visible without being complete.

import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useProductionData } from '../lib/useProductionData';
import { PressBoard } from '../components/PressBoard';
import { AssignPressModal } from '../components/AssignPressModal';
import { assignJobToPress, markPressDone } from '../lib/actions';
import { updateJob, logStageEvent } from '../lib/db';
import { ArrowRight, Plus } from 'lucide-react';

const TABS: { k: string; label: string; emoji?: string }[] = [
  { k: 'shift',    label: 'Shift Briefing', emoji: '🌅' },
  { k: 'mould',    label: 'Moulding' },
  { k: 'finish',   label: 'Finishing' },
  { k: 'insp',     label: 'Inspection' },
  { k: 'pdi',      label: 'PDI Awaiting' },
  { k: 'dispatch', label: 'Ready to Dispatch' },
];

const STAGE_BY_TAB: Record<string, string | null> = {
  shift: null, mould: 'moulding', finish: 'finishing',
  insp: 'inspection', pdi: 'pdi', dispatch: 'dispatch',
};

export function Sequencer() {
  const { tab } = useParams<{ tab?: string }>();
  const active = tab && TABS.some(t => t.k === tab) ? tab : 'mould';
  const navigate = useNavigate();
  const { presses, jobs, loading, refresh } = useProductionData();
  const [assigning, setAssigning] = useState<{ pressId: string | null; jobId: string | null } | null>(null);

  const stageJobs = useMemo(() => {
    const s = STAGE_BY_TAB[active];
    if (!s) return [];
    return jobs
      .filter(j => j.stage === s)
      .slice()
      .sort((a, b) => {
        if (a.priority === 'emergency' && b.priority !== 'emergency') return -1;
        if (b.priority === 'emergency' && a.priority !== 'emergency') return 1;
        return (a.lsd || a.promised_date || '').localeCompare(b.lsd || b.promised_date || '');
      });
  }, [jobs, active]);

  const queuedNoPress = useMemo(
    () => jobs.filter(j => j.stage === 'moulding' && !j.press_id),
    [jobs]
  );

  const handleConfirmAssign = async (jobId: string, pressId: string) => {
    await assignJobToPress(jobId, pressId);
    await refresh();
  };
  const handleMarkDone = async (pressId: string) => {
    await markPressDone(pressId);
    await refresh();
  };
  const handleAdvance = async (jobId: string, toStage: 'finishing' | 'inspection' | 'pdi' | 'dispatch') => {
    const j = jobs.find(x => x.id === jobId);
    if (!j) return;
    await updateJob(jobId, { stage: toStage, status: toStage === 'dispatch' ? 'ready' : 'in-progress' });
    await logStageEvent(jobId, toStage, j.stage as any, null, null);
    await refresh();
  };

  return (
    <div className="p-4 lg:p-5">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-g200 mb-3 overflow-x-auto">
        {TABS.map(t => {
          const isActive = active === t.k;
          const count = t.k === 'shift' ? null : jobs.filter(j => j.stage === STAGE_BY_TAB[t.k]).length;
          return (
            <button
              key={t.k}
              onClick={() => navigate(`/production/sequencer/${t.k}`)}
              className={`px-3 py-2 text-[12px] whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? 'border-red-mrt text-red-mrt font-semibold'
                  : 'border-transparent text-g500 hover:text-blk'
              }`}
            >
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

      {/* Tab content */}
      {active === 'mould' ? (
        <div className="space-y-3">
          <PressBoard
            presses={presses}
            jobs={jobs}
            onAssign={(pressId) => setAssigning({ pressId, jobId: null })}
            onMarkDone={handleMarkDone}
          />

          <div className="bg-white border border-g200 rounded-[3px]">
            <div className="px-3 py-2 border-b border-g200 flex items-center gap-2">
              <div className="text-[12px] font-semibold text-blk flex-1">
                Moulding Queue
                <span className="ml-2 text-[10px] text-g500 font-normal">
                  {stageJobs.length} jobs · sorted by LSD
                </span>
              </div>
              <Link
                to="/production/jobs/new"
                className="text-[11px] text-red-mrt border border-red-mrt/30 rounded px-2 py-1 hover:bg-red-lt flex items-center gap-1"
              >
                <Plus size={12} /> New Job
              </Link>
            </div>

            {loading ? (
              <div className="p-6 text-center text-[12px] text-g400">Loading…</div>
            ) : stageJobs.length === 0 ? (
              <div className="p-8 text-center text-[12px] text-g400">
                No jobs in this stage.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-g50">
                      <Th>Job ID</Th>
                      <Th>Product</Th>
                      <Th>Customer</Th>
                      <Th>Qty</Th>
                      <Th>LSD</Th>
                      <Th>Promised</Th>
                      <Th>Mould</Th>
                      <Th>Press</Th>
                      <Th>Status</Th>
                      <Th>Action</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {stageJobs.map(j => (
                      <tr key={j.id} className="border-t border-g100 hover:bg-g50">
                        <Td>
                          {j.priority === 'emergency' && <span className="mr-1">🔴</span>}
                          <span className="text-red-mrt font-semibold">{j.id}</span>
                        </Td>
                        <Td>{j.product_desc}</Td>
                        <Td>{j.customer_name || '—'}</Td>
                        <Td>{j.qty.toLocaleString()}</Td>
                        <Td>{j.lsd || '—'}</Td>
                        <Td>{j.promised_date || '—'}</Td>
                        <Td>
                          {j.mould_code || '—'}
                          {j.cavities ? <span className="text-g500 text-[10px]"> ({j.cavities} cav)</span> : null}
                        </Td>
                        <Td>{j.press_id || <span className="text-g400">—</span>}</Td>
                        <Td><StatusPill status={j.status} /></Td>
                        <Td>
                          {!j.press_id ? (
                            <button
                              onClick={() => setAssigning({ pressId: null, jobId: j.id })}
                              className="text-[11px] text-red-mrt border border-red-mrt/30 rounded px-2 py-1 hover:bg-red-lt"
                            >
                              Assign Press
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAdvance(j.id, 'finishing')}
                              className="text-[11px] text-green-700 border border-green-300 rounded px-2 py-1 hover:bg-green-50 flex items-center gap-1"
                            >
                              <ArrowRight size={11} /> To Finishing
                            </button>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <PlaceholderTab tab={active} count={stageJobs.length} />
      )}

      <AssignPressModal
        open={!!assigning}
        onClose={() => setAssigning(null)}
        jobs={queuedNoPress}
        presses={presses}
        preselectPressId={assigning?.pressId || null}
        preselectJobId={assigning?.jobId || null}
        onConfirm={handleConfirmAssign}
      />
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left text-[10px] font-mono font-bold tracking-wider uppercase text-g500 px-2.5 py-2 whitespace-nowrap">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2.5 py-2 text-[12px] text-blk whitespace-nowrap">{children}</td>;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    queued: 'bg-g100 text-g600 border-g200',
    setup: 'bg-orange-100 text-orange-700 border-orange-200',
    running: 'bg-green-100 text-green-700 border-green-200',
    'in-progress': 'bg-blue-100 text-blue-700 border-blue-200',
    passed: 'bg-green-100 text-green-700 border-green-200',
    pending: 'bg-g100 text-g600 border-g200',
    ncr: 'bg-red-100 text-red-mrt border-red-200',
    awaiting: 'bg-g100 text-g600 border-g200',
    'in-review': 'bg-orange-100 text-orange-700 border-orange-200',
    ready: 'bg-blue-100 text-blue-700 border-blue-200',
    dispatched: 'bg-green-100 text-green-700 border-green-200',
    late: 'bg-red-100 text-red-mrt border-red-200',
  };
  return (
    <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-[2px] border ${map[status] || 'bg-g100 text-g600 border-g200'}`}>
      {status}
    </span>
  );
}

function PlaceholderTab({ tab, count }: { tab: string; count: number }) {
  const labels: Record<string, string> = {
    shift: 'Shift Briefing', finish: 'Finishing', insp: 'Inspection',
    pdi: 'PDI Awaiting', dispatch: 'Ready to Dispatch',
  };
  return (
    <div className="bg-white border border-g200 rounded-[3px] p-10 text-center">
      <div className="text-[13px] font-semibold text-blk mb-1">
        {labels[tab] || tab}
      </div>
      <div className="text-[12px] text-g500 mb-3">
        {count} job{count === 1 ? '' : 's'} in this stage.
      </div>
      <div className="text-[11px] text-g400">
        This tab ships in the next Beta iteration. The vertical slice covers
        Moulding only.
      </div>
    </div>
  );
}
