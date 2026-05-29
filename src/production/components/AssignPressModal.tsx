// Minimal Assign-Press modal — pick a queued job + idle press.
// Mirrors MRT v2 mock (lines 1042-1073) but uses Tailwind + the existing
// Button component for consistency with the CRM look.

import { useState } from 'react';
import { X } from 'lucide-react';
import type { Press, ProductionJob } from '../lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  jobs: ProductionJob[];          // candidate jobs (queued, no press)
  presses: Press[];               // all presses (idle highlighted)
  preselectPressId?: string | null;
  preselectJobId?: string | null;
  onConfirm: (jobId: string, pressId: string) => Promise<void> | void;
}

export function AssignPressModal({
  open, onClose, jobs, presses, preselectPressId, preselectJobId, onConfirm,
}: Props) {
  const [jobId, setJobId] = useState<string>(preselectJobId ?? '');
  const [pressId, setPressId] = useState<string>(preselectPressId ?? '');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submit = async () => {
    if (!jobId || !pressId) return;
    setBusy(true);
    try { await onConfirm(jobId, pressId); onClose(); }
    finally { setBusy(false); }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[300] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[4px] w-full max-w-[480px] shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-g200 flex items-center justify-between">
          <div className="text-[13px] font-semibold text-blk">Assign Job to Press</div>
          <button onClick={onClose} className="text-g500 hover:text-blk"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="block text-[10.5px] font-mono font-bold tracking-wider uppercase text-g500 mb-1">
              Select Job <span className="text-red-mrt">*</span>
            </label>
            <select
              value={jobId}
              onChange={e => setJobId(e.target.value)}
              className="w-full border border-g300 rounded-[3px] px-2 py-1.5 text-[12.5px] focus:border-red-mrt focus:ring-2 focus:ring-red-lt outline-none"
            >
              <option value="">— Select job (sorted by LSD) —</option>
              {jobs
                .slice()
                .sort((a, b) => {
                  if (a.priority === 'emergency' && b.priority !== 'emergency') return -1;
                  if (b.priority === 'emergency' && a.priority !== 'emergency') return 1;
                  return (a.lsd || '').localeCompare(b.lsd || '');
                })
                .map(j => (
                  <option key={j.id} value={j.id}>
                    {j.priority === 'emergency' ? '🔴 ' : ''}
                    {j.id} — {j.product_desc} · {j.customer_name || '—'} · LSD {j.lsd || '—'}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-[10.5px] font-mono font-bold tracking-wider uppercase text-g500 mb-1">
              Select Press <span className="text-red-mrt">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {presses.map(p => {
                const busyPress = p.status !== 'idle';
                const selected = pressId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={busyPress}
                    onClick={() => setPressId(p.id)}
                    className={`text-left border rounded-[3px] px-2.5 py-2 transition-colors ${
                      selected
                        ? 'border-red-mrt bg-red-lt/30'
                        : 'border-g300 hover:border-red-mrt/50'
                    } ${busyPress ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="text-[12px] font-semibold text-blk">{p.name} · {p.tonnage}</div>
                    <div className={`text-[10px] ${busyPress ? 'text-red-mrt' : 'text-green-700'}`}>
                      {busyPress ? `✗ ${p.status}` : '✓ Available'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-g200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[12px] border border-g300 rounded-[3px] hover:bg-g100"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!jobId || !pressId || busy}
            className="px-3 py-1.5 text-[12px] bg-red-mrt text-white rounded-[3px] hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? 'Assigning…' : 'Assign to Press'}
          </button>
        </div>
      </div>
    </div>
  );
}
