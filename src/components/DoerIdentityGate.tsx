import React, { useMemo, useState } from 'react';
import { useAppStore } from '../store';
import { verifyDoerPassword, hasPassword } from '../lib/doerAuth';
import { UserCircle2, Lock } from 'lucide-react';
import { cn } from '../lib/utils';
import type { TeamMember } from '../lib/types';

// Post-login "who are you?" prompt. A Google login may be shared by several
// doers (e.g. accounts@ → Data Entry Operator / Pankaj / PI Sender); the person
// picks which doer they are (+ password if set). The chosen display_name is then
// stamped on everything they do this session. Shown by Layout when no activeDoer.
export function DoerIdentityGate({ candidates }: { candidates: TeamMember[] }) {
  const { setActiveDoer, user } = useAppStore();
  const [selKey, setSelKey] = useState<string | null>(candidates.length === 1 ? keyOf(candidates[0]) : null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const selected = useMemo(
    () => candidates.find(c => keyOf(c) === selKey) ?? null,
    [candidates, selKey],
  );

  const confirm = async () => {
    if (!selected) { setError('Pick your name to continue.'); return; }
    setBusy(true);
    try {
      const ok = await verifyDoerPassword(selected, password);
      if (!ok) { setError('Incorrect password.'); setPassword(''); return; }
      setActiveDoer({ email: selected.email, display_name: selected.display_name, role: selected.role });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-cream flex items-center justify-center p-6">
      <div className="w-[360px] bg-white border border-g200 rounded-[8px] shadow-lg p-7 flex flex-col gap-5">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-red-lt text-red-mrt flex items-center justify-center mx-auto mb-3">
            <UserCircle2 size={24} />
          </div>
          <div className="font-serif text-[18px] text-blk tracking-tight">Who's working?</div>
          <div className="text-[11.5px] text-g400 mt-1">
            Signed in as {user?.email}. Pick your name so your work is tracked to you.
          </div>
        </div>

        <div className="space-y-1.5">
          {candidates.map(c => {
            const k = keyOf(c);
            const active = selKey === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => { setSelKey(k); setError(''); setPassword(''); }}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-[4px] border text-left transition-colors',
                  active ? 'border-red-mrt bg-red-lt/40' : 'border-g200 hover:bg-g50',
                )}
              >
                <span>
                  <span className="text-[13px] font-semibold text-blk">{c.display_name}</span>
                  <span className="text-[11px] text-g400 ml-1.5">{c.role}</span>
                </span>
                {hasPassword(c) && <Lock size={12} className="text-g400 shrink-0" />}
              </button>
            );
          })}
        </div>

        {selected && hasPassword(selected) && (
          <input
            type="password"
            autoFocus
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && confirm()}
            placeholder="Password"
            className="w-full font-sans text-[13px] border border-g300 rounded-[3px] px-3 py-2.5 outline-none focus:border-red-mrt focus:ring-[3px] focus:ring-red-lt"
          />
        )}

        {error && <p className="text-[11.5px] text-red-mrt font-medium -mt-1">{error}</p>}

        <button
          type="button"
          onClick={confirm}
          disabled={busy || !selected}
          className="w-full h-10 bg-blk text-white text-[13px] font-semibold rounded-[3px] hover:bg-g700 disabled:opacity-50 transition-colors"
        >
          {busy ? 'Checking…' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

function keyOf(m: TeamMember): string {
  return `${m.email.toLowerCase()}|${m.role}`;
}
