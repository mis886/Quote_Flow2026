// Finishing tab — capacity row + live OTD-impact queue.
// Ports MRT v2 renderFinishing() with simplified columns.

import { useState, useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import type { ProductionJob, Worker, ShopFloorSettings } from '../../lib/types';
import { setJobQtyDone } from '../../lib/actions';
import { getJobImpact } from '../../lib/otdImpact';

interface Props {
  jobs: ProductionJob[];
  workers: Worker[];
  settings: ShopFloorSettings | null;
  onQtyDoneChange: () => void | Promise<void>;
  onAdvance: (jobId: string) => void | Promise<void>;
}

export function FinishingTab({ jobs, workers, settings, onQtyDoneChange, onAdvance }: Props) {
  const finishers  = workers.filter(w => w.department === 'finishing'  && w.present).length;
  const inspectors = workers.filter(w => w.department === 'inspection' && w.present).length;
  const hc = { finishers: Math.max(1, finishers), inspectors: Math.max(1, inspectors) };

  const impacts = useMemo(() =>
    jobs.map(j => ({ job: j, impact: getJobImpact(j, hc) }))
        .sort((a, b) => {
          const r = { breach: 0, atrisk: 1, safe: 2 } as const;
          return r[a.impact.risk] - r[b.impact.risk];
        }),
    [jobs, hc.finishers, hc.inspectors]
  );

  const atRiskCount = impacts.filter(i => i.impact.risk !== 'safe').length;

  return (
    <div className="space-y-3">
      {/* Capacity row */}
      <div className="bg-white border border-g200 rounded-[3px] px-3 py-2 flex flex-wrap items-center gap-3 text-[12px]">
        <span><strong className="font-semibold">Finishers present:</strong> {finishers}</span>
        <span className="text-g500">·</span>
        <span><strong className="font-semibold">Inspectors:</strong> {inspectors}</span>
        {settings && (
          <>
            <span className="text-g500">·</span>
            <span className="text-g600">Shift hrs left: <strong>{settings.shift_hours_left}h</strong></span>
            <span className="text-g500">·</span>
            <span className="text-g600">OT budget: <strong>{settings.overtime_max}h</strong></span>
          </>
        )}
        <span className="ml-auto text-g500">{jobs.length} job{jobs.length === 1 ? '' : 's'} in queue</span>
      </div>

      {atRiskCount > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-[3px] px-3 py-2 text-[12px] text-orange-900">
          <strong>{atRiskCount}</strong> of {impacts.length} jobs in this queue are projected to miss their promised date.
          Adjust headcount on Shift Briefing or authorise OT.
        </div>
      )}

      <div className="bg-white border border-g200 rounded-[3px]">
        {jobs.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-g400">No jobs in Finishing.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-g50">
                  <Th>Job ID</Th>
                  <Th>Product</Th>
                  <Th>Customer</Th>
                  <Th>Qty</Th>
                  <Th>Pcs Done</Th>
                  <Th>Rem. TAT</Th>
                  <Th>Buffer</Th>
                  <Th>Risk</Th>
                  <Th>LSD</Th>
                  <Th>Promised</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {impacts.map(({ job, impact }) => (
                  <FinishingRow
                    key={job.id}
                    job={job}
                    remHrs={impact.remHrs}
                    bufferHrs={impact.bufferHrs}
                    risk={impact.risk}
                    onQtyDoneSaved={onQtyDoneChange}
                    onAdvance={() => onAdvance(job.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FinishingRow({
  job, remHrs, bufferHrs, risk, onQtyDoneSaved, onAdvance,
}: {
  job: ProductionJob;
  remHrs: number;
  bufferHrs: number;
  risk: 'safe' | 'atrisk' | 'breach';
  onQtyDoneSaved: () => void | Promise<void>;
  onAdvance: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(String(job.qty_done || 0));
  const [saving, setSaving] = useState(false);

  const commit = async () => {
    const n = Math.max(0, Math.min(job.qty, Math.floor(Number(draft) || 0)));
    setSaving(true);
    try {
      await setJobQtyDone(job.id, n);
      await onQtyDoneSaved();
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const riskCls = risk === 'breach'
    ? 'bg-red-100 text-red-mrt border-red-200'
    : risk === 'atrisk'
    ? 'bg-orange-100 text-orange-700 border-orange-200'
    : 'bg-green-100 text-green-700 border-green-200';

  return (
    <tr className="border-t border-g100 hover:bg-g50">
      <Td>
        {job.priority === 'emergency' && <span className="mr-1">🔴</span>}
        <span className="text-red-mrt font-semibold">{job.id}</span>
      </Td>
      <Td>{job.product_desc}</Td>
      <Td>{job.customer_name || '—'}</Td>
      <Td>{job.qty.toLocaleString()}</Td>
      <Td>
        {editing ? (
          <span className="inline-flex items-center gap-1">
            <input
              type="number"
              autoFocus
              value={draft}
              min={0}
              max={job.qty}
              onChange={e => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
              className="w-[70px] text-[11px] border border-g300 rounded px-1.5 py-0.5 focus:outline-none focus:border-red-mrt"
              title="Pieces done"
            />
            {saving && <span className="text-[10px] text-g400">…</span>}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => { setDraft(String(job.qty_done || 0)); setEditing(true); }}
            className="text-blk hover:bg-g100 border border-dashed border-g300 rounded px-1.5 py-0.5 text-[11.5px]"
            title="Click to edit"
          >
            {(job.qty_done || 0).toLocaleString()} ✎
          </button>
        )}
      </Td>
      <Td>{fmtHrs(remHrs)}</Td>
      <Td>
        <span className={bufferHrs < 0 ? 'text-red-mrt font-semibold' : 'text-green-700'}>
          {bufferHrs >= 0 ? '+' : ''}{fmtHrs(bufferHrs)}
        </span>
      </Td>
      <Td>
        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-[2px] border uppercase tracking-wider ${riskCls}`}>
          {risk}
        </span>
      </Td>
      <Td>{job.lsd || '—'}</Td>
      <Td>{job.promised_date || '—'}</Td>
      <Td>
        <button
          type="button"
          onClick={onAdvance}
          className="text-[11px] text-green-700 border border-green-300 rounded px-2 py-1 hover:bg-green-50 flex items-center gap-1"
        >
          <ArrowRight size={11} /> To Inspection
        </button>
      </Td>
    </tr>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left text-[10px] font-mono font-bold tracking-wider uppercase text-g500 px-2.5 py-2 whitespace-nowrap">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2.5 py-2 text-[12px] text-blk whitespace-nowrap">{children}</td>;
}

function fmtHrs(h: number) {
  if (!isFinite(h)) return '—';
  const abs = Math.abs(h);
  if (abs >= 24) return `${(h / 24).toFixed(1)}d`;
  return `${h.toFixed(1)}h`;
}
