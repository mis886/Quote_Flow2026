import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';
import { DOER_ROLES, type DoerRole, type GlobalDateRangeLike } from '../lib/types';
import { computeDoerMetrics, doerRowKey, ROLE_WEIGHTS, type DoerMetrics, type DueItem } from '../lib/kpi';
import { Gauge, Trophy, Clock, TrendingUp, Users, ChevronDown } from 'lucide-react';
import { BulkLogSidePanel } from '../components/BulkLogSidePanel';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const MS_DAY = 86400000;

const ROLE_META: Record<DoerRole, { color: keyof typeof CARD_COLORS; headline: string }> = {
  'DEO':         { color: 'blue',   headline: 'volume' },
  'Rate Entry':  { color: 'purple', headline: 'speed' },
  'SC_1':        { color: 'green',  headline: 'onTime' },
  'Negotiation': { color: 'orange', headline: 'win' },
  'PI Sender':   { color: 'red',    headline: 'deferred' },
  'Other':       { color: 'blue',   headline: 'composite' },
};

const CARD_COLORS = {
  blue:   { top: 'border-t-blue-500',    iconBg: 'bg-blue-50',    iconText: 'text-blue-500'    },
  purple: { top: 'border-t-purple-500',  iconBg: 'bg-purple-50',  iconText: 'text-purple-500'  },
  green:  { top: 'border-t-emerald-500', iconBg: 'bg-emerald-50', iconText: 'text-emerald-500' },
  orange: { top: 'border-t-orange-500',  iconBg: 'bg-orange-50',  iconText: 'text-orange-500'  },
  red:    { top: 'border-t-red-500',     iconBg: 'bg-red-50',     iconText: 'text-red-500'     },
};

// Default range when no global filter is set: trailing 30 days.
function defaultRange(): GlobalDateRangeLike {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * MS_DAY);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

// Equal-length window immediately preceding `range`.
function priorWindow(range: GlobalDateRangeLike): GlobalDateRangeLike {
  const s = range.startDate ? new Date(range.startDate).getTime() : Date.now() - 30 * MS_DAY;
  const e = range.endDate ? new Date(range.endDate).getTime() : Date.now();
  const len = Math.max(MS_DAY, e - s);
  return {
    startDate: new Date(s - len).toISOString().slice(0, 10),
    endDate: new Date(s - MS_DAY).toISOString().slice(0, 10),
  };
}

function fmtPct(v: number | null): string { return v == null ? '—' : `${v}%`; }
function fmtHours(v: number | null): string {
  if (v == null) return '—';
  if (v < 24) return `${v}h`;
  const d = Math.floor(v / 24); const h = v % 24;
  return h ? `${d}d ${h}h` : `${d}d`;
}

// Shortfall = how far below 100% a metric sits, shown as a negative %.
// null (no data) stays null → rendered as '—', never a fabricated −100%.
function shortfall(v: number | null): number | null {
  return v == null ? null : v - 100;
}
function fmtShortfall(v: number | null): string {
  const s = shortfall(v);
  return s == null ? '—' : `${s}%`; // s ≤ 0 already carries the minus sign
}

