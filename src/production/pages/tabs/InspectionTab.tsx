// Inspection tab — Pass / Fail-NCR / Rework actions.
// Mirrors MRT v2 renderInspection() (simplified).

import { Check, X, RotateCcw } from 'lucide-react';
import type { ProductionJob, Worker } from '../../lib/types';

interface Props {
  jobs: ProductionJob[];
  workers: Worker[];
  onPass:   (jobId: string) => void;
  onFail:   (job: ProductionJob) => void;     // opens NCR modal
  onRework: (jobId: string) => void;
}

export function InspectionTab({ jobs, workers, onPass, onFail, onRework }: Props) {
  const inspectors = workers.filter(w => w.department === 'inspection' && w.present).length;
  const pending = jobs.filter(j => j.status === 'pending' || j.inspection_result === 'pending' || j.status === 'in-progress');

  return (
    <div className="space-y-3">
      <div className="bg-white border border-g200 rounded-[3px] px-3 py-2 flex flex-wrap items-center gap-3 text-[12px]">
        <span><strong className="font-semibold">Active Inspectors:</strong> {inspectors}</span>
        <span className="text-g500">·</span>
        <span className="text-g600">{pending.length} lot{pending.length === 1 ? '' : 's'} awaiting inspection</span>
        <span className="ml-auto text-g500">~{inspectors * 2} lots/shift capacity</span>
      </div>

      <div className="bg-white border border-g200 rounded-[3px]">
        {jobs.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-g400">No jobs in Inspection.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-g50">
                  <Th>Lot / Job</Th>
                  <Th>Product</Th>
                  <Th>Customer</Th>
                  <Th>Qty</Th>
                  <Th>LSD</Th>
                  <Th>Promised</Th>
                  <Th>Batch</Th>
                  <Th>Result</Th>
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
                    <Td>{j.lsd || '—'}</Td>
                    <Td>{j.promised_date || '—'}</Td>
                    <Td>{j.batch_code || '—'}</Td>
                    <Td><ResultPill result={j.inspection_result} status={j.status} /></Td>
                    <Td>
                      {j.inspection_result === 'ncr' || j.status === 'ncr' ? (
                        <button
                          type="button"
                          onClick={() => onRework(j.id)}
                          className="text-[11px] text-orange-700 border border-orange-300 rounded px-2 py-1 hover:bg-orange-50 flex items-center gap-1"
                        >
                          <RotateCcw size={11} /> Rework
                        </button>
                      ) : j.inspection_result === 'passed' || j.status === 'passed' ? (
                        <span className="text-[11px] text-green-700">✓ Passed — advancing</span>
                      ) : (
                        <span className="inline-flex gap-1">
                          <button
                            type="button"
                            onClick={() => onPass(j.id)}
                            className="text-[11px] text-green-700 border border-green-300 rounded px-2 py-1 hover:bg-green-50 flex items-center gap-1"
                          >
                            <Check size={11} /> Pass
                          </button>
                          <button
                            type="button"
                            onClick={() => onFail(j)}
                            className="text-[11px] text-red-mrt border border-red-mrt/30 rounded px-2 py-1 hover:bg-red-lt flex items-center gap-1"
                          >
                            <X size={11} /> Fail / NCR
                          </button>
                        </span>
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
  );
}

function ResultPill({ result, status }: { result?: string | null; status: string }) {
  const v = result || status;
  const map: Record<string, string> = {
    passed: 'bg-green-100 text-green-700 border-green-200',
    ncr: 'bg-red-100 text-red-mrt border-red-200',
    pending: 'bg-g100 text-g600 border-g200',
    'in-progress': 'bg-blue-100 text-blue-700 border-blue-200',
  };
  return (
    <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-[2px] border ${map[v] || 'bg-g100 text-g600 border-g200'}`}>
      {v}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left text-[10px] font-mono font-bold tracking-wider uppercase text-g500 px-2.5 py-2 whitespace-nowrap">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2.5 py-2 text-[12px] text-blk whitespace-nowrap">{children}</td>;
}
