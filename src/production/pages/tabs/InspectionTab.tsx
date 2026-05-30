// Inspection tab — Pass / Fail-NCR / Rework.

import { Check, X, RotateCcw } from 'lucide-react';
import { Button } from '../../../components/ui';
import {
  Table, THead, TH, TR, TD, EmptyRow, StatusPill,
} from '../../components/table';
import type { ProductionJob, Worker } from '../../lib/types';

interface Props {
  jobs: ProductionJob[];
  workers: Worker[];
  onPass:   (jobId: string) => void;
  onFail:   (job: ProductionJob) => void;
  onRework: (jobId: string) => void;
}

export function InspectionTab({ jobs, workers, onPass, onFail, onRework }: Props) {
  const inspectors = workers.filter(w => w.department === 'inspection' && w.present).length;
  const pending = jobs.filter(j =>
    j.inspection_result === 'pending' || j.status === 'pending' || j.status === 'in-progress'
  );

  return (
    <div className="space-y-3">
      <div className="bg-white border border-g200 rounded-[3px] px-3 py-2.5 flex flex-wrap items-center gap-3 text-[12px]">
        <span><strong className="text-blk">{inspectors}</strong> <span className="text-g500">active inspectors</span></span>
        <span className="text-g300">·</span>
        <span className="text-g500">{pending.length} lot{pending.length === 1 ? '' : 's'} awaiting</span>
        <span className="ml-auto font-mono text-[10px] text-g500">
          ~{inspectors * 2} lots/shift capacity
        </span>
      </div>

      <Table>
        <THead>
          <tr>
            <TH>Lot / Job</TH>
            <TH>Product</TH>
            <TH>Customer</TH>
            <TH>Qty</TH>
            <TH>LSD</TH>
            <TH>Promised</TH>
            <TH>Batch</TH>
            <TH>Result</TH>
            <TH>Action</TH>
          </tr>
        </THead>
        <tbody>
          {jobs.length === 0 ? (
            <EmptyRow colSpan={9} text="No jobs in Inspection." />
          ) : jobs.map(j => (
            <TR key={j.id}>
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
              <TD className="font-mono text-[11px]">{j.batch_code || '—'}</TD>
              <TD><ResultPill result={j.inspection_result} status={j.status} /></TD>
              <TD>
                {j.inspection_result === 'ncr' || j.status === 'ncr' ? (
                  <Button variant="ghost" size="sm" onClick={() => onRework(j.id)} className="gap-1">
                    <RotateCcw size={11} /> Rework
                  </Button>
                ) : j.inspection_result === 'passed' || j.status === 'passed' ? (
                  <span className="text-[11px] text-sW">✓ Passed — advancing</span>
                ) : (
                  <div className="inline-flex gap-1">
                    <Button variant="success" size="sm" onClick={() => onPass(j.id)} className="gap-1">
                      <Check size={11} /> Pass
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => onFail(j)} className="gap-1">
                      <X size={11} /> Fail / NCR
                    </Button>
                  </div>
                )}
              </TD>
            </TR>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

function ResultPill({ result, status }: { result?: string | null; status: string }) {
  const v = result || status;
  if (v === 'passed') return <StatusPill status="Passed" tone="good" />;
  if (v === 'ncr')    return <StatusPill status="NCR"     tone="bad" />;
  if (v === 'in-progress') return <StatusPill status="In Progress" tone="info" />;
  return <StatusPill status="Pending" tone="neutral" />;
}