export function DoerKPI() {
  const { data, globalDateRange } = useAppStore();
  const navigate = useNavigate();
  const roster = data.roster.filter(m => m.active);

  const range: GlobalDateRangeLike = globalDateRange
    ? { startDate: globalDateRange.startDate, endDate: globalDateRange.endDate }
    : defaultRange();

  const current = useMemo(() => computeDoerMetrics(data, roster, range),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, range.startDate, range.endDate]);
  const previous = useMemo(() => computeDoerMetrics(data, roster, priorWindow(range)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, range.startDate, range.endDate]);

  const rows = useMemo(() => {
    const arr = [...current.values()];
    return arr.sort((a, b) => (b.composite ?? -1) - (a.composite ?? -1));
  }, [current]);

  const [sortKey, setSortKey] = useState<'composite' | 'onTimePct' | 'volume' | 'avgCycleH' | 'winRate'>('composite');
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? (sortKey === 'avgCycleH' ? Infinity : -1);
      const bv = b[sortKey] ?? (sortKey === 'avgCycleH' ? Infinity : -1);
      return sortKey === 'avgCycleH' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [rows, sortKey]);

  // Trend picker — user can switch who's shown; default = top performer.
  const firstKey = rows[0] ? doerRowKey(rows[0].email, rows[0].role) : undefined;
  const [trendKey, setTrendKey] = useState<string | undefined>(undefined);
  const activeTrendKey = trendKey ?? firstKey;
  const trendData = useMemo(() => buildTrend(data, roster, activeTrendKey),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, activeTrendKey]);

  // Bulk-log slide-over: opened from Due Next Week with a batch of follow-up items.
  const [bulkLog, setBulkLog] = useState<{ context: string; items: DueItem[] } | null>(null);

  // Headline metric per role for the top cards (best performer in that role).
  const roleCards = DOER_ROLES.filter(r => r !== 'Other').map(role => {
    const members = rows.filter(m => m.role === role);
    const best = members.reduce<DoerMetrics | null>((acc, m) =>
      (m.composite ?? -1) > (acc?.composite ?? -1) ? m : acc, null);
    return { role, members, best };
  });

  if (roster.length === 0) {
    return (
      <div className="p-8 max-w-2xl">
        <PageHeader />
        <div className="mt-6 bg-white rounded-[10px] border border-g200 p-8 text-center">
          <Users size={32} className="mx-auto text-g300 mb-3" />
          <div className="font-sans text-[15px] font-semibold text-blk">No team roster yet</div>
          <p className="text-[12px] text-g500 mt-1.5">
            Add your doers in <span className="font-semibold">Settings → Team Roster</span> to start scoring.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 bg-cream min-h-full">
      <PageHeader />

      {/* ── Role cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-5">
        {roleCards.map(({ role, best, members }) => {
          const meta = ROLE_META[role];
          const c = CARD_COLORS[meta.color];
          const prev = best ? previous.get(doerRowKey(best.email, best.role)) : undefined;
          // Shown as SHORTFALL (gap below 100%). best = highest composite =
          // smallest shortfall. Delta: composite up = improving = up arrow.
          let value = '—'; let deltaTxt = ''; let deltaDir: 'up' | 'dn' | null = null;
          if (role === 'PI Sender') {
            value = '—';
          } else if (best) {
            value = fmtShortfall(best.composite);
            if (best.composite != null && prev?.composite != null) {
              const d = best.composite - prev.composite;
              deltaTxt = `${d >= 0 ? '+' : ''}${d}`;
              deltaDir = d >= 0 ? 'up' : 'dn';
            }
          }
          return (
            <div key={role} className={cn('bg-white rounded-[10px] border border-g200 border-t-[3px] p-4 flex flex-col gap-2 shadow-sm', c.top)}>
              <div className="flex items-start justify-between gap-2">
                <div className="font-mono text-[9px] font-bold tracking-[1.2px] uppercase text-g500">{role}</div>
                <div className={cn('w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0', c.iconBg)}>
                  <Gauge size={14} className={c.iconText} />
                </div>
              </div>
              <div className={cn('font-sans text-[26px] leading-none font-bold tracking-tight',
                value !== '—' && value !== '0%' ? 'text-red-mrt' : 'text-blk')}>
                {value}
              </div>
              <div className="text-[10.5px] truncate">
                {role === 'PI Sender'
                  ? <span className="text-g400" title="PI tracking coming soon">tracking coming soon</span>
                  : best
                    ? <span className="text-g500">{best.displayName}{deltaTxt && (
                        <span className={cn('ml-1 font-semibold', deltaDir === 'up' ? 'text-emerald-600' : 'text-red-500')}>
                          {deltaDir === 'up' ? '↑' : '↓'}{deltaTxt}
                        </span>)}</span>
                    : <span className="text-g400">no one assigned</span>}
              </div>
              <div className="text-[9px] text-g400">{members.length} {members.length === 1 ? 'person' : 'people'}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 text-[10.5px] text-g400">
        Scores shown as <span className="text-red-mrt font-semibold">shortfall</span> — how far below 100% each doer
        is (e.g. <span className="font-mono">−57%</span> = 57% of tasks not done / not on time). Click a row for the full history.
      </div>

      {/* ── Scoreboard ── */}
      <div className="bg-white rounded-[10px] border border-g200 mt-4 overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-g100">
          <Trophy size={15} className="text-g500" />
          <h2 className="font-mono text-[11px] font-bold tracking-[1.5px] uppercase text-g600">Scoreboard</h2>
          <span className="text-[10px] text-g400 ml-1">
            {range.startDate} → {range.endDate}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-g500 font-mono text-[9.5px] tracking-[1px] uppercase border-b border-g100">
                <Th>Doer</Th>
                <Th>Role</Th>
                <ThSort label="Shortfall" k="composite" sortKey={sortKey} onSort={setSortKey} />
                <ThSort label="On-time" k="onTimePct" sortKey={sortKey} onSort={setSortKey} />
                <ThSort label="Volume" k="volume" sortKey={sortKey} onSort={setSortKey} />
                <ThSort label="Speed" k="avgCycleH" sortKey={sortKey} onSort={setSortKey} />
                <Th>Time Lap</Th>
                <ThSort label="Win %" k="winRate" sortKey={sortKey} onSort={setSortKey} />
                <Th>Δ wk</Th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map(m => {
                const key = doerRowKey(m.email, m.role);
                const deferred = ROLE_WEIGHTS[m.role] == null;
                const prev = previous.get(key);
                const delta = (m.composite != null && prev?.composite != null) ? m.composite - prev.composite : null;
                return (
                  <tr key={key} className="border-b border-g50 hover:bg-g50/50 cursor-pointer"
                      onClick={() => navigate(`/doer-kpi/${encodeURIComponent(key)}`)}>
                    <td className="px-4 py-2.5 font-medium text-blk whitespace-nowrap">{m.displayName}</td>
                    <td className="px-4 py-2.5 text-g500">{m.role}</td>
                    <td className="px-4 py-2.5">
                      {deferred ? <span className="text-g300" title="PI tracking coming soon">—</span> : (
                        <div className="flex items-center gap-2">
                          {/* Bar fills the DONE portion (composite%); track shows the shortfall gap. */}
                          <div className="w-16 h-1.5 rounded-full bg-red-100 overflow-hidden">
                            <div className={cn('h-full rounded-full',
                              (m.composite ?? 0) >= 70 ? 'bg-emerald-500' : (m.composite ?? 0) >= 40 ? 'bg-amber-500' : 'bg-red-500')}
                              style={{ width: `${m.composite ?? 0}%` }} />
                          </div>
                          <span className={cn('font-semibold tabular-nums',
                            m.composite == null ? 'text-g300' : m.composite >= 100 ? 'text-emerald-600' : 'text-red-mrt')}>
                            {fmtShortfall(m.composite)}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-g600">{deferred ? '—' : fmtPct(m.onTimePct)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-g600">{deferred ? '—' : m.volume}</td>
                    <td className="px-4 py-2.5 tabular-nums text-g600">{deferred ? '—' : fmtHours(m.avgCycleH)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-g600">
                      {m.role === 'DEO'
                        ? <span title="Enquiry received → punched in">{fmtHours(m.enqLapH)}<span className="text-g400 text-[9px] ml-1">enq</span></span>
                        : m.role === 'Rate Entry'
                          ? <span title="Enquiry punched → quote sent">{fmtHours(m.quoteLapH)}<span className="text-g400 text-[9px] ml-1">→sent</span></span>
                          : <span className="text-g300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-g600">{deferred ? '—' : fmtPct(m.winRate)}</td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {delta == null ? <span className="text-g300">—</span> : (
                        <span className={cn('font-semibold', delta >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                          {delta >= 0 ? '↑' : '↓'}{Math.abs(delta)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* ── Trend ── */}
        <div className="bg-white rounded-[10px] border border-g200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <TrendingUp size={15} className="text-g500 shrink-0" />
            <h2 className="font-mono text-[11px] font-bold tracking-[1.5px] uppercase text-g600 shrink-0">
              Score Trend
            </h2>
            <select
              title="Select doer for trend"
              value={activeTrendKey ?? ''}
              onChange={e => setTrendKey(e.target.value || undefined)}
              className="ml-auto text-[11px] bg-white border border-g200 rounded-[4px] px-2 py-1 outline-none focus:border-g400 text-g600 cursor-pointer"
            >
              {rows.map(r => {
                const k = doerRowKey(r.email, r.role);
                return <option key={k} value={k}>{r.displayName} · {r.role}</option>;
              })}
            </select>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData.points} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#999' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#999' }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Line type="monotone" dataKey="score" stroke="#D42027" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Due next week ── */}
        <div className="bg-white rounded-[10px] border border-g200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={15} className="text-g500" />
            <h2 className="font-mono text-[11px] font-bold tracking-[1.5px] uppercase text-g600">Due Next Week</h2>
          </div>
          <div className="space-y-2 max-h-[220px] overflow-y-auto">
            {rows.filter(m => m.dueNextWeek.length > 0).length === 0 && (
              <div className="text-[12px] text-g400 py-6 text-center">Nothing scheduled for the next 7 days.</div>
            )}
            {rows.filter(m => m.dueNextWeek.length > 0).map(m => (
              <DueGroup
                key={doerRowKey(m.email, m.role)}
                member={m}
                onBulkLog={(items) => setBulkLog({
                  context: items[0] ? `${items[0].cust} · ${items[0].site}` : `Due Next Week · ${m.displayName}`,
                  items,
                })}
              />
            ))}
          </div>
        </div>
      </div>

      {bulkLog && (
        <BulkLogSidePanel
          quoteIds={bulkLog.items.map(it => it.refId)}
          context={bulkLog.context}
          items={bulkLog.items.map(it => ({ refId: it.refId, cust: it.cust, label: it.label }))}
          onClose={() => setBulkLog(null)}
        />
      )}
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <h1 className="font-serif text-[24px] font-bold text-blk">Doer KPI</h1>
      <p className="text-[12px] text-g500 mt-0.5">
        Per-person scores from the data collected across the pipeline — done, on-time, and forward workload.
      </p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 text-left font-bold">{children}</th>;
}
function ThSort({ label, k, sortKey, onSort }: {
  label: string; k: any; sortKey: string; onSort: (k: any) => void;
}) {
  return (
    <th className="px-4 py-2.5 text-left font-bold cursor-pointer select-none hover:text-g700"
        onClick={() => onSort(k)}>
      <span className={cn(sortKey === k && 'text-red-mrt')}>{label}{sortKey === k && ' ↓'}</span>
    </th>
  );
}

function DueGroup({ member, onBulkLog }: { member: DoerMetrics; onBulkLog: (items: DueItem[]) => void }) {
  const [open, setOpen] = useState(true);

  // Group every due item by customer + site/branch. Bulk-log is scoped to a
  // single customer-site so one call clears all that site's open follow-ups
  // (mirrors the Customer Intel Board) — no cross-customer batching.
  const siteGroups = useMemo(() => {
    const map = new Map<string, { cust: string; site: string; items: DueItem[] }>();
    for (const d of member.dueNextWeek) {
      const key = `${d.cust}__${d.siteId ?? d.site}`;
      if (!map.has(key)) map.set(key, { cust: d.cust, site: d.site, items: [] });
      map.get(key)!.items.push(d);
    }
    return [...map.values()];
  }, [member.dueNextWeek]);

  return (
    <div className="border border-g100 rounded-[8px] overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-g50 hover:bg-g100/60">
        <span className="text-[11.5px] font-semibold text-blk">{member.displayName}
          <span className="ml-1.5 text-g400 font-normal">({member.role})</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold text-white bg-g600 rounded-full px-1.5 py-0.5">{member.dueNextWeek.length}</span>
          <ChevronDown size={14} className={cn('text-g400 transition-transform', open && 'rotate-180')} />
        </span>
      </button>
      {open && (
        <div className="divide-y divide-g100">
          {siteGroups.map((g, gi) => (
            <SiteDueGroup key={gi} cust={g.cust} site={g.site} items={g.items} onBulkLog={onBulkLog} />
          ))}
        </div>
      )}
    </div>
  );
}

// One customer + site/branch block: its own checkboxes and a "Log all" that
// fans a single activity across just this site's loggable follow-ups.
function SiteDueGroup({ cust, site, items, onBulkLog }: {
  cust: string; site: string; items: DueItem[]; onBulkLog: (items: DueItem[]) => void;
}) {
  const loggable = items.filter(d => d.kind === 'followup');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (refId: string) =>
    setSelected(s => {
      const next = new Set(s);
      next.has(refId) ? next.delete(refId) : next.add(refId);
      return next;
    });

  const selectedItems = loggable.filter(d => selected.has(d.refId));
  const logHere = () => {
    const batch = selectedItems.length > 0 ? selectedItems : loggable;
    if (batch.length > 0) onBulkLog(batch);
  };

  // Show the site/branch inline after the customer (app convention), but skip
  // the bare "Head Office / General" fallback so single-site customers stay clean.
  const showSite = site && site !== 'Head Office / General';

  return (
    <div>
      {/* Customer — site/branch header (inline) */}
      <div className="px-3 py-1.5 bg-g50/70">
        <div className="text-[11px] font-semibold text-blk truncate">
          {cust}{showSite && <span className="font-normal text-g400"> — {site}</span>}
        </div>
      </div>
      <ul className="divide-y divide-g50">
        {items.map((d, i) => {
          const canLog = d.kind === 'followup';
          const checked = selected.has(d.refId);
          return (
            <li key={i} className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
              {canLog ? (
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(d.refId)}
                  title={`Select ${d.refId}`}
                  className="shrink-0 accent-indigo-600 cursor-pointer"
                />
              ) : (
                <span className="w-3 shrink-0" />
              )}
              <span className="text-g700 truncate flex-1">{d.label}</span>
              <span className="text-g400 shrink-0 ml-2 tabular-nums">
                {d.dueDate ? new Date(d.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
              </span>
            </li>
          );
        })}
      </ul>
      {loggable.length > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50/40">
          <span className="text-[10px] text-indigo-600 font-medium">
            {selectedItems.length > 0 ? `${selectedItems.length} selected` : `One call · all ${loggable.length} open`}
          </span>
          <button
            type="button"
            title="Log follow-up for all quotes at this customer-site"
            onClick={logHere}
            className="h-5 inline-flex items-center gap-1 px-2 rounded-full border text-[9px] font-semibold transition-colors bg-white text-indigo-600 border-indigo-300 hover:bg-indigo-50"
          >
            + Log {selectedItems.length > 0 ? selectedItems.length : 'All'}
          </button>
        </div>
      )}
    </div>
  );
}

// Composite score for a single (doer, role) row over the last 6 weekly windows.
// `key` is a row key (email|role) as produced by doerRowKey.
function buildTrend(data: ReturnType<typeof useAppStore>['data'], roster: any[], key?: string) {
  const points: { label: string; score: number | null }[] = [];
  if (!key) return { name: '—', points };
  // Label the chart with the person + role this key refers to.
  const sample = computeDoerMetrics(data, roster, null).get(key);
  const name = sample ? `${sample.displayName} · ${sample.role}` : '—';
  const now = Date.now();
  for (let w = 5; w >= 0; w--) {
    const end = new Date(now - w * 7 * MS_DAY);
    const start = new Date(end.getTime() - 7 * MS_DAY);
    const range = { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
    const m = computeDoerMetrics(data, roster, range).get(key);
    points.push({
      label: end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      score: m?.composite ?? null,
    });
  }
  return { name, points };
}
