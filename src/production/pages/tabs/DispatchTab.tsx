// Dispatch tab — courier + consignment entry, confirm with OTD verdict.
// Includes a time-bound Undo for fat-fingered confirms.

import { useState } from 'react';
import { Truck, Undo2, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui';
import {
  Table, THead, TH, TR, TD, EmptyRow, StatusPill,
} from '../../components/table';
import { fmtIST } from '../../../lib/utils';
import type { ProductionJob } from '../../lib/types';
import {
  canUndoDispatch, undoDispatch, UNDO_DISPATCH_WINDOW_MIN,
} from '../../lib/actions';

interface Props {
  jobs: ProductionJob[];
  onConfirmDispatch: (job: ProductionJob) => void;
  onChanged?: () => void | Promise<void>;
}

export function DispatchTab({ jobs, onConfirmDispatch, onChanged }: Props) {
  const ready = jobs.filter(j => j.status !== 'dispatched');
  const lateCount = jobs.filter(j => j.otd_result === 'late').length;
  const [undoing, setUndoing] = useState<string | null>(null);

  const handleUndo = async (job: ProductionJob) => {
    const reason = window.prompt(
      `Undo dispatch for ${job.id}?\n\n` +
      `This returns the job to "Ready" and clears the OTD verdict.\n` +
      `Only possible within ${UNDO_DISPATCH_WINDOW_MIN} minutes of confirming.\n\n` +
      `Reason (will be logged):`,
      ''
    );
    if (reason === null) return;          // cancelled
    setUndoing(job.id);
    try {
      await undoDispatch(job.id, reason.trim());
      await onChanged?.();
    } catch (e: any) {
      alert(e?.message || 'Undo failed.');
    } finally {
      setUndoing(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="bg-white border border-g200 rounded-[3px] px-3 py-2.5 flex flex-wrap items-center gap-3 text-[12px]">
        <span className="text-g500">{jobs.length} job{jobs.length === 1 ? '' : 's'} in dispatch queue</span>
        {ready.length > 0 && (
          <StatusPill status={`${ready.length} Pending`} tone="info" />
        )}
        {lateCount > 0 && (
          <StatusPill status={`${lateCount} Late`} tone="bad" />
        )}
        <span className="ml-auto text-[11px] text-g500">
          Confirming dispatch logs OTD · Undo available for {UNDO_DISPATCH_WINDOW_MIN} min
        </span>
      </div>

      <Table>
        <THead>
          <tr>
            <TH>Job ID</TH>
            <TH>Product</TH>
            <TH>Customer</TH>
            <TH>Qty</TH>
            <TH>Promised</TH>
            <TH>Courier</TH>
            <TH>Consignment</TH>
            <TH>OTD</TH>
            <TH>Action</TH>
          </tr>
        </THead>
        <tbody>
          {jobs.length === 0 ? (
            <EmptyRow colSpan={9} text="No jobs ready to dispatch." />
          ) : jobs.map(j => {
            const isUndoing = undoing === j.id;
            const undoable = canUndoDispatch(j);
            return (
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
                <TD className="text-[12px]">{j.courier || <span className="text-g400">—</span>}</TD>
                <TD className="font-mono text-[11px] text-g600">{j.consignment_no || <span className="text-g400">—</span>}</TD>
                <TD>
                  {j.otd_result === 'on-time' && <span className="text-sW font-semibold text-[11px]">✓ On Time</span>}
                  {j.otd_result === 'late'    && <span className="text-red-mrt font-semibold text-[11px]">✗ Late</span>}
                  {!j.otd_result && <span className="text-g400 text-[11px]">—</span>}
                </TD>
                <TD>
                  {j.status !== 'dispatched' ? (
                    <Button variant="success" size="sm" onClick={() => onConfirmDispatch(j)} className="gap-1">
                      <Truck size={11} /> Confirm
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-[10.5px] font-mono text-g500">
                        {j.dispatched_at ? fmtIST(new Date(j.dispatched_at), 'dd MMM HH:mm') : '✓'}
                      </span>
                      {undoable && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleUndo(j)}
                          disabled={isUndoing}
                          className="gap-1"
                          title={`Reversible for ${UNDO_DISPATCH_WINDOW_MIN} min after dispatch`}
                        >
                          {isUndoing ? <Loader2 size={11} className="animate-spin" /> : <Undo2 size={11} />}
                          Undo
                        </Button>
                      )}
                    </div>
                  )}
                </TD>
              </TR>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
