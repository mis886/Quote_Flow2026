// Stage Milestone Tracker — dashboard widget.
// Each active job → planned start dates for Mould/Finish/Inspect/PDI,
// RAG-coloured by today vs plan. Mirrors MRT v2 _ms_renderDashboard()
// milestone grid (lines 3535-3588).

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Check, Workflow } from 'lucide-react';
import {
  Table, THead, TH, TR, TD, EmptyRow, StatusPill,
} from './table';
import { fmtIST } from '../../lib/utils';
import {
  calcMilestones, stageRAG, currentStagePlan,
  type StageRAGDot,
} from '../lib/otdImpact';
import type { ProductionJob, ShopFloorSettings } from '../lib/types';

const STAGE_SEQ = ['moulding', 'finishing', 'inspection', 'pdi'] as const;

interface Props {
  jobs: ProductionJob[];
  settings: ShopFloorSettings | null;
}

export function StageMilestoneTracker({ jobs, settings }: Props) {
  const plannedF = settings?.planned_finishers  ?? 6;
  const plannedI = settings?.planned_inspectors ?? 3;

  const rows = useMemo(() => {
    const active = jobs.filter(j => STAGE_SEQ.includes(j.stage as any));
    return active
      .map(j => {
        const ms  = calcMilestones(j, plannedF, plannedI);
        const cur = stageRAG(currentStagePlan(j, ms));
        return { job: j, ms, cur };
      })
      .sort((a, b) => {
        const pri: Record<StageRAGDot, number> = { red: 0, amber: 1, green: 2, gray: 3 };
        const d = pri[a.cur.dot] - pri[b.cur.dot];
        if (d !== 0) return d;
        return (a.job.promised_date || '').localeCompare(b.job.promised_date || '');
      });
  }, [jobs, plannedF, plannedI]);

  return (
    <div className="bg-white border border-[#E4E5E6] rounded-[3px]">
      <div className="px-3 py-2 border-b border-[#E4E5E6] flex items-center gap-2">
        <div className="font-mono text-[9px] font-bold tracking-[2.5px] uppercase text-[#333] flex-1">
          Stage Milestone Tracker
          <span className="ml-2 text-[#666] font-normal tracking-normal normal-case">
            {rows.length} active · sorted by urgency · 3-day dispatch buffer
          </span>
        </div>
        <Link
          to="/production/sequencer/mould"
          className="text-[11px] text-[#0A6ED1] hover:underline flex items-center gap-1"
        >
          <Workflow size={11} /> Sequencer →
        </Link>
      </div>

      <Table className="border-0">
        <THead>
          <tr>
            <TH>Job</TH>
            <TH>Product</TH>
            <TH>Stage Now</TH>
            <TH>🔵 Moulding Start</TH>
            <TH>🟡 Finishing Start</TH>
            <TH>🟣 Inspection Start</TH>
            <TH>🟤 PDI Start</TH>
            <TH>Promised</TH>
          </tr>
        </THead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={8} text="No active jobs to track." />
          ) : rows.map(({ job, ms, cur }) => {
            const curIdx = STAGE_SEQ.indexOf(job.stage as any);
            const stagePlans = [
              ms?.pmMouldStart,
              ms?.pmFinishStart,
              ms?.pmInspStart,
              ms?.pmPDIStart,
            ];

            return (
              <TR key={job.id}>
                <TD>
                  <div className="flex items-center gap-1.5">
                    <Dot dot={cur.dot} />
                    <span className="font-mono text-[10.5px] font-bold text-[#0A6ED1]">
                      {job.priority === 'emergency' && <span className="mr-1">🔴</span>}{job.id}
                    </span>
                  </div>
                </TD>
                <TD>
                  <div className="font-semibold text-[#111] text-[12.5px] truncate max-w-[180px]">
                    {job.product_desc}
                  </div>
                  <div className="text-[10.5px] text-[#333] truncate max-w-[180px]">
                    {job.customer_name || '—'}
                  </div>
                </TD>
                <TD>
                  <StatusPill status={STAGE_LABEL[job.stage] || job.stage} tone="info" />
                </TD>
                {stagePlans.map((plan, idx) => (
                  <TD
                    key={idx}
                    className={idx === curIdx ? 'bg-red-mrt/5' : ''}
                  >
                    {idx < curIdx ? (
                      <Check size={13} className="text-[#107E3E]" />
                    ) : plan ? (
                      <RAGCell plan={plan} />
                    ) : (
                      <span className="text-[#555] text-[10.5px]">No plan</span>
                    )}
                  </TD>
                ))}
                <TD className="font-mono text-[11px] text-[#666]">
                  {job.promised_date || '—'}
                </TD>
              </TR>
            );
          })}
        </tbody>
      </Table>

      {/* Legend */}
      <div className="px-3 py-2 border-t border-[#E4E5E6] flex items-center gap-4 flex-wrap text-[10.5px] text-[#333]">
        <span className="flex items-center gap-1.5"><Dot dot="green" /> On track</span>
        <span className="flex items-center gap-1.5"><Dot dot="amber" /> Due today / tomorrow</span>
        <span className="flex items-center gap-1.5"><Dot dot="red" /> Milestone missed</span>
        <span className="ml-auto italic text-[#333]">
          Highlighted = current stage · ✓ = stage complete
        </span>
      </div>
    </div>
  );
}

const STAGE_LABEL: Record<string, string> = {
  moulding: 'Moulding', finishing: 'Finishing',
  inspection: 'Inspection', pdi: 'PDI',
};

function Dot({ dot }: { dot: StageRAGDot }) {
  const cls =
    dot === 'green' ? 'bg-sW' :
    dot === 'amber' ? 'bg-sP' :
    dot === 'red'   ? 'bg-red-mrt' :
                      'bg-g300';
  return <span className={`inline-block w-[8px] h-[8px] rounded-full shrink-0 ${cls}`} />;
}

function RAGCell({ plan }: { plan: string }) {
  const r = stageRAG(plan);
  const cls =
    r.dot === 'green' ? 'text-[#107E3E]' :
    r.dot === 'amber' ? 'text-[#E9730C]' :
    r.dot === 'red'   ? 'text-[#0A6ED1] font-semibold' :
                        'text-[#333]';
  return (
    <div className="inline-flex items-center gap-1.5">
      <Dot dot={r.dot} />
      <span className={`font-mono text-[11px] ${cls}`}>
        {fmtIST(new Date(plan), 'dd MMM')}
      </span>
      <span className="text-[9.5px] text-[#555]">{r.label}</span>
    </div>
  );
}
