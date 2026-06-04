import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { format, isBefore, isToday, parseISO, startOfDay, addDays } from 'date-fns';
import {
  Phone,
  Mail,
  MessageCircle,
  MapPin,
  Calendar,
  Clock,
  Search,
  Filter,
  CheckCircle2,
  User,
  History,
  RotateCcw,
  FileText,
  Receipt,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  AlertTriangle,
  Trophy,
  XCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn, fmtIST, isInDateRange, getThisWeekRange } from '../lib/utils';
import { DateFilterBanner } from '../components/ui';
import type { Quote, FollowUp, FollowUpLog } from '../lib/types';
import { generateQuotePDF, generatePIPDF } from '../lib/pdfGenerator';
import PipelineBoard from '../components/PipelineBoard';

function getOffsetWeekRange(offset: number) {
  const { start: baseStart } = getThisWeekRange();
  const start = new Date(baseStart);
  start.setDate(start.getDate() + offset * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  return { start, end, days };
}

function dateKey(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const CHANNEL_CONFIG: Record<string, { icon: string; color: string; bg: string; border: string }> = {
  Called:    { icon: '📞', color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200' },
  WhatsApp:  { icon: '💬', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  Email:     { icon: '📧', color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200' },
  Meeting:   { icon: '🤝', color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200' },
  Visit:     { icon: '📍', color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200' },
};

function formatDue(date: string | null | undefined, time?: string | null) {
  if (!date) return null;
  const label = isToday(parseISO(date)) ? 'Today' : fmtIST(parseISO(date), 'dd MMM');
  return time ? `${label} at ${time}` : label;
}

function groupLogsByDay(logs: FollowUpLog[]) {
  const groups: { day: string; logs: FollowUpLog[] }[] = [];
  for (const log of [...logs].reverse()) {
    const day = log.ts.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      last.logs.push(log);
    } else {
      groups.push({ day, logs: [log] });
    }
  }
  return groups;
}

export default function FollowUps() {
  const navigate = useNavigate();
  const store = useAppStore();
  const { data, addFollowUpLog, closeFollowUp, reopenFollowUp, openAttachmentModal, user } = store;
  const { globalDateRange, setGlobalDateRange } = store as any;
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [filterOwner, setFilterOwner] = useState<string>('All Owners');
  const [searchQuery, setSearchQuery] = useState('');
  const [queueTab, setQueueTab] = useState<'open' | 'closed'>('open');
  const [quickFilter, setQuickFilter] = useState<'all' | 'overdue' | 'today' | 'upcoming' | 'unscheduled'>('all');
  const [viewTab, setViewTab] = useState<'queue' | 'board' | 'thisweek' | 'calendar'>('queue');
  const [calWeekOffset, setCalWeekOffset] = useState(0);

  const [channel, setChannel] = useState<FollowUpLog['channel']>('Called');
  const [note, setNote] = useState('');
  const [nextAction, setNextAction] = useState<FollowUpLog['channel']>('Called');
  const [nextDate, setNextDate] = useState('');
  const [nextTime, setNextTime] = useState('');
  const [nextNote, setNextNote] = useState('');

  const today = startOfDay(new Date());

  const followUpQueue = useMemo(() => {
    const activeQuotes = data.quotes.filter(q => q.status !== 'Lost');

    return activeQuotes.map(quote => {
      const followUp = data.followups.find(f => f.quote_id === quote.id);

      // Days since the quote was issued — used to escalate quotes that have
      // been sent but never had a next touch scheduled.
      let daysSinceQuote = 0;
      try {
        const qDate = parseISO(quote.date);
        daysSinceQuote = Math.max(0, Math.floor((today.getTime() - startOfDay(qDate).getTime()) / 86400000));
      } catch { /* malformed date — leave at 0 */ }

      const isClosed = (followUp?.status ?? 'open') === 'closed';

      let priority: 'overdue' | 'today' | 'upcoming' | 'unscheduled' | 'none' = 'none';
      if (followUp?.next_date) {
        const d = parseISO(followUp.next_date);
        if (isBefore(d, today)) priority = 'overdue';
        else if (isToday(d)) priority = 'today';
        else priority = 'upcoming';
      } else if (!isClosed) {
        // Active quote with no next follow-up planned — this is the gap that
        // lets quotations slip. Surface it loudly instead of silently as "New".
        priority = 'unscheduled';
      }

      return { quote, followUp, priority, daysSinceQuote };
    }).filter(item => {
      const status = item.followUp?.status ?? 'open';
      if (status !== queueTab) return false;

      // Quick-filter from the stat cards (only meaningful on the Active tab).
      if (queueTab === 'open' && quickFilter !== 'all' && item.priority !== quickFilter) return false;

      const matchesSearch =
        item.quote.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.quote.cust.toLowerCase().includes(searchQuery.toLowerCase());

      const owner = item.followUp?.owner || 'Unassigned';
      const matchesOwner = filterOwner === 'All Owners' || owner === filterOwner;

      // Global date range filter (next_date). Unscheduled items have no
      // next_date — they're the at-risk pile, so they stay visible regardless
      // of the date range rather than being silently filtered out.
      const nextDate = item.followUp?.next_date;
      if (globalDateRange && item.priority !== 'unscheduled' && !isInDateRange(nextDate, globalDateRange)) return false;

      return matchesSearch && matchesOwner;
    }).sort((a, b) => {
      const priorityOrder = { overdue: 0, today: 1, unscheduled: 2, upcoming: 3, none: 4 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      // Within "unscheduled", the longest-silent quotes float to the top.
      if (a.priority === 'unscheduled' && b.priority === 'unscheduled') {
        return b.daysSinceQuote - a.daysSinceQuote;
      }
      if (a.followUp?.next_date && b.followUp?.next_date) {
        return a.followUp.next_date.localeCompare(b.followUp.next_date);
      }
      return 0;
    });
  }, [data.quotes, data.followups, searchQuery, filterOwner, queueTab, quickFilter]);

  const allOpen = useMemo(() =>
    data.quotes.filter(q => q.status !== 'Lost').filter(q => {
      const f = data.followups.find(fu => fu.quote_id === q.id);
      return (f?.status ?? 'open') === 'open';
    }),
    [data.quotes, data.followups]
  );

  const thisWeekQueue = useMemo(() => {
    const { start, end } = getOffsetWeekRange(0);
    return followUpQueue.filter(item => {
      const d = item.followUp?.next_date;
      if (!d) return false;
      const dt = parseISO(d);
      return dt >= start && dt <= end;
    });
  }, [followUpQueue]);

  const { days: calDays } = useMemo(() => getOffsetWeekRange(calWeekOffset), [calWeekOffset]);

  const calWeekLabel = useMemo(() => {
    const s = calDays[0], e = calDays[6];
    return `${fmtIST(s, 'dd MMM')} – ${fmtIST(e, 'dd MMM yyyy')}`;
  }, [calDays]);

  const calEventMap = useMemo(() => {
    const allItems = data.quotes.filter(q => q.status !== 'Lost').map(quote => {
      const followUp = data.followups.find(f => f.quote_id === quote.id);
      return { quote, followUp };
    }).filter(item => (item.followUp?.status ?? 'open') === 'open');
    const map: Record<string, typeof allItems> = {};
    for (const item of allItems) {
      const d = item.followUp?.next_date;
      if (!d) continue;
      const key = dateKey(d);
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return map;
  }, [data.quotes, data.followups]);

  const todayKey = dateKey(new Date());

  const selectedItem = followUpQueue.find(item => item.quote.id === selectedQuoteId) || followUpQueue[0];

  const stats = {
    overdue: allOpen.filter(q => {
      const f = data.followups.find(fu => fu.quote_id === q.id);
      return f?.next_date && isBefore(parseISO(f.next_date), today);
    }).length,
    today: allOpen.filter(q => {
      const f = data.followups.find(fu => fu.quote_id === q.id);
      return f?.next_date && isToday(parseISO(f.next_date));
    }).length,
    upcoming: allOpen.filter(q => {
      const f = data.followups.find(fu => fu.quote_id === q.id);
      return f?.next_date && !isBefore(parseISO(f.next_date), today) && !isToday(parseISO(f.next_date));
    }).length,
    // Active quotes with no next follow-up planned — the "could be missed" pile.
    unscheduled: allOpen.filter(q => {
      const f = data.followups.find(fu => fu.quote_id === q.id);
      return !f?.next_date;
    }).length,
  };

  const owners = ['All Owners', ...Array.from(new Set(data.followups.map(f => f.owner).filter(Boolean)))];

  const handleLogActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuoteId || !note) return;

    const newLog: FollowUpLog = {
      ts: new Date().toISOString(),
      who: user?.user_metadata?.full_name || user?.email || 'Unknown',
      channel,
      note,
      nextDate: nextDate || undefined,
      nextChannel: nextAction,
      nextNote: nextDate ? (nextNote.trim() || undefined) : undefined,
    };

    try {
      await addFollowUpLog(selectedQuoteId, newLog, nextDate || null, nextTime || null);
      setNote('');
      setNextDate('');
      setNextTime('');
      setNextNote('');
    } catch (err) {
      alert('Failed to log activity. Please ensure followups table exists in Supabase.');
    }
  };

  const handleClose = async () => {
    if (!selectedQuoteId) return;
    try {
      await closeFollowUp(selectedQuoteId);
      setSelectedQuoteId(null);
    } catch (err) {
      alert('Failed to close follow-up.');
    }
  };

  const handleReopen = async () => {
    if (!selectedQuoteId) return;
    try {
      await reopenFollowUp(selectedQuoteId);
      setQueueTab('open');
      setSelectedQuoteId(null);
    } catch (err) {
      alert('Failed to reopen follow-up.');
    }
  };

  const handleMarkWon = async (quoteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Mark this quote as WON? Ensure PO is received.')) return;
    try { await closeFollowUp(quoteId, 'Won'); } catch { alert('Failed to mark as Won.'); }
  };

  const handleMarkLost = async (quoteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Mark this quote as LOST?')) return;
    try { await closeFollowUp(quoteId, 'Lost'); } catch { alert('Failed to mark as Lost.'); }
  };

  const handleQuotePDF = (quote: Quote) => {
    const cust = data.customers.find(c => c.name === quote.cust);
    const unit = quote.unitId ? data.units.find(u => u.id === quote.unitId) : data.units.find(u => u.is_default);
    const unitSig = unit?.signatory_id ? data.signatories.find(s => s.id === unit.signatory_id) : undefined;
    const sig = unitSig ?? data.signatories.find(s => s.is_default);
    generateQuotePDF(quote, cust, data.settings, sig, true, unit);
  };

  const handlePIPDF = (quote: Quote) => {
    const order = data.orders.find(o => o.quoteRef === quote.id);
    if (!order) return;
    const cust = data.customers.find(c => c.name === order.cust);
    const unit = order.unitId ? data.units.find(u => u.id === order.unitId) : data.units.find(u => u.is_default);
    const bank = order.bankAccountId
      ? data.bankAccounts.find(b => b.id === order.bankAccountId)
      : data.bankAccounts.find(b => b.unit_id === unit?.id && b.is_default);
    const unitSig = unit?.signatory_id ? data.signatories.find(s => s.id === unit.signatory_id) : undefined;
    const sig = unitSig ?? data.signatories.find(s => s.is_default);
    generatePIPDF(order, quote, cust, data.settings, sig, true, unit, bank);
  };

  const isClosedTab = queueTab === 'closed';

  function cardOnTimeRate(logs: FollowUpLog[]) {
    let onTime = 0, total = 0;
    for (let i = 1; i < logs.length; i++) {
      const prevNext = logs[i - 1].nextDate;
      if (!prevNext) continue;
      const due = new Date(prevNext);
      due.setHours(23, 59, 59, 999);
      total++;
      if (new Date(logs[i].ts) <= due) onTime++;
    }
    return total > 0 ? Math.round(onTime / total * 100) : null;
  }

  function tatLabel(followUp: FollowUp | undefined, tatDays = 2) {
    const touchCount = (followUp?.logs ?? []).filter(l => !l.note?.startsWith('Quote sent —')).length;
    return touchCount === 0 ? `TAT: ${tatDays}d (1st call)` : 'Customer-promised';
  }

  // ── Board view: full-width Kanban (replaces the old Queue list) ──
  if (viewTab === 'board') {
    return (
      <div className="flex flex-col h-full bg-cream overflow-hidden">
        <DateFilterBanner globalDateRange={globalDateRange} onClear={() => setGlobalDateRange(null)} />
        <div className="px-4 py-3 border-b border-g200 bg-white flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <div className="font-mono text-[10px] font-bold tracking-[2px] uppercase text-red-mrt mb-0.5">Pipeline</div>
              <h1 className="text-xl font-serif text-blk italic leading-none">Command Centre</h1>
            </div>
            {/* View tabs */}
            <div className="flex gap-1 bg-g100 rounded-[4px] p-1">
              {(['queue', 'board', 'thisweek', 'calendar'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setViewTab(tab)}
                  className={cn(
                    "px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider rounded-[3px] transition-colors",
                    viewTab === tab ? "bg-white text-blk shadow-sm" : "text-g500 hover:text-blk"
                  )}
                >
                  {tab === 'queue' ? 'Queue' : tab === 'board' ? 'Board' : tab === 'thisweek' ? 'This Week' : 'Calendar'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-g400" size={14} />
              <input
                type="text"
                placeholder="Search customer or ref…"
                className="w-[220px] pl-8 pr-3 py-1.5 bg-g50 border border-g200 rounded-[5px] text-[12px] focus:outline-none focus:border-red-mrt/30"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              title="Filter by owner"
              className="bg-g50 border border-g200 rounded-[4px] px-2 py-1.5 text-[11px] font-medium"
              value={filterOwner}
              onChange={e => setFilterOwner(e.target.value)}
            >
              {owners.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
        <PipelineBoard ownerFilter={filterOwner} search={searchQuery} />
      </div>
    );
  }

  return (
    <div className="flex h-full bg-cream overflow-hidden">
      {/* Left Panel: Queue */}
      <div className="w-[380px] border-r border-g200 flex flex-col bg-white">
        <DateFilterBanner globalDateRange={globalDateRange} onClear={() => setGlobalDateRange(null)} />
        <div className="p-4 border-b border-g200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-mono text-[10px] font-bold tracking-[2px] uppercase text-red-mrt mb-1">Queue</div>
              <h1 className="text-xl font-serif text-blk italic">Command Centre</h1>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              type="button"
              onClick={() => { setQuickFilter(f => f === 'overdue' ? 'all' : 'overdue'); setSelectedQuoteId(null); }}
              className={cn(
                "text-left px-2.5 py-1.5 rounded-[4px] border transition-all",
                quickFilter === 'overdue' ? "bg-red-mrt/10 border-red-mrt ring-1 ring-red-mrt/30" : "bg-red-lt border-red-mrt/10 hover:border-red-mrt/30"
              )}
            >
              <div className="text-[10px] uppercase font-bold text-red-mrt opacity-60">Overdue</div>
              <div className="text-lg font-mono font-bold text-red-mrt leading-none mt-1">{stats.overdue}</div>
            </button>
            <button
              type="button"
              onClick={() => { setQuickFilter(f => f === 'unscheduled' ? 'all' : 'unscheduled'); setSelectedQuoteId(null); }}
              className={cn(
                "text-left px-2.5 py-1.5 rounded-[4px] border transition-all relative",
                quickFilter === 'unscheduled' ? "bg-orange-100 border-orange-400 ring-1 ring-orange-300" : "bg-orange-50 border-orange-200 hover:border-orange-400"
              )}
            >
              <div className="text-[10px] uppercase font-bold text-orange-600 opacity-80 flex items-center gap-1">
                {stats.unscheduled > 0 && <AlertTriangle size={10} className="text-orange-500" />}
                No Next Step
              </div>
              <div className="text-lg font-mono font-bold text-orange-600 leading-none mt-1">{stats.unscheduled}</div>
            </button>
            <button
              type="button"
              onClick={() => { setQuickFilter(f => f === 'today' ? 'all' : 'today'); setSelectedQuoteId(null); }}
              className={cn(
                "text-left px-2.5 py-1.5 rounded-[4px] border transition-all",
                quickFilter === 'today' ? "bg-sR/10 border-sR ring-1 ring-sR/30" : "bg-sR/5 border-sR/10 hover:border-sR/30"
              )}
            >
              <div className="text-[10px] uppercase font-bold text-sR opacity-60">Today</div>
              <div className="text-lg font-mono font-bold text-sR leading-none mt-1">{stats.today}</div>
            </button>
            <button
              type="button"
              onClick={() => { setQuickFilter(f => f === 'upcoming' ? 'all' : 'upcoming'); setSelectedQuoteId(null); }}
              className={cn(
                "text-left px-2.5 py-1.5 rounded-[4px] border transition-all",
                quickFilter === 'upcoming' ? "bg-sW/10 border-sW ring-1 ring-sW/30" : "bg-sW/5 border-sW/10 hover:border-sW/30"
              )}
            >
              <div className="text-[10px] uppercase font-bold text-sW opacity-60">Upcoming</div>
              <div className="text-lg font-mono font-bold text-sW leading-none mt-1">{stats.upcoming}</div>
            </button>
          </div>

          {/* View tabs */}
          <div className="flex gap-1 mb-3 bg-g100 rounded-[4px] p-1">
            {(['queue', 'board', 'thisweek', 'calendar'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setViewTab(tab)}
                className={cn(
                  "flex-1 py-1 text-[10px] font-mono font-bold uppercase tracking-wider rounded-[3px] transition-colors",
                  viewTab === tab ? "bg-white text-blk shadow-sm" : "text-g500 hover:text-blk"
                )}
              >
                {tab === 'queue' ? 'Queue' : tab === 'board' ? 'Board' : tab === 'thisweek' ? 'This Week' : 'Calendar'}
              </button>
            ))}
          </div>

          {/* Active / Closed sub-tabs — hidden in calendar view */}
          {viewTab !== 'calendar' && (
            <div className="flex gap-1 mb-3 bg-g100 rounded-[4px] p-1">
              <button
                type="button"
                onClick={() => { setQueueTab('open'); setSelectedQuoteId(null); }}
                className={cn(
                  "flex-1 py-1 text-[10px] font-mono font-bold uppercase tracking-wider rounded-[3px] transition-colors",
                  queueTab === 'open' ? "bg-white text-blk shadow-sm" : "text-g500 hover:text-blk"
                )}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => { setQueueTab('closed'); setSelectedQuoteId(null); }}
                className={cn(
                  "flex-1 py-1 text-[10px] font-mono font-bold uppercase tracking-wider rounded-[3px] transition-colors",
                  queueTab === 'closed' ? "bg-white text-blk shadow-sm" : "text-g500 hover:text-blk"
                )}
              >
                Closed
              </button>
            </div>
          )}

          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-g400" size={14} />
              <input
                type="text"
                placeholder="Search quotes or customers..."
                className="w-full pl-8 pr-3 py-1.5 bg-g50 border border-g200 rounded-[5px] text-[12px] focus:outline-none focus:border-red-mrt/30"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="text-g400" size={14} />
              <select
                title="Filter by owner"
                className="flex-1 bg-g50 border border-g200 rounded-[4px] px-2 py-1 text-[11px] font-medium"
                value={filterOwner}
                onChange={e => setFilterOwner(e.target.value)}
              >
                {owners.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
        </div>

        {viewTab === 'calendar' ? (
          <FUCalWeekGrid
            days={calDays}
            eventMap={calEventMap}
            selectedQuoteId={selectedQuoteId}
            onSelect={id => setSelectedQuoteId(id)}
            todayKey={todayKey}
            weekLabel={calWeekLabel}
            onPrev={() => setCalWeekOffset(o => o - 1)}
            onNext={() => setCalWeekOffset(o => o + 1)}
            onToday={() => setCalWeekOffset(0)}
          />
        ) : (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {(viewTab === 'thisweek' ? thisWeekQueue : followUpQueue).map(({ quote, followUp, priority, daysSinceQuote }) => {
            const onTimePct = cardOnTimeRate(followUp?.logs ?? []);
            const tat = tatLabel(followUp);
            return (
            <div
              key={quote.id}
              className={cn(
                "w-full rounded-[6px] border transition-all duration-200 overflow-hidden",
                (selectedQuoteId === quote.id || (selectedItem && selectedItem.quote.id === quote.id))
                  ? "bg-red-lt border-red-mrt/20"
                  : "bg-white border-transparent hover:bg-g50 hover:border-g200"
              )}
            >
              {/* Main card — click to select */}
              <button
                type="button"
                onClick={() => setSelectedQuoteId(quote.id)}
                className="w-full text-left p-3"
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-8 h-8 rounded-[4px] flex items-center justify-center font-mono text-[10px] font-bold",
                      isClosedTab ? "bg-emerald-100 text-emerald-700" :
                      priority === 'overdue' ? "bg-red-mrt text-white shadow-[0_2px_8px_rgba(212,32,39,0.2)]" :
                      priority === 'today' ? "bg-sR text-white" :
                      priority === 'unscheduled' ? "bg-orange-500 text-white shadow-[0_2px_8px_rgba(249,115,22,0.2)]" :
                      priority === 'upcoming' ? "bg-sW text-white" :
                      "bg-g100 text-g500"
                    )}>
                      MRT
                    </div>
                    <div>
                      <div className="font-mono text-[11px] font-bold text-sQ">{quote.id}</div>
                      <div className="text-[10px] text-g400 font-medium">Ref: {quote.enqRef}</div>
                    </div>
                  </div>
                  <div className={cn(
                    "px-1.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider",
                    isClosedTab ? "border-emerald-300 text-emerald-700 bg-emerald-50" :
                    priority === 'overdue' ? "border-red-mrt text-red-mrt bg-red-lt" :
                    priority === 'today' ? "border-sR text-sR bg-sR/5" :
                    priority === 'unscheduled' ? "border-orange-400 text-orange-600 bg-orange-50" :
                    priority === 'upcoming' ? "border-sW text-sW bg-sW/5" :
                    "border-g300 text-g500 bg-g100"
                  )}>
                    {isClosedTab ? 'Closed' :
                      priority === 'unscheduled' ? 'No Next Step' :
                      priority === 'none' ? 'New' : priority}
                  </div>
                </div>

                <div className="text-[13px] font-bold text-blk truncate">{quote.cust}</div>
                {(() => {
                  const custRec = data.customers.find(c => c.name === quote.cust);
                  const site = custRec?.sites.find(s => s.isPrimary) ?? custRec?.sites[0];
                  const city = site?.city;
                  if (!city) return null;
                  return (
                    <div className="flex items-center gap-0.5 text-[10px] text-g400 mb-1">
                      <MapPin size={9} className="shrink-0" />
                      <span className="truncate">{city}</span>
                    </div>
                  );
                })()}

                <div className="flex items-center justify-between text-[11px] text-g500">
                  <div className="flex items-center gap-3">
                    <span className="font-mono">Rs{quote.items.reduce((a, i) => a + i.total, 0).toLocaleString('en-IN')}</span>
                    <span className="w-1 h-1 rounded-full bg-g300" />
                    <span>{quote.items.length} Items</span>
                  </div>
                  <div className={cn(
                    "flex items-center gap-1 font-medium",
                    !isClosedTab && priority === 'unscheduled' && "text-orange-600"
                  )}>
                    {!isClosedTab && priority === 'unscheduled' ? (
                      <AlertTriangle size={11} className="text-orange-500" />
                    ) : !isClosedTab && followUp?.next_date && (priority === 'overdue' || priority === 'today') ? (
                      <Clock size={11} className={priority === 'overdue' ? 'text-red-mrt animate-pulse' : 'text-sR'} />
                    ) : <Calendar size={11} />}
                    <span>
                      {isClosedTab ? 'Closed' :
                        priority === 'unscheduled'
                          ? (daysSinceQuote > 0 ? `Silent ${daysSinceQuote}d — set next step` : 'Set next step')
                          : formatDue(followUp?.next_date, followUp?.next_time) ?? 'No Date'}
                    </span>
                  </div>
                </div>
              </button>

              {/* TAT + On-Time stat strip */}
              <div className="flex items-center gap-3 px-3 py-1.5 bg-g50 border-t border-g100 text-[10px]">
                <span className="font-mono text-g500">{tat}</span>
                {onTimePct !== null && (
                  <>
                    <span className="w-px h-3 bg-g200" />
                    <span className={cn(
                      "font-mono font-bold",
                      onTimePct >= 80 ? "text-emerald-600" : onTimePct >= 60 ? "text-orange-500" : "text-red-mrt"
                    )}>On-Time: {onTimePct}%</span>
                  </>
                )}
              </div>

              {/* WON / LOST quick-action buttons — only on active tab */}
              {!isClosedTab && (
                <div className="flex border-t border-g100">
                  <button
                    type="button"
                    onClick={e => handleMarkLost(quote.id, e)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold text-red-mrt hover:bg-red-lt transition-colors"
                  >
                    <XCircle size={10} /> LOST
                  </button>
                  <div className="w-px bg-g100" />
                  <button
                    type="button"
                    onClick={e => handleMarkWon(quote.id, e)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 transition-colors"
                  >
                    <Trophy size={10} /> WON
                  </button>
                </div>
              )}
            </div>
            );
          })}
          {viewTab === 'thisweek' && thisWeekQueue.length === 0 && (
            <div className="p-8 text-center bg-g50 rounded-lg border border-dashed border-g200 mx-2 mt-4">
              <Calendar className="mx-auto text-g300 mb-2" size={24} />
              <div className="text-[12px] font-bold text-g500">No follow-ups due this week</div>
              <div className="text-[10px] text-g400">Check the Board or Calendar for other items</div>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Right Panel: Detail & Log Activity */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedItem ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-20 h-20 bg-g100 rounded-full flex items-center justify-center mb-6 animate-bounce duration-[3s]">
              <Clock className="text-g300" size={32} />
            </div>
            <h2 className="text-2xl font-serif text-blk italic mb-2">Ready to re-engage?</h2>
            <p className="text-g500 max-w-sm text-[13px]">
              Select a quotation from the queue to review activity history and log your next follow-up action.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-6 bg-white border-b border-g200 shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="font-mono text-[13px] font-bold text-sQ bg-sQ/10 px-2 py-0.5 rounded">{selectedItem.quote.id}</span>
                    <span className="px-2 py-0.5 rounded-full bg-sR text-white text-[9px] font-bold uppercase tracking-wider">{selectedItem.quote.status}</span>
                    <div className="w-1 h-1 rounded-full bg-g300 mx-1" />
                    <span className="font-mono text-[11px] text-red-mrt">Ref: {selectedItem.quote.enqRef}</span>
                    {/* Due date/time display */}
                    {selectedItem.followUp?.next_date && !isClosedTab && (
                      <>
                        <div className="w-1 h-1 rounded-full bg-g300 mx-1" />
                        <span className={cn(
                          "flex items-center gap-1 text-[11px] font-medium",
                          selectedItem.priority === 'overdue' ? 'text-red-mrt' :
                          selectedItem.priority === 'today' ? 'text-sR' : 'text-g500'
                        )}>
                          <Clock size={10} />
                          Due: {formatDue(selectedItem.followUp.next_date, selectedItem.followUp.next_time)}
                        </span>
                      </>
                    )}
                    {/* TAT + On-Time badge */}
                    {(() => {
                      const tat = tatLabel(selectedItem.followUp);
                      const pct = cardOnTimeRate(selectedItem.followUp?.logs ?? []);
                      return (
                        <div className="ml-auto flex items-center gap-2 bg-g50 border border-g200 rounded-[4px] px-2.5 py-1 text-[10px] font-mono">
                          <span className="text-g500">{tat}</span>
                          {pct !== null && (
                            <>
                              <span className="text-g300">·</span>
                              <span className={cn(
                                "font-bold",
                                pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-orange-500" : "text-red-mrt"
                              )}>On-Time: {pct}%</span>
                            </>
                          )}
                        </div>
                      );
                    })()}
                    {/* Close / Reopen — status action stays in header */}
                    {isClosedTab ? (
                      <button
                        type="button"
                        onClick={handleReopen}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase rounded-[4px] border border-g300 text-g600 bg-white hover:bg-g50 hover:text-blk transition-colors"
                      >
                        <RotateCcw size={12} /> Re-open
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={e => handleMarkLost(selectedItem.quote.id, e)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase rounded-[4px] border border-red-mrt/40 text-red-mrt bg-white hover:bg-red-lt transition-colors"
                        >
                          <XCircle size={12} /> LOST
                        </button>
                        <button
                          type="button"
                          onClick={e => handleMarkWon(selectedItem.quote.id, e)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase rounded-[4px] border border-emerald-400 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                        >
                          <Trophy size={12} /> WON
                        </button>
                        <button
                          type="button"
                          onClick={handleClose}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase rounded-[4px] border border-g300 text-g600 bg-white hover:bg-g50 hover:text-blk transition-colors"
                        >
                          <CheckCircle2 size={12} /> Close
                        </button>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-3xl font-serif text-blk italic truncate">{selectedItem.quote.cust}</h1>
                    {(() => {
                      const custRec = data.customers.find(c => c.name === selectedItem.quote.cust);
                      if (!custRec) return null;
                      return (
                        <button type="button" title="Edit Customer" onClick={() => navigate(`/customers/new?id=${custRec.id}`)} className="text-g400 hover:text-red-mrt transition-colors p-0.5 shrink-0">
                          <ExternalLink size={14} />
                        </button>
                      );
                    })()}
                  </div>
                  {/* City / branch under the customer name */}
                  {(() => {
                    const custRec = data.customers.find(c => c.name === selectedItem.quote.cust);
                    const site = custRec?.sites.find(s => s.isPrimary) ?? custRec?.sites[0];
                    const city = site?.city || custRec?.city;
                    if (!city) return null;
                    return (
                      <div className="flex items-center gap-1 text-[12px] text-g500 font-medium mb-4">
                        <MapPin size={11} className="text-g400 shrink-0" />
                        <span>{city}{site?.name && site.name !== custRec?.name ? ` — ${site.name}` : ''}</span>
                      </div>
                    );
                  })()}

                  <div className="flex flex-wrap gap-6 items-center">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-g400 tracking-wider">Value</span>
                      <span className="font-mono text-[14px] font-bold text-blk">Rs{selectedItem.quote.items.reduce((a, i) => a + i.total, 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="w-px h-6 bg-g200" />
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-g400 tracking-wider">Valid Till</span>
                      <span className="text-[14px] font-medium text-blk">{fmtIST(parseISO(selectedItem.quote.validity), 'dd MMM yyyy')}</span>
                    </div>
                    <div className="w-px h-6 bg-g200" />
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-g400 tracking-wider">Owner</span>
                      <div className="flex items-center gap-1.5">
                        <User size={12} className="text-g400" />
                        <span className="text-[14px] font-medium text-blk">{selectedItem.followUp?.owner || 'Unassigned'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Contact details strip */}
                  {(() => {
                    const custRec = data.customers.find(c => c.name === selectedItem.quote.cust);
                    const site = custRec?.sites.find(s => s.isPrimary) ?? custRec?.sites[0];
                    const contacts = site?.contacts ?? [];
                    if (contacts.length === 0) return null;
                    return (
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        {contacts.map(ct => (
                          <div key={ct.id} className="flex items-center gap-2 bg-g50 border border-g200 rounded-[4px] px-3 py-1.5">
                            <span className="text-[11.5px] font-semibold text-blk">{ct.name}</span>
                            {ct.role && (
                              <span className="px-1.5 py-0.5 bg-g200 rounded text-[8px] font-bold uppercase text-g500 tracking-wide">{ct.role}</span>
                            )}
                            <div className="w-px h-3 bg-g300" />
                            {ct.phone && (
                              <a href={`tel:${ct.phone}`} className="inline-flex items-center gap-1 text-[11px] text-blk hover:text-red-mrt transition-colors">
                                <Phone size={10} className="text-g400" />{ct.phone}
                              </a>
                            )}
                            {ct.phone && (
                              <a href={`https://wa.me/91${ct.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-900 transition-colors">
                                <MessageCircle size={10} />{ct.phone}
                              </a>
                            )}
                            {ct.email && (
                              <a href={`mailto:${ct.email}`} className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 transition-colors">
                                <Mail size={10} />{ct.email}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <div className={cn(
                  "p-4 rounded-lg flex flex-col items-center justify-center min-w-[120px]",
                  isClosedTab ? "bg-emerald-50 border border-emerald-100" :
                  selectedItem.priority === 'overdue' ? "bg-red-lt border border-red-mrt/10" :
                  selectedItem.priority === 'today' ? "bg-sR/5 border border-sR/10" :
                  selectedItem.priority === 'unscheduled' ? "bg-orange-50 border border-orange-200" : "bg-g50"
                )}>
                  <div className="text-[10px] uppercase font-bold text-g400 mb-1">Status</div>
                  <div className={cn(
                    "text-sm font-bold uppercase tracking-wider text-center",
                    isClosedTab ? "text-emerald-700" :
                    selectedItem.priority === 'overdue' ? "text-red-mrt" :
                    selectedItem.priority === 'today' ? "text-sR" :
                    selectedItem.priority === 'unscheduled' ? "text-orange-600" : "text-g500"
                  )}>
                    {isClosedTab ? 'Closed' :
                      selectedItem.priority === 'unscheduled' ? 'No Next Step' :
                      selectedItem.priority === 'none' ? 'Not Scheduled' : selectedItem.priority}
                  </div>
                  {!isClosedTab && selectedItem.followUp?.next_date && (
                    <div className="text-[11px] font-medium text-g500 mt-1">
                      {formatDue(selectedItem.followUp.next_date, selectedItem.followUp.next_time)}
                    </div>
                  )}
                  {!isClosedTab && selectedItem.priority === 'unscheduled' && selectedItem.daysSinceQuote > 0 && (
                    <div className="text-[11px] font-medium text-orange-500 mt-1">
                      Silent {selectedItem.daysSinceQuote}d
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Content: Chat Timeline & Form */}
            <div className="flex-1 overflow-hidden flex flex-col bg-g50 relative">
              {/* Nudge when this quote has no next step planned */}
              {!isClosedTab && selectedItem.priority === 'unscheduled' && (
                <div className="shrink-0 flex items-center gap-2 px-6 py-2.5 bg-orange-50 border-b border-orange-200">
                  <AlertTriangle size={14} className="text-orange-500 shrink-0" />
                  <span className="text-[12px] text-orange-700 font-medium">
                    No next step planned for this quotation
                    {selectedItem.daysSinceQuote > 0 ? ` — silent ${selectedItem.daysSinceQuote} day${selectedItem.daysSinceQuote === 1 ? '' : 's'}.` : '.'}
                    {' '}Log an activity below and set the next follow-up date so it never slips.
                  </span>
                </div>
              )}
              {/* Chat-bubble activity log */}
              <div className="flex-1 overflow-y-auto p-6 pb-2">
                <div className="flex items-center gap-2 mb-4">
                  <History size={16} className="text-g400" />
                  <span className="font-mono text-[9px] font-bold tracking-[2px] uppercase text-g500">Activity History</span>
                </div>

                {(!selectedItem.followUp || selectedItem.followUp.logs.length === 0) ? (
                  <div className="py-8 text-center text-g400 text-[12px]">No activity logged yet.</div>
                ) : (
                  <div className="space-y-1">
                    {(() => {
                      // Flatten all logs in chronological order to compute ON TIME
                      const allLogs = selectedItem.followUp.logs;
                      // For each log at position i, its "due" was the nextDate of log[i-1]
                      const wasOnTime = (i: number): boolean | null => {
                        if (i === 0) return null; // first entry has no prior due date
                        const prevNextDate = allLogs[i - 1].nextDate;
                        if (!prevNextDate) return null;
                        const due = new Date(prevNextDate);
                        due.setHours(23, 59, 59, 999);
                        return new Date(allLogs[i].ts) <= due;
                      };

                      return groupLogsByDay(allLogs).map(({ day, logs: dayLogs }) => (
                        <div key={day}>
                          {/* Date divider */}
                          <div className="flex items-center gap-3 my-3">
                            <div className="flex-1 h-px bg-g200" />
                            <span className="text-[10px] font-mono font-bold text-g400 bg-g50 px-2">
                              {isToday(parseISO(day)) ? 'Today' : fmtIST(parseISO(day), 'dd MMM yyyy')}
                            </span>
                            <div className="flex-1 h-px bg-g200" />
                          </div>

                          {dayLogs.map((log) => {
                            const globalIdx = allLogs.indexOf(log);
                            const cfg = CHANNEL_CONFIG[log.channel] ?? CHANNEL_CONFIG['Called'];
                            const isSystem = log.note?.startsWith('Quote sent —');
                            const onTime = wasOnTime(globalIdx);

                            // "Quote Sent" — prominent system entry
                            if (isSystem) {
                              return (
                                <div key={globalIdx} className="flex gap-3 mb-3">
                                  <div className="flex flex-col items-center w-7 shrink-0">
                                    <div className="w-7 h-7 rounded-full bg-amber-100 border-2 border-white flex items-center justify-center text-[12px]">📄</div>
                                    <div className="w-px flex-1 bg-g200 mt-1" />
                                  </div>
                                  <div className="flex-1 pb-3">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="text-[12px] font-bold text-blk">Quote Sent</span>
                                      <span className="text-[9px] font-mono text-g400">{fmtIST(parseISO(log.ts), 'dd MMM · hh:mm aa')}</span>
                                    </div>
                                    <p className="text-[12px] text-g600 leading-relaxed">{log.note}</p>
                                    {log.nextDate && (
                                      <div className="text-[11px] font-semibold text-sR mt-1">
                                        → Next: {fmtIST(parseISO(log.nextDate), 'dd MMM yyyy')}{log.nextChannel ? ` via ${log.nextChannel}` : ''}
                                      </div>
                                    )}
                                    <div className="text-[10px] text-g400 mt-0.5">{log.who}</div>
                                  </div>
                                </div>
                              );
                            }

                            // Regular follow-up log
                            return (
                              <div key={globalIdx} className="flex gap-3 mb-3">
                                <div className="flex flex-col items-center w-7 shrink-0">
                                  <div className={cn("w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[12px]", cfg.bg)}>
                                    {cfg.icon}
                                  </div>
                                  <div className="w-px flex-1 bg-g200 mt-1" />
                                </div>
                                <div className="flex-1 pb-3">
                                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                    <span className="text-[12px] font-bold text-blk">{log.channel}</span>
                                    {onTime !== null && (
                                      <span className={cn(
                                        "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                                        onTime ? "bg-emerald-100 text-emerald-700" : "bg-red-50 text-red-mrt"
                                      )}>
                                        {onTime ? 'ON TIME' : 'LATE'}
                                      </span>
                                    )}
                                    <span className="text-[9px] font-mono text-g400">{fmtIST(parseISO(log.ts), 'dd MMM · hh:mm aa')}</span>
                                  </div>
                                  <p className="text-[12px] text-g700 leading-relaxed whitespace-pre-wrap mb-1">{log.note}</p>
                                  {log.nextDate && (
                                    <div className="mb-1">
                                      <div className="text-[11px] font-semibold text-sR">
                                        → Next: {fmtIST(parseISO(log.nextDate), 'dd MMM yyyy')}{log.nextChannel ? ` via ${log.nextChannel}` : ''}
                                      </div>
                                      {log.nextNote && (
                                        <div className="text-[10.5px] italic text-g500 pl-2 border-l-2 border-g200 mt-0.5">
                                          {log.nextNote}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  <div className="text-[10px] text-g400">{log.who}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>

              {/* Log Activity Form — hidden when viewing closed tab */}
              {!isClosedTab && (
                <form onSubmit={handleLogActivity} className="shrink-0 bg-[#f9fafb] border-t border-g200 p-6 pt-5">
                  <div className="grid grid-cols-[1fr_1fr] gap-x-12 mb-4">
                    {/* Activity Done */}
                    <div>
                      <div className="font-mono text-[9px] font-bold tracking-[2px] uppercase text-red-mrt mb-4">Log Activity</div>
                      <div className="font-mono text-[8px] tracking-[1.5px] uppercase text-g500 font-bold mb-2">Activity Done</div>
                      <div className="flex gap-2 mb-2">
                        <select
                          title="Activity channel"
                          className="flex-1 bg-white border border-g300 rounded-[3px] px-3 py-2 text-[12px] outline-none focus:border-red-mrt"
                          value={channel}
                          onChange={e => setChannel(e.target.value as any)}
                        >
                          <option>Called</option>
                          <option>WhatsApp</option>
                          <option>Email</option>
                          <option>Meeting</option>
                          <option>Visit</option>
                        </select>
                        <div className="w-[120px] bg-white border border-g300 rounded-[3px] px-3 py-2 text-[12px] text-g600 truncate flex items-center">
                          {user?.user_metadata?.full_name || user?.email || 'Unknown'}
                        </div>
                      </div>

                      <textarea
                        required
                        placeholder="What happened? What did the customer say?"
                        className="w-full h-[60px] bg-white border border-g300 rounded-[3px] p-3 text-[12px] outline-none focus:border-red-mrt resize-none"
                        value={note}
                        onChange={e => setNote(e.target.value)}
                      />
                    </div>

                    {/* Next Step */}
                    <div>
                      <div className="font-mono text-[9px] font-bold tracking-[2px] uppercase text-g500 mb-4 opacity-0">Hidden Header</div>
                      <div className="font-mono text-[8px] tracking-[1.5px] uppercase text-g500 font-bold mb-2">Next Follow-Up Planned</div>
                      <select
                        title="Next follow-up action"
                        className="w-full bg-white border border-g300 rounded-[3px] px-3 py-2 text-[12px] mb-2 outline-none focus:border-red-mrt"
                        value={nextAction}
                        onChange={e => setNextAction(e.target.value as any)}
                      >
                        <option value="">— Action —</option>
                        <option value="Called">Called</option>
                        <option value="WhatsApp">WhatsApp</option>
                        <option value="Email">Email</option>
                        <option value="Meeting">Meeting</option>
                        <option value="Visit">Visit</option>
                      </select>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="date"
                          title="Next follow-up date"
                          placeholder="yyyy-mm-dd"
                          min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                          className="flex-1 bg-white border border-g300 rounded-[3px] px-3 py-1.5 text-[12px] outline-none focus:border-red-mrt"
                          value={nextDate}
                          onChange={e => setNextDate(e.target.value)}
                        />
                        <input
                          type="time"
                          title="Next follow-up time"
                          placeholder="HH:MM"
                          className="w-[110px] bg-white border border-g300 rounded-[3px] px-3 py-1.5 text-[12px] outline-none focus:border-red-mrt"
                          value={nextTime}
                          onChange={e => setNextTime(e.target.value)}
                        />
                      </div>

                      {nextDate && (
                        <textarea
                          value={nextNote}
                          onChange={e => setNextNote(e.target.value)}
                          placeholder="What to do on next follow-up? (optional)"
                          rows={2}
                          className="w-full bg-white border border-g300 rounded-[3px] px-3 py-1.5 text-[11.5px] outline-none focus:border-red-mrt resize-none"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleQuotePDF(selectedItem.quote)}
                        title="Download Quotation PDF"
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold tracking-wider uppercase rounded-[4px] border border-g300 text-blk bg-white hover:bg-g50 hover:border-blk transition-colors"
                      >
                        <FileText size={12} /> Quote PDF
                      </button>
                      {(() => {
                        const hasOrder = !!data.orders.find(o => o.quoteRef === selectedItem.quote.id);
                        return (
                          <button
                            type="button"
                            onClick={() => handlePIPDF(selectedItem.quote)}
                            disabled={!hasOrder}
                            title={hasOrder ? 'Download Proforma Invoice PDF' : 'No order created yet for this quote'}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold tracking-wider uppercase rounded-[4px] border border-g300 text-blk bg-white hover:bg-g50 hover:border-blk transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-g300"
                          >
                            <Receipt size={12} /> PI PDF
                          </button>
                        );
                      })()}
                      <button
                        type="button"
                        onClick={() => openAttachmentModal('quote', selectedItem.quote.id)}
                        title="View attachments"
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold tracking-wider uppercase rounded-[4px] border border-g300 text-blk bg-white hover:bg-g50 hover:border-blk transition-colors"
                      >
                        <Paperclip size={12} /> Docs
                      </button>
                    </div>
                    <button
                      type="submit"
                      className="bg-red-mrt text-white font-mono text-[10px] uppercase font-bold tracking-wider px-6 py-2.5 rounded-[3px] transition-colors hover:bg-red-h active:scale-95 flex items-center gap-1"
                    >
                      <CheckCircle2 size={12} />
                      Log Activity
                    </button>
                  </div>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface FUCalWeekGridProps {
  days: Date[];
  eventMap: Record<string, { quote: Quote; followUp: FollowUp | undefined }[]>;
  selectedQuoteId: string | null;
  onSelect: (id: string) => void;
  todayKey: string;
  weekLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

function FUCalWeekGrid({ days, eventMap, selectedQuoteId, onSelect, todayKey, weekLabel, onPrev, onNext, onToday }: FUCalWeekGridProps) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Nav bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-g200 bg-white shrink-0">
        <button type="button" onClick={onPrev} title="Previous week" className="p-1 rounded hover:bg-g100 text-g500 hover:text-blk transition-colors">
          <ChevronLeft size={14} />
        </button>
        <div className="text-[11px] font-mono font-bold text-blk">{weekLabel}</div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onToday} className="text-[10px] font-bold text-red-mrt uppercase tracking-wide hover:underline px-2">
            Today
          </button>
          <button type="button" onClick={onNext} title="Next week" className="p-1 rounded hover:bg-g100 text-g500 hover:text-blk transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* 7-column grid */}
      <div className="grid grid-cols-7 flex-1 overflow-y-auto divide-x divide-g100 border-t border-g100">
        {days.map(day => {
          const key = dateKey(day);
          const items = eventMap[key] ?? [];
          const isTodayCol = key === todayKey;
          return (
            <div key={key} className={cn('flex flex-col min-h-[160px]', isTodayCol && 'bg-red-lt/20')}>
              {/* Day header */}
              <div className={cn(
                'px-1 py-1.5 text-center border-b border-g100 shrink-0',
                isTodayCol ? 'bg-red-mrt text-white' : 'bg-g50 text-blk'
              )}>
                <div className="text-[8px] font-bold uppercase tracking-wide opacity-70">{fmtIST(day, 'EEE')}</div>
                <div className="text-[15px] font-mono font-bold leading-none mt-0.5">{fmtIST(day, 'd')}</div>
                <div className="text-[8px] opacity-60">{fmtIST(day, 'MMM')}</div>
              </div>
              {/* Pills */}
              <div className="flex-1 p-1 space-y-1 overflow-y-auto">
                {items.map(({ quote, followUp }) => (
                  <button
                    key={quote.id}
                    type="button"
                    onClick={() => onSelect(quote.id)}
                    className={cn(
                      'w-full text-left px-1.5 py-1 rounded text-[10px] border leading-snug transition-colors',
                      'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100',
                      selectedQuoteId === quote.id && 'ring-1 ring-purple-500'
                    )}
                  >
                    <div className="font-bold truncate">{quote.cust}</div>
                    <div className="font-mono opacity-60 truncate text-[9px]">{quote.id}</div>
                    {followUp?.next_time && (
                      <div className="opacity-60 text-[9px] flex items-center gap-0.5 mt-0.5">
                        <Clock size={8} />{followUp.next_time}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
