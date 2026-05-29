// Dispatch tab — courier + consignment entry, confirm with OTD verdict.

import { Truck } from 'lucide-react';
import type { ProductionJob } from '../../lib/types';

interface Props {
  jobs: ProductionJob[];
  onConfirmDispatch: (job: ProductionJob) => void;     // opens dispatch modal
}

export function DispatchTab({ jobs, onConfirmDispatch }: Props) {
  const ready = jobs.filter(j => j.status !== 'dispatched');
  const dispatched = jobs.filter(j => j.status === 'dispatched');

  return (
    <div className="space-y-3">
      <div className="bg-white border border-g200 rounded-[3px] px-3 py-2 flex flex-wrap items-center gap-3 text-[12px]">
        <span className="text-g600">{jobs.length} job{jobs.length === 1 ? '' : 's'} in dispatch queue</span>
        {ready.length > 0 && (
          <span className="inline-block px-2 py-0.5 rounded-[2px] border bg-blue-100 text-blue-700 border-blue-200 text-[10px]">
            {ready.length} Pending Dispatch
          </span>
        )}
        <span className="ml-auto text-[11px] text-g500">Confirming dispatch logs OTD result automatically</span>
      </div>

      <div className="bg-white border border-g200 rounded-[3px]">
        {jobs.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-g400">No jobs ready to dispatch.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-g50">
                  <Th>Job ID</Th>
                  <Th>Product</Th>
                  <Th>Customer</Th>
                  <Th>Qty</Th>
                  <Th>Promised</Th>
                  <Th>Courier</Th>
                  <Th>Consignment</Th>
                  <Th>OTD</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.id} className="border-t border-g100 hover:bg-g50">
                    <Td>
                      {j.priority === 'emergency' && <span className="mr-1">🔴</span>}
                      <span className="text-red-mrt font-semibold">{j.id}</span>
                    </Td>
                    <Td>{j.product_desc}</Td>
                    <Td>{j.customer_name || '—'}</Td>
                    <Td>{j.qty.toLocaleString()}</Td>
                    <Td>{j.promised_date || '—'}</Td>
                    <Td>{j.courier || '—'}</Td>
                    <Td>{j.consignment_no || '—'}</Td>
                    <Td>
                      {j.otd_result === 'on-time' && <span className="text-green-700 font-semibold text-[11px]">✓ On Time</span>}
                      {j.otd_result === 'late'    && <span className="text-red-mrt font-semibold text-[11px]">✗ Late</span>}
                      {!j.otd_result && <span className="text-g400 text-[11px]">—</span>}
                    </Td>
                    <Td>
                      {j.status !== 'dispatched' ? (
                        <button
                          type="button"
                          onClick={() => onConfirmDispatch(j)}
                          className="text-[11px] text-green-700 border border-green-300 rounded px-2 py-1 hover:bg-green-50 flex items-center gap-1"
                        >
                          <Truck size={11} /> Confirm Dispatch
                        </button>
                      ) : (
                        <span className="text-[11px] text-g500">{j.dispatched_at ? new Date(j.dispatched_at).toLocaleString() : '✓'}</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dispatched.length === 0 && ready.length === 0 && jobs.length > 0 && (
        <div className="text-[11px] text-g500 text-center">No history yet.</div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left text-[10px] font-mono font-bold tracking-wider uppercase text-g500 px-2.5 py-2 whitespace-nowrap">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2.5 py-2 text-[12px] text-blk whitespace-nowrap">{children}</td>;
}
