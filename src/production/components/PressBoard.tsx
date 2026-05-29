// Live Press Board — 4 cards, one per press.
// Reads from props; no fetching of its own.

import type { Press, ProductionJob } from '../lib/types';

interface Props {
  presses: Press[];
  jobs: ProductionJob[];
  onAssign?: (pressId: string) => void;
  onMarkDone?: (pressId: string) => void;
}

const DOT: Record<Press['status'], string> = {
  idle: 'bg-g300',
  setup: 'bg-orange-400',
  running: 'bg-green-500',
  maintenance: 'bg-g500',
};

const BAR: Record<Press['status'], string> = {
  idle: 'bg-g200',
  setup: 'bg-orange-400',
  running: 'bg-green-500',
  maintenance: 'bg-g300',
};

export function PressBoard({ presses, jobs, onAssign, onMarkDone }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {presses.map(p => {
        const job = jobs.find(j => j.id === p.active_job_id);
        const emergency = job?.priority === 'emergency';
        return (
          <div
            key={p.id}
            className={`bg-white border rounded-[3px] p-3 ${
              emergency ? 'border-red-mrt/40 border-l-2 border-l-red-mrt' : 'border-g200'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[9px] font-bold tracking-[0.5px] uppercase text-g500">
                {p.name} · {p.tonnage}
              </span>
              <span className={`w-2 h-2 rounded-full ${DOT[p.status]}`} />
            </div>

            {job ? (
              <>
                <div className="text-[12px] font-semibold text-blk">
                  {emergency && <span className="text-red-mrt">🔴 </span>}
                  {job.id}
                </div>
                <div className="text-[10px] text-g500 leading-snug mb-2">
                  {job.product_desc}
                  <br />
                  {job.customer_name}
                </div>
              </>
            ) : (
              <>
                <div className="text-[12px] font-semibold text-g400">IDLE</div>
                <div className="text-[10px] text-g400 mb-2">{p.eta_text || 'Awaiting job'}</div>
              </>
            )}

            <div className="h-1 bg-g100 rounded-full overflow-hidden">
              <div
                className={`h-full ${BAR[p.status]} transition-all`}
                style={{ width: `${p.pct_done || 0}%` }}
              />
            </div>
            <div className="text-[9px] text-g500 mt-1">
              {p.pct_done ? `${p.pct_done}% · ${p.eta_text || ''}` : p.eta_text || '—'}
            </div>

            {p.status === 'idle' && onAssign && (
              <button
                onClick={() => onAssign(p.id)}
                className="mt-2 w-full text-[10px] font-medium text-red-mrt border border-red-mrt/30 rounded px-2 py-1 hover:bg-red-lt"
              >
                + Assign Job
              </button>
            )}
            {(p.status === 'running' || p.status === 'setup') && onMarkDone && (
              <button
                onClick={() => onMarkDone(p.id)}
                className="mt-2 w-full text-[10px] font-medium text-green-700 border border-green-300 rounded px-2 py-1 hover:bg-green-50"
              >
                {p.status === 'setup' ? '✓ Mark Running' : '✓ Mark Done'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
