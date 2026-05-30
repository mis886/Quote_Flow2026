// PDI tab — list awaiting Pre-Despatch Inspection approval.

import { CheckCircle2 } from 'lucide-react';
import { Button } from '../../../components/ui';
import {
  Table, THead, TH, TR, TD, EmptyRow,
} from '../../components/table';
import { fmtIST } from '../../../lib/utils';
import type { ProductionJob } from '../../lib/types';

interface Props {
  jobs: ProductionJob[];
  onApprove: (job: ProductionJob) => void;
}

export function PDITab({ jobs, onApprove }: Props) {
  return (
    <div className="space-y-3">
      <div className="bg-white border border-g200 rounded-[3px] px-3 py-2.5 flex items-center gap-3 text-[12px]">
        <span className="text-g500">{jobs.length} job{jobs.length === 1 ? '' : 's'} awaiting Pre-Despatch Inspection</span>
        <span className="ml-auto text-[11px] text-sP">⚠ Approving moves directly to Ready to Dispatch</span>
      </div>

      <Table>
        <THead>
          <tr>
            <TH>Job ID</TH>
            <TH>Product</TH>
            <TH>Customer</TH>
            <TH>Qty</TH>
            <TH>Promised</TH>
            <TH>Inspection Passed</TH>
            <TH>PDI Officer</TH>
            <TH>Action</TH>
          </tr>
        </THead>
        <tbody>
          {jobs.length === 0 ? (
            <EmptyRow colSpan={8} text="No jobs awaiting PDI." />
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
              <TD className="font-mono text-[11px] text-g600">{j.promised_date || '—'}</TD>
              <TD className="font-mono text-[11px] text-g600">
                {j.inspection_passed_at ? fmtIST(new Date(j.inspection_passed_at), 'dd MMM HH:mm') : '—'}
              </TD>
              <TD className="text-[12px]">{j.pdi_officer || <span className="text-g400">—</span>}</TD>
              <TD>
                <Button variant="success" size="sm" onClick={() => onApprove(j)} className="gap-1">
                  <CheckCircle2 size={11} /> Approve PDI
                </Button>
              </TD>
            </TR>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
