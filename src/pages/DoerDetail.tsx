import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';
import { fmtIST } from '../lib/utils';
import { type GlobalDateRangeLike, type DoerRole } from '../lib/types';
import {
  computeDoerMetrics, doerRowKey, buildDoerTimeline, doerStageWorkload, ROLE_WEIGHTS,
  type DoerMetrics, type TimelineRow, type StageWorkload, type RosterMemberLike,
} from '../lib/kpi';
import { ArrowLeft, Clock, Layers, CheckCircle2, XCircle, CircleDashed } from 'lucide-react';

const MS_DAY = 86400000;

function defaultRange(): GlobalDateRangeLike {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * MS_DAY);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}
function priorWindow(range: GlobalDateRangeLike): GlobalDateRangeLike {
  const s = range.startDate ? new Date(range.startDate).getTime() : Date.now() - 30 * MS_DAY;
  const e = range.endDate ? new Date(range.endDate).getTime() : Date.now();
  const len = Math.max(MS_DAY, e - s);
  return {
    startDate: new Date(s - len).toISOString().slice(0, 10),
    endDate: new Date(s - MS_DAY).toISOString().slice(0, 10),
  };
}
function fmtShortfall(v: number | null): string {
  return v == null ? '—' : `${v - 100}%`;
}
function fmtPctShort(v: number | null): string {
  return v == null ? '—' : `${v - 100}%`;
}
function fmtHours(v: number | null): string {
  if (v == null) return '—';
  if (v < 24) return `${v}h`;
  const d = Math.floor(v / 24); const h = v % 24;
  return h ? `${d}d ${h}h` : `${d}d`;
}

