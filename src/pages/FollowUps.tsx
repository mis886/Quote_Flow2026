import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { format, isBefore, isToday, parseISO, startOfDay, addDays } from 'date-fns';
import {
  Phone,
  Mail,
  MessageCircle,
  Users,
  MapPin,
  Calendar,
  Clock,
  Search,
  Filter,
  CheckCircle2,
  Send,
  User,
  History,
  RotateCcw,
  FileText,
  Receipt,
  Paperclip,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { Quote, FollowUp, FollowUpLog } from '../lib/types';
import { generateQuotePDF, generatePIPDF } from '../lib/pdfGenerator';

const CHANNEL_CONFIG: Record<string, { icon: string; color: string; bg: string; border: string }> = {
  Called:    { icon: '📞', color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200' },
  WhatsApp:  { icon: '💬', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  Email:     { icon: '📧', color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200' },
  Meeting:   { icon: '🤝', color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200' },
  Visit:     { icon: '📍', color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200' },
};

function formatDue(date: string | null | undefined, time?: string | null) {
  if (!date) return null;
  const label = isToday(parseISO(date)) ? 'Today' : format(parseISO(date), 'dd MMM');
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
  const { data, addFollowUpLog, closeFollowUp, reopenFollowUp, openAttachmentModal, user } = useAppStore();
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [filterOwner, setFilterOwner] = useState<string>('All Owners');
  const [searchQuery, setSearchQuery] = useState('');
  const [queueTab, setQueueTab] = useState<'open' | 'closed'>('open');

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

      let priority: 'overdue' | 'today' | 'upcoming' | 'none' = 'none';
      if (followUp?.next_date) {
        const d = parseISO(followUp.next_date);
        if (isBefore(d, today)) priority = 'overdue';
        else if (isToday(d)) priority = 'today';
        else priority = 'upcoming';
      }

      return { quote, followUp, priority };
    }).filter(item => {
      const status = item.followUp?.status ?? 'open';
      if (status !== queueTab) return false;

      const matchesSearch =
        item.quote.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.quote.cust.toLowerCase().includes(searchQuery.toLowerCase());

      const owner = item.followUp?.owner || 'Unassigned';
      const matchesOwner = filterOwner === 'All Owners' || owner === filterOwner;

      return matchesSearch && matchesOwner;
    }).sort((a, b) => {
      const priorityOrder = { overdue: 0, today: 1, upcoming: 2, none: 3 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      if (a.followUp?.next_date && b.followUp?.next_date) {
        return a.followUp.next_date.localeCompare(b.followUp.next_date);
      }
      return 0;
    });
  }, [data.quotes, data.followups, searchQuery, filterOwner, queueTab]);

  const allOpen = useMemo(() =>
    data.quotes.filter(q => q.status !== 'Lost').filter(q => {
      const f = data.followups.find(fu => fu.quote_id === q.id);
      return (f?.status ?? 'open') === 'open';
    }),
    [data.quotes, data.followups]
  );

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

  return (
    <div className="flex h-full bg-cream overflow-hidden">
      {/* Left Panel: Queue */}
      <div className="w-[380px] border-r border-g200 flex flex-col bg-white">
        <div className="p-4 border-b border-g200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-mono text-[10px] font-bold tracking-[2px] uppercase text-red-mrt mb-1">Queue</div>
              <h1 className="text-xl font-serif text-blk italic">Command Centre</h1>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <div className="flex-1 px-2.5 py-1.5 bg-red-lt rounded-[4px] border border-red-mrt/10">
              <div className="text-[10px] uppercase font-bold text-red-mrt opacity-60">Overdue</div>
              <div className="text-lg font-mono font-bold text-red-mrt leading-none mt-1">{stats.overdue}</div>
            </div>
            <div className="flex-1 px-2.5 py-1.5 bg-sR/5 rounded-[4px] border border-sR/10">
              <div className="text-[10px] uppercase font-bold text-sR opacity-60">Today</div>
              <div className="text-lg font-mono font-bold text-sR leading-none mt-1">{stats.today}</div>
            </div>
            <div className="flex-1 px-2.5 py-1.5 bg-sW/5 rounded-[4px] border border-sW/10">
              <div className="text-[10px] uppercase font-bold text-sW opacity-60">Upcoming</div>
              <div className="text-lg font-mono font-bold text-sW leading-none mt-1">{stats.upcoming}</div>
            </div>
          </div>

          {/* Active / Closed tabs */}
          <div className="flex gap-1 mb-3 bg-g100 rounded-[4px] p-1">
            <button
              onClick={() => { setQueueTab('open'); setSelectedQuoteId(null); }}
              className={cn(
                "flex-1 py-1 text-[10px] font-mono font-bold uppercase tracking-wider rounded-[3px] transition-colors",
                queueTab === 'open' ? "bg-white text-blk shadow-sm" : "text-g500 hover:text-blk"
              )}
            >
              Active
            </button>
            <button
              onClick={() => { setQueueTab('closed'); setSelectedQuoteId(null); }}
              className={cn(
                "flex-1 py-1 text-[10px] font-mono font-bold uppercase tracking-wider rounded-[3px] transition-colors",
                queueTab === 'closed' ? "bg-white text-blk shadow-sm" : "text-g500 hover:text-blk"
              )}
            >
              Closed
            </button>
          </div>

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
                className="flex-1 bg-g50 border border-g200 rounded-[4px] px-2 py-1 text-[11px] font-medium"
                value={filterOwner}
                onChange={e => setFilterOwner(e.target.value)}
              >
                {owners.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {followUpQueue.map(({ quote, followUp, priority }) => (
            <button
              key={quote.id}
              onClick={() => setSelectedQuoteId(quote.id)}
              className={cn(
                "w-full text-left p-3 rounded-[6px] border transition-all duration-200 group relative",
                (selectedQuoteId === quote.id || (selectedItem && selectedItem.quote.id === quote.id))
                  ? "bg-red-lt border-red-mrt/20"
                  : "bg-white border-transparent hover:bg-g50 hover:border-g200"
              )}
            >
              <div className="flex items-start justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-8 h-8 rounded-[4px] flex items-center justify-center font-mono text-[10px] font-bold",
                    isClosedTab ? "bg-emerald-100 text-emerald-700" :
                    priority === 'overdue' ? "bg-red-mrt text-white shadow-[0_2px_8px_rgba(212,32,39,0.2)]" :
                    priority === 'today' ? "bg-sR text-white" :
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
                  priority === 'upcoming' ? "border-sW text-sW bg-sW/5" :
                  "border-g300 text-g500 bg-g100"
                )}>
                  {isClosedTab ? 'Closed' : priority === 'none' ? 'New' : priority}
                </div>
              </div>

              <div className="text-[13px] font-bold text-blk mb-1 truncate">{quote.cust}</div>

              <div className="flex items-center justify-between text-[11px] text-g500">
                <div className="flex items-center gap-3">
                  <span className="font-mono">Rs{quote.items.reduce((a, i) => a + i.total, 0).toLocaleString('en-IN')}</span>
                  <span className="w-1 h-1 rounded-full bg-g300" />
                  <span>{quote.items.length} Items</span>
                </div>
                <div className="flex items-center gap-1 font-medium">
                  {!isClosedTab && followUp?.next_date && (priority === 'overdue' || priority === 'today') ? (
                    <Clock size={11} className={priority === 'overdue' ? 'text-red-mrt animate-pulse' : 'text-sR'} />
                  ) : <Calendar size={11} />}
                  <span>
                    {isClosedTab ? 'Closed' :
                      formatDue(followUp?.next_date, followUp?.next_time) ?? 'No Date'}
                  </span>
                </div>
              </div>
            </button>
          ))}
          {followUpQueue.length === 0 && (
            <div className="p-8 text-center bg-g50 rounded-lg border border-dashed border-g200 mx-2 mt-4">
              <Users className="mx-auto text-g300 mb-2" size={24} />
              <div className="text-[12px] font-bold text-g500">
                {isClosedTab ? 'No closed follow-ups' : 'No follow-ups match'}
              </div>
              <div className="text-[10px] text-g400">Try adjusting your filters</div>
            </div>
          )}
        </div>
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
                    {/* Close / Reopen — status action stays in header */}
                    {isClosedTab ? (
                      <button
                        type="button"
                        onClick={handleReopen}
                        className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase rounded-[4px] border border-g300 text-g600 bg-white hover:bg-g50 hover:text-blk transition-colors"
                      >
                        <RotateCcw size={12} /> Re-open
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleClose}
                        className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase rounded-[4px] border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                      >
                        <CheckCircle2 size={12} /> Close Follow-Up
                      </button>
                    )}
                  </div>
                  <h1 className="text-3xl font-serif text-blk italic truncate mb-4">{selectedItem.quote.cust}</h1>

                  <div className="flex flex-wrap gap-6 items-center">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-g400 tracking-wider">Value</span>
                      <span className="font-mono text-[14px] font-bold text-blk">Rs{selectedItem.quote.items.reduce((a, i) => a + i.total, 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="w-px h-6 bg-g200" />
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-g400 tracking-wider">Valid Till</span>
                      <span className="text-[14px] font-medium text-blk">{format(parseISO(selectedItem.quote.validity), 'dd MMM yyyy')}</span>
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
                </div>

                <div className={cn(
                  "p-4 rounded-lg flex flex-col items-center justify-center min-w-[120px]",
                  isClosedTab ? "bg-emerald-50 border border-emerald-100" :
                  selectedItem.priority === 'overdue' ? "bg-red-lt border border-red-mrt/10" :
                  selectedItem.priority === 'today' ? "bg-sR/5 border border-sR/10" : "bg-g50"
                )}>
                  <div className="text-[10px] uppercase font-bold text-g400 mb-1">Status</div>
                  <div className={cn(
                    "text-sm font-bold uppercase tracking-wider",
                    isClosedTab ? "text-emerald-700" :
                    selectedItem.priority === 'overdue' ? "text-red-mrt" :
                    selectedItem.priority === 'today' ? "text-sR" : "text-g500"
                  )}>
                    {isClosedTab ? 'Closed' : selectedItem.priority === 'none' ? 'Not Scheduled' : selectedItem.priority}
                  </div>
                  {!isClosedTab && selectedItem.followUp?.next_date && (
                    <div className="text-[11px] font-medium text-g500 mt-1">
                      {formatDue(selectedItem.followUp.next_date, selectedItem.followUp.next_time)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Content: Chat Timeline & Form */}
            <div className="flex-1 overflow-hidden flex flex-col bg-g50 relative">
              {/* Chat-bubble activity log */}
              <div className="flex-1 overflow-y-auto p-6 pb-2">
                <div className="flex items-center gap-2 mb-4">
                  <History size={16} className="text-g400" />
                  <span className="font-mono text-[9px] font-bold tracking-[2px] uppercase text-g500">Activity History</span>
                </div>

                {(!selectedItem.followUp || selectedItem.followUp.logs.length === 0) ? (
                  <div className="py-8 text-center text-g400 text-[12px]">No activity logged yet.</div>
                ) : (
                  <div className="space-y-4">
                    {groupLogsByDay(selectedItem.followUp.logs).map(({ day, logs }) => (
                      <div key={day}>
                        {/* Date divider */}
                        <div className="flex items-center gap-3 my-3">
                          <div className="flex-1 h-px bg-g200" />
                          <span className="text-[10px] font-mono font-bold text-g400 bg-g50 px-2">
                            {isToday(parseISO(day)) ? 'Today' : format(parseISO(day), 'dd MMM yyyy')}
                          </span>
                          <div className="flex-1 h-px bg-g200" />
                        </div>

                        {logs.map((log, idx) => {
                          const cfg = CHANNEL_CONFIG[log.channel] ?? CHANNEL_CONFIG['Called'];
                          const isSystem = log.note?.startsWith('Quote sent —');

                          if (isSystem) {
                            return (
                              <div key={idx} className="flex justify-center my-2">
                                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                                  <span className="text-[10px]">📨</span>
                                  <span className="text-[11px] text-amber-700 font-medium">{log.note}</span>
                                  <span className="text-[9px] text-amber-500 font-mono">
                                    {format(parseISO(log.ts), 'hh:mm aa')}
                                  </span>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={idx} className="flex justify-end mb-2">
                              <div className={cn("max-w-[85%] rounded-[12px] border px-4 py-3", cfg.bg, cfg.border)}>
                                {/* Channel badge */}
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <span className="text-[11px]">{cfg.icon}</span>
                                  <span className={cn("text-[9px] font-bold uppercase tracking-widest", cfg.color)}>{log.channel}</span>
                                </div>
                                <p className="text-[13px] text-blk leading-relaxed whitespace-pre-wrap mb-2">{log.note}</p>
                                {log.nextDate && (
                                  <div className="mb-1.5">
                                    <div className="text-[11px] font-semibold text-sR">
                                      → Next: {log.nextDate}{log.nextChannel ? ` via ${log.nextChannel}` : ''}
                                    </div>
                                    {log.nextNote && (
                                      <div className="text-[10.5px] italic text-g500 mt-0.5 pl-2 border-l-2 border-g200">
                                        {log.nextNote}
                                      </div>
                                    )}
                                  </div>
                                )}
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-[10px] text-g500 font-medium">{log.who}</span>
                                  <span className="text-[9px] text-g400 font-mono">{format(parseISO(log.ts), 'hh:mm aa')}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
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
