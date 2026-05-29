// PDI tab — list awaiting PDI approval.

import { CheckCircle2 } from 'lucide-react';
import type { ProductionJob } from '../../lib/types';

interface Props {
  jobs: ProductionJob[];
  onApprove: (job: ProductionJob) => void;     // opens approval modal
}

export function PDITab({ jobs, onApprove }: Props) {
  return (
    <div className="space-y-3">
      <div className="bg-white border border-g200 rounded-[3px] px-3 py-2 flex items-center gap-3 text-[12px]">
        <span className="text-g600">{jobs.length} job{jobs.length === 1 ? '' : 's'} awaiting Pre-Despatch Inspection</span>
        <span className="ml-auto text-[11px] text-orange-700">⚠ Approving here moves directly to Ready to Dispatch</span>
      </div>

      <div className="bg-white border border-g200 rounded-[3px]">
        {jobs.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-g400">No jobs awaiting PDI.</div>
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
                  <Th>Insp. Passed</Th>
                  <Th>PDI Officer</Th>
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
                    <Td>{j.inspection_passed_at ? new Date(j.inspection_passed_at).toLocaleString() : '—'}</Td>
                    <Td>{j.pdi_officer || '—'}</Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => onApprove(j)}
                        className="text-[11px] text-green-700 border border-green-300 rounded px-2 py-1 hover:bg-green-50 flex items-center gap-1"
                      >
                        <CheckCircle2 size={11} /> Approve PDI
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left text-[10px] font-mono font-bold tracking-wider uppercase text-g500 px-2.5 py-2 whitespace-nowrap">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2.5 py-2 text-[12px] text-blk whitespace-nowrap">{children}</td>;
}