export function DoerDetail() {
  const { key = '' } = useParams();
  const navigate = useNavigate();
  const { data, globalDateRange } = useAppStore();
  const decodedKey = decodeURIComponent(key);

  const range: GlobalDateRangeLike = globalDateRange
    ? { startDate: globalDateRange.startDate, endDate: globalDateRange.endDate }
    : defaultRange();

  const roster = useMemo(() => data.roster.filter(m => m.active), [data.roster]);
  const metrics = useMemo(() => computeDoerMetrics(data, roster, range),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, range.startDate, range.endDate]);
  const prev = useMemo(() => computeDoerMetrics(data, roster, priorWindow(range)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, range.startDate, range.endDate]);

  const m: DoerMetrics | undefined = metrics.get(decodedKey);
  // The roster member behind this key (key = email|role).
  const member: RosterMemberLike | undefined = useMemo(() => {
    const [email, role] = decodedKey.split('|');
    return roster.find(r => r.email.toLowerCase() === email && r.role === (role as DoerRole));
  }, [roster, decodedKey]);

  const timeline = useMemo(() => member ? buildDoerTimeline(data, member, range) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, member, range.startDate, range.endDate]);
  const workload = useMemo(() => member ? doerStageWorkload(data, member) : [],
    [data, member]);

  if (!member || !m) {
    return (
      <div className="p-8">
        <button onClick={() => navigate('/doer-kpi')} className="inline-flex items-center gap-1.5 text-[12px] text-g500 hover:text-blk mb-4">
          <ArrowLeft size={14} /> Back to Doer KPI
        </button>
        <div className="bg-white rounded-[10px] border border-g200 p-8 text-center text-[13px] text-g500">
          This doer is no longer on the roster.
        </div>
      </div>
    );
  }

  const deferred = ROLE_WEIGHTS[m.role] == null;
  const prevM = prev.get(decodedKey);
  const delta = (m.composite != null && prevM?.composite != null) ? m.composite - prevM.composite : null;

  // Group timeline rows by date (already newest-first).
  const byDate = new Map<string, TimelineRow[]>();
  for (const row of timeline) {
    if (!byDate.has(row.date)) byDate.set(row.date, []);
    byDate.get(row.date)!.push(row);
  }

  return (
    <div className="p-6 lg:p-8 bg-cream min-h-full">
      <button onClick={() => navigate('/doer-kpi')} className="inline-flex items-center gap-1.5 text-[12px] text-g500 hover:text-blk mb-4">
        <ArrowLeft size={14} /> Back to Doer KPI
      </button>

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-[24px] font-bold text-blk">{member.display_name}</h1>
          <div className="text-[12px] text-g500 mt-0.5">{member.role} · {member.email}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[9px] font-bold tracking-[1.5px] uppercase text-g400">Shortfall</div>
          <div className={cn('font-sans text-[30px] leading-none font-bold tracking-tight',
            deferred || m.composite == null ? 'text-g300' : m.composite >= 100 ? 'text-emerald-600' : 'text-red-mrt')}>
            {deferred ? '—' : fmtShortfall(m.composite)}
          </div>
          {delta != null && (
            <div className={cn('text-[11px] font-semibold mt-0.5', delta >= 0 ? 'text-emerald-600' : 'text-red-500')}>
              {delta >= 0 ? '↑' : '↓'}{Math.abs(delta)} vs last period
            </div>
          )}
        </div>
      </div>

      {/* Metric strip (as shortfalls) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
        <MetricCard label="On-time gap" value={deferred ? '—' : fmtPctShort(m.onTimePct)} hint="below 100% on-time" />
        <MetricCard label="Volume" value={deferred ? '—' : String(m.volume)} hint="items handled" plain />
        <MetricCard label="Speed" value={deferred ? '—' : fmtHours(m.avgCycleH)} hint="avg cycle time" plain />
        <MetricCard label="Win gap" value={deferred ? '—' : fmtPctShort(m.winRate)} hint="below 100% win" />
      </div>

      {/* Stage workload */}
      {workload.length > 0 && (
        <div className="bg-white rounded-[10px] border border-g200 mt-6 overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-g100">
            <Layers size={15} className="text-g500" />
            <h2 className="font-mono text-[11px] font-bold tracking-[1.5px] uppercase text-g600">Stage Workload</h2>
            <span className="text-[10px] text-g400 ml-1">cards in the stages this role owns</span>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-g500 font-mono text-[9.5px] tracking-[1px] uppercase border-b border-g100">
                <th className="px-4 py-2.5 text-left font-bold">Stage</th>
                <th className="px-4 py-2.5 text-center font-bold text-red-mrt">Overdue</th>
                <th className="px-4 py-2.5 text-center font-bold text-emerald-600">On track</th>
                <th className="px-4 py-2.5 text-center font-bold">Total</th>
                <th className="px-4 py-2.5 text-right font-bold">TAT</th>
              </tr>
            </thead>
            <tbody>
              {workload.map((w: StageWorkload) => (
                <tr key={w.lane} className="border-b border-g50">
                  <td className="px-4 py-2.5 font-medium text-blk">{w.lane}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums font-semibold text-red-mrt">{w.pending || '—'}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-emerald-600">{w.done || '—'}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-g600">{w.total}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-g400">{fmtHours(w.tatHours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Behaviour timeline */}
      <div className="bg-white rounded-[10px] border border-g200 mt-6 overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-g100">
          <Clock size={15} className="text-g500" />
          <h2 className="font-mono text-[11px] font-bold tracking-[1.5px] uppercase text-g600">Work History</h2>
          <span className="text-[10px] text-g400 ml-1">done &amp; overdue, newest first</span>
        </div>
        <div className="p-4">
          {byDate.size === 0 ? (
            <div className="text-[12px] text-g400 py-6 text-center">No activity in this period.</div>
          ) : (
            <div className="space-y-4">
              {[...byDate.entries()].map(([date, dayRows]) => (
                <div key={date}>
                  <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-g500 mb-2">
                    {fmtIST(new Date(date), 'EEE, dd MMM yyyy')}
                  </div>
                  <ul className="space-y-1.5">
                    {dayRows.map((row, i) => (
                      <li key={i} className="flex gap-3 text-[12px]">
                        <span className="font-mono text-[10.5px] text-g400 w-[58px] shrink-0 pt-0.5">
                          {fmtIST(new Date(row.ts), 'hh:mm a')}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <StatusBadge row={row} />
                            <span className="text-g700 truncate">{row.activity}</span>
                            <span className="text-g400 truncate hidden sm:inline">· {row.cust}</span>
                          </div>
                          {row.note && <div className="text-[11px] text-g500 mt-0.5 leading-snug">{row.note}</div>}
                          {row.nextSummary && (
                            <div className="text-[10.5px] text-red-mrt/80 mt-0.5 leading-snug">
                              <span className="font-semibold">next:</span> {row.nextSummary}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, hint, plain }: { label: string; value: string; hint: string; plain?: boolean }) {
  const negative = !plain && value !== '—' && value !== '0%';
  return (
    <div className="bg-white rounded-[10px] border border-g200 p-4 shadow-sm">
      <div className="font-mono text-[9px] font-bold tracking-[1.2px] uppercase text-g500">{label}</div>
      <div className={cn('font-sans text-[22px] leading-none font-bold tracking-tight mt-1.5',
        negative ? 'text-red-mrt' : 'text-blk')}>{value}</div>
      <div className="text-[9.5px] text-g400 mt-1">{hint}</div>
    </div>
  );
}

function StatusBadge({ row }: { row: TimelineRow }) {
  if (row.kind === 'pending') {
    // onTime === false → overdue (past due); null → upcoming (not yet due).
    return row.onTime === false
      ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-mrt shrink-0"><XCircle size={12} /> overdue</span>
      : <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 shrink-0"><Clock size={12} /> due</span>;
  }
  if (row.onTime === true) {
    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 shrink-0"><CheckCircle2 size={12} /> on-time</span>;
  }
  if (row.onTime === false) {
    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-mrt shrink-0"><XCircle size={12} /> late</span>;
  }
  return <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-g400 shrink-0"><CircleDashed size={12} /> logged</span>;
}
