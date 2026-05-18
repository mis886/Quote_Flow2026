import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { formatINR, cn, getThisWeekRange } from '../lib/utils';
import { Badge, Button } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import { Plus, Clock, IndianRupee, FileSignature, Trophy, Activity, Phone, Mail, MessageSquare, Users, FileText, ShoppingBag, AlertCircle, CalendarClock, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react';

type Period = '30d' | 'quarter' | 'year';
type DashTab = 'overview' | 'this-week';

type ActivityItem = {
  ts: string;
  type: 'enquiry' | 'quote' | 'order' | 'followup';
  who: string;
  title: string;
  subtitle: string;
  refId: string;
  refType: string;
};

export function Dashboard() {
  // @ts-ignore - Assuming globalDateRange is added to the store
  const { data, openDetailPanel, user, globalDateRange } = useAppStore();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>('30d');
  const [activeTab, setActiveTab] = useState<DashTab>('overview');
  const [expandedMdo, setExpandedMdo] = useState<Record<string, boolean>>({});

  const userName = user?.email ? user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ') : 'User';
  const formattedName = userName.charAt(0).toUpperCase() + userName.slice(1);

  const openEnqs = data.enquiries.filter(e => e.status === 'New' || e.status === 'In Review');
  const attnEnqs = openEnqs.filter(e => e.ageH >= 4);

  const openQuotes = data.quotes.filter(q => q.status === 'Sent');

  const openPipeVal = openQuotes.reduce((acc, q) => {
    const sub = q.items.reduce((s, i) => s + i.total, 0);
    const gst = q.items.reduce((s, i) => s + (i.total * i.gst / 100), 0);
    return acc + sub + gst;
  }, 0);


  const openQuoteString = openQuotes.length > 0
    ? `${openQuotes.length} quotes awaiting PO`
    : 'No sent quotes';

  // Avg E2Q: diff quote.date − enquiry.recv for enquiries that have a linked quote
  const e2qSamples: number[] = [];
  for (const enq of data.enquiries) {
    if (!enq.qRef) continue;
    const quote = data.quotes.find(q => q.id === enq.qRef);
    if (!quote?.date || !enq.recv) continue;
    const diffH = (new Date(quote.date).getTime() - new Date(enq.recv).getTime()) / 3_600_000;
    if (diffH >= 0) e2qSamples.push(diffH);
  }
  const avgE2Q = e2qSamples.length
    ? (e2qSamples.reduce((a, b) => a + b, 0) / e2qSamples.length).toFixed(1)
    : null;

  // ── Trend helpers ─────────────────────────────────────────────────────────
  function pctTrend(current: number, prev: number): number | null {
    if (prev === 0 && current === 0) return null;
    if (prev === 0) return null;
    return Math.round(((current - prev) / prev) * 100);
  }

  const now = Date.now();

  // Period window in ms
  const periodMs = period === '30d' ? 30 * 24 * 3600 * 1000
    : period === 'quarter' ? 91 * 24 * 3600 * 1000
    : 365 * 24 * 3600 * 1000;

  const isWithinCurrentPeriod = (dateString?: string | null) => {
    if (!dateString) return false;
    const d = new Date(dateString).getTime();
    if (globalDateRange?.startDate && d < new Date(globalDateRange.startDate).getTime()) return false;
    if (globalDateRange?.endDate && d > new Date(globalDateRange.endDate).getTime() + 86400000) return false;
    if (!globalDateRange?.startDate && !globalDateRange?.endDate) return (now - d) <= periodMs;
    return true;
  };

  const isWithinPrevPeriod = (dateString?: string | null) => {
    if (!dateString) return false;
    if (globalDateRange?.startDate || globalDateRange?.endDate) return false; // Disable trends for custom ranges
    const age = now - new Date(dateString).getTime();
    return age > periodMs && age <= 2 * periodMs;
  };

  // Quotes in current period vs prev period
  const quotesInPeriod = data.quotes.filter(q => isWithinCurrentPeriod(q.date));
  const quotesInPrevPeriod = data.quotes.filter(q => isWithinPrevPeriod(q.date));
  const quotesSentTrendRaw = pctTrend(quotesInPeriod.length, quotesInPrevPeriod.length);

  const quoteValInPeriod = quotesInPeriod.reduce((acc, q) => acc + q.items.reduce((s, i) => s + i.total + (i.total * i.gst / 100), 0), 0);
  const quoteValInPrev   = quotesInPrevPeriod.reduce((acc, q) => acc + q.items.reduce((s, i) => s + i.total + (i.total * i.gst / 100), 0), 0);
  const quoteValTrendRaw = pctTrend(quoteValInPeriod, quoteValInPrev);

  // Win rate in period
  const closedInPeriod = data.enquiries.filter(e => {
    return (e.status === 'Won' || e.status === 'Lost') && isWithinCurrentPeriod(e.recv);
  });
  const wonInPeriod = closedInPeriod.filter(e => e.status === 'Won');
  const winRateInPeriod = closedInPeriod.length ? Math.round((wonInPeriod.length / closedInPeriod.length) * 100) : 0;
  const closedInPrev = data.enquiries.filter(e => {
    return (e.status === 'Won' || e.status === 'Lost') && isWithinPrevPeriod(e.recv);
  });
  const winRatePrevPeriod = closedInPrev.length ? Math.round(closedInPrev.filter(e => e.status === 'Won').length / closedInPrev.length * 100) : 0;
  const winRateTrendRaw = pctTrend(winRateInPeriod, winRatePrevPeriod);

  // E2Q trend in period
  const currentE2Q: number[] = [];
  const prevE2Q: number[] = [];
  for (const enq of data.enquiries) {
    if (!enq.qRef) continue;
    const quote = data.quotes.find(q => q.id === enq.qRef);
    if (!quote?.date || !enq.recv) continue;
    const diffH = (new Date(quote.date).getTime() - new Date(enq.recv).getTime()) / 3_600_000;
    if (diffH < 0) continue;
    if (isWithinCurrentPeriod(quote.date)) currentE2Q.push(diffH);
    else if (isWithinPrevPeriod(quote.date)) prevE2Q.push(diffH);
  }
  const currentE2QAvg = currentE2Q.length ? currentE2Q.reduce((a, b) => a + b, 0) / currentE2Q.length : 0;
  const prevE2QAvg    = prevE2Q.length    ? prevE2Q.reduce((a, b) => a + b, 0)    / prevE2Q.length    : 0;
  const e2qTrendRaw   = pctTrend(currentE2QAvg, prevE2QAvg);

  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const getTrendStr = (trend: number | null): string | undefined => {
    if (trend === null) return undefined;
    return `${trend > 0 ? '+' : ''}${trend}%`;
  };

  const getTrendColor = (trend: number | null, isInverse: boolean = false): 'up' | 'dn' | 'neutral' | undefined => {
    if (trend === null) return undefined;
    if (trend === 0) return 'neutral';
    if (isInverse) return trend < 0 ? 'up' : 'dn';
    return trend > 0 ? 'up' : 'dn';
  };

  const AgeCell = ({ hours }: { hours: number }) => {
    let color = "text-[#059669]";
    let dot = "bg-[#059669]";
    let text = `${hours.toFixed(1)}h`;
    if (hours < 0.1) text = "Now";
    else if (hours >= 24) {
      color = "text-red-mrt";
      dot = "bg-red-mrt animate-pulse";
      text = `${Math.floor(hours/24)}d ${Math.round(hours%24)}h`;
    } else if (hours >= 4) {
      color = "text-[#d97706]";
      dot = "bg-[#d97706]";
      text = `${Math.round(hours)}h`;
    }
    return (
      <div className={`flex items-center gap-1.5 font-mono text-[10.5px] font-bold ${color}`}>
        <div className={`w-[7px] h-[7px] rounded-full ${dot}`}></div>
        {text}
      </div>
    );
  };

  // Enquiry Sources for pie chart
  const sourceColors = ['#D42027', '#2563EB', '#059669', '#d97706', '#7C3AED'];
  const sources = ['Email', 'Phone', 'WhatsApp', 'Exhibition', 'Website'];
  const sourceCounts = sources.map((src, i) => ({
    src,
    count: data.enquiries.filter(e => e.src === src).length,
    color: sourceColors[i],
  })).filter(s => s.count > 0).sort((a, b) => b.count - a.count);
  const totalSources = sourceCounts.reduce((s, c) => s + c.count, 0);

  // Open Quote Value By Customer
  const custQuotes: Record<string, number> = {};
  openQuotes.forEach(q => {
    custQuotes[q.cust] = (custQuotes[q.cust] || 0) + q.items.reduce((acc, i) => acc + i.total + (i.total * i.gst / 100), 0);
  });
  const openCustData = Object.entries(custQuotes)
    .map(([cust, val]) => ({ cust, val }))
    .sort((a, b) => b.val - a.val)
    .slice(0, 5);
  const maxOpenCustVal = Math.max(...openCustData.map(c => c.val), 1);

  // Recent Quotations (latest 5)
  const recentQuotes = [...data.quotes]
    .filter(q => q.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  // ── This Week computations ────────────────────────────────────────────────
  const { start: weekStart, end: weekEnd } = getThisWeekRange();

  const inThisWeek = (dateStr?: string | null) => {
    if (!dateStr) return false;
    const d = new Date(dateStr).getTime();
    return d >= weekStart.getTime() && d <= weekEnd.getTime();
  };

  const weekLabel = `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;

  const activityFeed = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];

    // Enquiries received this week
    data.enquiries.forEach(e => {
      if (!inThisWeek(e.recv)) return;
      items.push({
        ts: e.recv,
        type: 'enquiry',
        who: e.assigned || 'Team',
        title: `Enquiry ${e.id} received from ${e.cust}`,
        subtitle: `${e.urg} · ${e.items.length} item${e.items.length !== 1 ? 's' : ''} · ${e.src}`,
        refId: e.id,
        refType: 'enquiry',
      });
    });

    // Quotes issued (non-draft) this week
    data.quotes.forEach(q => {
      if (q.status === 'Draft') return;
      if (!inThisWeek(q.date)) return;
      const val = q.items.reduce((s, i) => s + i.total + (i.total * i.gst / 100), 0);
      items.push({
        ts: q.date,
        type: 'quote',
        who: 'Team',
        title: `Quote ${q.id} issued to ${q.cust}`,
        subtitle: `${q.status} · ${formatINR(val)}`,
        refId: q.id,
        refType: 'quote',
      });
    });

    // Orders placed this week
    data.orders.forEach(o => {
      if (!inThisWeek(o.poDate)) return;
      const val = o.items.reduce((s, i) => s + (i.total || 0), 0);
      items.push({
        ts: o.poDate!,
        type: 'order',
        who: 'Team',
        title: `Order ${o.id} received from ${o.cust}`,
        subtitle: `PO: ${o.poNo} · ${formatINR(val)}`,
        refId: o.id,
        refType: 'order',
      });
    });

    // Follow-up logs this week
    data.followups.forEach(fu => {
      (fu.logs || []).forEach(log => {
        if (!inThisWeek(log.ts)) return;
        items.push({
          ts: log.ts,
          type: 'followup',
          who: log.who || fu.owner || 'Team',
          title: `Follow-up logged on ${fu.quote_id}`,
          subtitle: `${log.channel} · ${log.note?.slice(0, 60) || '—'}`,
          refId: fu.quote_id,
          refType: 'quote',
        });
      });
    });

    return items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [data, weekStart.getTime()]);

  // ── MDO Panel computations ─────────────────────────────────────────────────
  const SLA_H: Record<string, number> = { Hot: 4, Urgent: 24, Normal: 48, Low: 72 };

  const mdoPendingFollowups = useMemo(() =>
    data.followups.filter(fu =>
      fu.status === 'open' && fu.next_date && inThisWeek(fu.next_date)
    ), [data.followups, weekStart.getTime()]);

  const mdoOverdueEnqs = useMemo(() =>
    data.enquiries.filter(e =>
      (e.status === 'New' || e.status === 'In Review') &&
      e.ageH >= (SLA_H[e.urg] ?? 48)
    ), [data.enquiries]);

  const mdoQuotesAwaitingDecision = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
    return data.quotes.filter(q => {
      if (q.status !== 'Sent') return false;
      const fu = data.followups.find(f => f.quote_id === q.id);
      if (!fu || !fu.logs || fu.logs.length === 0) return true;
      const lastLog = fu.logs[fu.logs.length - 1];
      return new Date(lastLog.ts).getTime() < sevenDaysAgo;
    });
  }, [data.quotes, data.followups]);

  const mdoOpenOrders = useMemo(() => {
    const todayTs = new Date();
    todayTs.setHours(23, 59, 59, 999);
    return data.orders.filter(o =>
      o.status === 'Processing' && o.dlvDate && new Date(o.dlvDate) <= todayTs
    );
  }, [data.orders]);

  const mdoPipelineCounts = useMemo(() => ({
    openEnqs: data.enquiries.filter(e => e.status === 'New' || e.status === 'In Review').length,
    sentQuotes: data.quotes.filter(q => q.status === 'Sent').length,
    processingOrders: data.orders.filter(o => o.status === 'Processing').length,
  }), [data]);

  const toggleMdo = (key: string) => setExpandedMdo(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300 overflow-y-auto">
      <div className="pt-5 px-[30px] shrink-0">
        <div className="flex items-start justify-between gap-3 pb-4">
          <div>
            <h1 className="font-serif text-2xl text-blk tracking-tight leading-tight flex items-baseline gap-2">
              Good morning, <em className="italic text-red-mrt font-serif ml-0.5">{formattedName}</em>
            </h1>
            <p className="text-[13px] text-g600 mt-1 font-medium">
              {formattedDate} — <strong className={attnEnqs.length > 0 ? "text-red-mrt" : "text-[#059669]"}>
                {attnEnqs.length > 0 ? `${attnEnqs.length} enquiries need response today` : 'All caught up today'}
              </strong>
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 mt-2">
            {activeTab === 'overview' && !globalDateRange?.startDate && !globalDateRange?.endDate && (
              <select
                title="Dashboard period"
                value={period}
                onChange={e => setPeriod(e.target.value as Period)}
                className="h-8 px-2.5 pr-7 text-[11px] font-mono font-bold tracking-[1px] text-g600 bg-white border border-g200 rounded-[3px] outline-none focus:border-red-mrt appearance-none bg-[url('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\'%3E%3Cpath d=\'M1 1l4 4 4-4\' stroke=\'%23888\' stroke-width=\'1.5\' fill=\'none\' stroke-linecap=\'round\'/%3E%3C/svg%3E')] bg-no-repeat bg-[right_7px_center] cursor-pointer"
              >
                <option value="30d">Last 30 days</option>
                <option value="quarter">This quarter</option>
                <option value="year">This year</option>
              </select>
            )}
            <Button variant="secondary" onClick={() => navigate('/enquiries')}>View All</Button>
            <Button variant="primary" onClick={() => navigate('/enquiries/new')}>
              <Plus size={14} className="stroke-[2.5px]" /> Log Enquiry
            </Button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0 border-b border-g200 mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 font-mono text-[10px] font-bold tracking-[1.5px] uppercase border-b-2 -mb-px transition-colors focus:outline-none',
              activeTab === 'overview'
                ? 'border-red-mrt text-red-mrt'
                : 'border-transparent text-g400 hover:text-g600'
            )}
          >
            <TrendingUp size={12} />
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('this-week')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 font-mono text-[10px] font-bold tracking-[1.5px] uppercase border-b-2 -mb-px transition-colors focus:outline-none',
              activeTab === 'this-week'
                ? 'border-red-mrt text-red-mrt'
                : 'border-transparent text-g400 hover:text-g600'
            )}
          >
            <Activity size={12} />
            This Week
            {activityFeed.length > 0 && (
              <span className="ml-1 bg-red-mrt text-white font-mono text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                {activityFeed.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'this-week' && (
        <div className="px-[30px] pb-6 flex flex-col gap-4">

          {/* Pipeline snapshot KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-g200 rounded-[8px] p-4 flex items-center gap-3 shadow-sm">
              <div className="w-9 h-9 rounded-[6px] bg-blue-50 flex items-center justify-center shrink-0">
                <FileText size={16} className="text-blue-500" />
              </div>
              <div>
                <div className="font-mono text-[9px] font-bold tracking-[1.5px] uppercase text-g400">Open Enquiries</div>
                <div className="font-serif text-[26px] font-bold text-blk leading-none mt-0.5">{mdoPipelineCounts.openEnqs}</div>
              </div>
            </div>
            <div className="bg-white border border-g200 rounded-[8px] p-4 flex items-center gap-3 shadow-sm">
              <div className="w-9 h-9 rounded-[6px] bg-orange-50 flex items-center justify-center shrink-0">
                <FileSignature size={16} className="text-orange-500" />
              </div>
              <div>
                <div className="font-mono text-[9px] font-bold tracking-[1.5px] uppercase text-g400">Quotes Pending PO</div>
                <div className="font-serif text-[26px] font-bold text-blk leading-none mt-0.5">{mdoPipelineCounts.sentQuotes}</div>
              </div>
            </div>
            <div className="bg-white border border-g200 rounded-[8px] p-4 flex items-center gap-3 shadow-sm">
              <div className="w-9 h-9 rounded-[6px] bg-teal-50 flex items-center justify-center shrink-0">
                <ShoppingBag size={16} className="text-teal-500" />
              </div>
              <div>
                <div className="font-mono text-[9px] font-bold tracking-[1.5px] uppercase text-g400">Orders Processing</div>
                <div className="font-serif text-[26px] font-bold text-blk leading-none mt-0.5">{mdoPipelineCounts.processingOrders}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[1.6fr_1fr] gap-4 items-start">

            {/* Activity Feed */}
            <div className="bg-white border border-g200 rounded-[8px] overflow-hidden shadow-sm">
              <div className="p-[10px_16px] border-b border-g200 flex items-center justify-between">
                <span className="font-mono text-[9px] font-bold tracking-[2.5px] uppercase text-g500 flex items-center gap-2">
                  <Activity size={11} className="text-red-mrt" />
                  What Happened This Week
                </span>
                <span className="font-mono text-[9px] text-g400 tracking-[1px]">{weekLabel}</span>
              </div>
              {activityFeed.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-10 text-center">
                  <div className="text-[24px] mb-2 opacity-20">📋</div>
                  <div className="text-[13px] font-bold text-blk mb-1">No activity yet</div>
                  <div className="text-[12px] text-g400">Enquiries, quotes, orders and follow-ups logged this week will appear here.</div>
                </div>
              ) : (
                <div className="divide-y divide-g100">
                  {activityFeed.map((item, idx) => {
                    const iconMap = {
                      enquiry: <FileText size={13} className="text-blue-500" />,
                      quote: <FileSignature size={13} className="text-orange-500" />,
                      order: <ShoppingBag size={13} className="text-emerald-500" />,
                      followup: <Phone size={13} className="text-purple-500" />,
                    };
                    const dotColor = {
                      enquiry: 'bg-blue-500',
                      quote: 'bg-orange-500',
                      order: 'bg-emerald-500',
                      followup: 'bg-purple-500',
                    }[item.type];
                    const timeStr = new Date(item.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                    const dateStr = new Date(item.ts).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
                    return (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => openDetailPanel(item.refType as any, item.refId)}
                        className="w-full flex items-start gap-3 p-[10px_16px] hover:bg-g50 transition-colors text-left focus:outline-none"
                      >
                        <div className="relative flex flex-col items-center shrink-0 mt-0.5">
                          <div className={cn('w-[28px] h-[28px] rounded-full flex items-center justify-center', {
                            'bg-blue-50': item.type === 'enquiry',
                            'bg-orange-50': item.type === 'quote',
                            'bg-emerald-50': item.type === 'order',
                            'bg-purple-50': item.type === 'followup',
                          })}>
                            {iconMap[item.type]}
                          </div>
                          {idx < activityFeed.length - 1 && (
                            <div className="w-px flex-1 bg-g100 mt-1 h-full absolute top-[28px] bottom-[-10px]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-[12.5px] font-semibold text-blk leading-tight">{item.title}</div>
                            <div className="text-right shrink-0">
                              <div className="font-mono text-[9.5px] font-bold text-g400">{timeStr}</div>
                              <div className="font-mono text-[9px] text-g300">{dateStr}</div>
                            </div>
                          </div>
                          <div className="text-[11.5px] text-g500 mt-0.5 truncate">{item.subtitle}</div>
                          <div className="flex items-center gap-1 mt-1">
                            <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColor)} />
                            <span className="font-mono text-[9px] text-g400">{item.who}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* MDO Panel */}
            <div className="flex flex-col gap-3">
              <div className="font-mono text-[9px] font-bold tracking-[2.5px] uppercase text-g500 flex items-center gap-2 pt-1">
                <CalendarClock size={11} className="text-red-mrt" />
                What To Do — MDO
              </div>

              {/* Pending follow-ups this week */}
              <MdoSection
                title="Follow-ups Due This Week"
                count={mdoPendingFollowups.length}
                color="purple"
                expanded={!!expandedMdo['fu']}
                onToggle={() => toggleMdo('fu')}
                emptyText="No follow-ups due this week"
              >
                {mdoPendingFollowups.map(fu => (
                  <button type="button" key={fu.id} onClick={() => openDetailPanel('quote' as any, fu.quote_id)} className="w-full text-left px-3 py-2 hover:bg-g50 border-b border-g100 last:border-0 focus:outline-none">
                    <div className="font-mono text-[10px] font-bold text-purple-600">{fu.quote_id}</div>
                    <div className="text-[11.5px] text-blk font-medium">{fu.owner}</div>
                    <div className="text-[11px] text-g400">{fu.next_date} {fu.next_time}</div>
                  </button>
                ))}
              </MdoSection>

              {/* Overdue enquiries */}
              <MdoSection
                title="Overdue Enquiries"
                count={mdoOverdueEnqs.length}
                color="red"
                expanded={!!expandedMdo['enq']}
                onToggle={() => toggleMdo('enq')}
                emptyText="No SLA breaches"
              >
                {mdoOverdueEnqs.map(e => (
                  <button type="button" key={e.id} onClick={() => openDetailPanel('enquiry' as any, e.id)} className="w-full text-left px-3 py-2 hover:bg-g50 border-b border-g100 last:border-0 focus:outline-none">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-[10px] font-bold text-red-mrt">{e.id}</div>
                      <Badge status={e.urg} />
                    </div>
                    <div className="text-[11.5px] text-blk font-medium truncate">{e.cust}</div>
                    <div className="text-[11px] text-red-mrt font-mono">{e.ageH >= 24 ? `${Math.floor(e.ageH/24)}d ${Math.round(e.ageH%24)}h` : `${e.ageH.toFixed(1)}h`} old</div>
                  </button>
                ))}
              </MdoSection>

              {/* Quotes awaiting decision */}
              <MdoSection
                title="Quotes Awaiting Decision"
                count={mdoQuotesAwaitingDecision.length}
                color="orange"
                expanded={!!expandedMdo['qt']}
                onToggle={() => toggleMdo('qt')}
                emptyText="All quotes recently followed up"
              >
                {mdoQuotesAwaitingDecision.map(q => {
                  const val = q.items.reduce((s, i) => s + i.total + (i.total * i.gst / 100), 0);
                  return (
                    <button type="button" key={q.id} onClick={() => openDetailPanel('quote' as any, q.id)} className="w-full text-left px-3 py-2 hover:bg-g50 border-b border-g100 last:border-0 focus:outline-none">
                      <div className="font-mono text-[10px] font-bold text-orange-600">{q.id}</div>
                      <div className="text-[11.5px] text-blk font-medium truncate">{q.cust}</div>
                      <div className="font-mono text-[11px] text-g500">{formatINR(val)}</div>
                    </button>
                  );
                })}
              </MdoSection>

              {/* Open orders overdue */}
              <MdoSection
                title="Orders Overdue / Due Today"
                count={mdoOpenOrders.length}
                color="teal"
                expanded={!!expandedMdo['ord']}
                onToggle={() => toggleMdo('ord')}
                emptyText="No overdue orders"
              >
                {mdoOpenOrders.map(o => (
                  <button type="button" key={o.id} onClick={() => openDetailPanel('order' as any, o.id)} className="w-full text-left px-3 py-2 hover:bg-g50 border-b border-g100 last:border-0 focus:outline-none">
                    <div className="font-mono text-[10px] font-bold text-teal-600">{o.id}</div>
                    <div className="text-[11.5px] text-blk font-medium truncate">{o.cust}</div>
                    <div className="text-[11px] text-g400">Due: {o.dlvDate}</div>
                  </button>
                ))}
              </MdoSection>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'overview' && (
      <div className="px-[30px] pb-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-5 gap-3 mb-3">
          <StatCard
            label="Avg E2Q Time"
            value={avgE2Q !== null ? `${avgE2Q}h` : '--'}
            trend={getTrendStr(e2qTrendRaw)} trendColor={getTrendColor(e2qTrendRaw, true)}
            sub={e2qSamples.length > 0 ? `${e2qSamples.length} quoted enq${e2qSamples.length === 1 ? '' : 's'}` : 'No data yet'}
            color="blue"
            icon={<Clock size={16} strokeWidth={2} />}
          />
          <StatCard
            label="Open Pipeline"
            value={formatINR(openPipeVal)}
            sub={openQuoteString}
            color="purple"
            icon={<IndianRupee size={16} strokeWidth={2} />}
          />
          <StatCard
            label="Win Rate"
            value={`${winRateInPeriod}%`}
            trend={getTrendStr(winRateTrendRaw)} trendColor={getTrendColor(winRateTrendRaw)}
            sub={closedInPeriod.length > 0 ? `${wonInPeriod.length}/${closedInPeriod.length} closed` : 'No closed deals'}
            color="green"
            icon={<Trophy size={16} strokeWidth={2} />}
          />
          <StatCard
            label="Quotes Sent"
            value={quotesInPeriod.length.toString()}
            trend={getTrendStr(quotesSentTrendRaw)} trendColor={getTrendColor(quotesSentTrendRaw)}
            sub="Total quotations issued"
            color="orange"
            icon={<FileSignature size={16} strokeWidth={2} />}
          />
          <StatCard
            label="Quote Value"
            value={formatINR(quoteValInPeriod)}
            trend={getTrendStr(quoteValTrendRaw)} trendColor={getTrendColor(quoteValTrendRaw)}
            sub="Total value quoted"
            color="red"
            icon={<IndianRupee size={16} strokeWidth={2} />}
          />
        </div>

        {/* Pipeline Funnel */}
        <PipelineFunnel data={data} navigate={navigate} />

        {data.enquiries.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white border border-g200 border-dashed rounded-[4px] mt-6">
            <div className="w-16 h-16 bg-red-mrt/5 rounded-full flex items-center justify-center mb-4">
              <Plus size={24} className="text-red-mrt stroke-[2px]" />
            </div>
            <h2 className="text-[18px] font-serif font-bold text-blk mb-2">Welcome to EnquiryBoss</h2>
            <p className="text-[13px] text-g500 text-center max-w-[400px] mb-6">
              Your dashboard is looking a little empty. Start by logging your first enquiry to capture line items and speed up your quoting process.
            </p>
            <Button variant="primary" onClick={() => navigate('/enquiries/new')}>
              Log your first Enquiry
            </Button>
          </div>
        ) : (
          <>
            {/* Top panels */}
            <div className="grid grid-cols-[1.5fr_2fr] gap-3 mb-3">
              {/* Needs Attention */}
              <div className="bg-white border border-g200 rounded-[6px] overflow-hidden shadow-sm hover:shadow transition-shadow">
                <div className="p-[10px_16px] border-b border-g200 flex items-center justify-between">
                  <span className="font-mono text-[9px] font-bold tracking-[2.5px] uppercase text-g500 flex items-center gap-2">
                    {attnEnqs.length > 0 ? (
                      <><span className="text-red-mrt text-[11px]">⚠</span> Needs Attention</>
                    ) : (
                      <><span className="text-[#059669] text-[11px]">✓</span> Inbox Zero</>
                    )}
                  </span>
                </div>
                <div className="p-0">
                  {openEnqs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                      <div className="text-[20px] mb-2 opacity-30">🚀</div>
                      <div className="text-[14px] font-bold text-blk mb-1">Queue is empty</div>
                      <div className="text-[12.5px] text-g500">No open enquiries right now.</div>
                    </div>
                  ) : attnEnqs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                      <div className="text-[14px] font-bold text-blk mb-1">Looking good</div>
                      <div className="text-[12.5px] text-g500">All open enquiries are within SLA.</div>
                    </div>
                  ) : (
                    attnEnqs.slice(0, 3).map(e => (
                      <div key={e.id} className="flex flex-col gap-1 p-[10px_16px] border-b border-g100 last:border-0 cursor-pointer hover:bg-g50 transition-colors" onClick={() => navigate(`/enquiries/new?id=${e.id}`)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-[28px] h-[28px] rounded-[3px] bg-red-lt text-red-mrt flex items-center justify-center font-mono text-[12px] uppercase font-bold shrink-0 border border-red-mrt/10">
                              Δ
                            </div>
                            <div>
                              <div className="font-mono text-[10px] font-bold text-red-mrt tracking-wider mb-0.5">{e.id}</div>
                              <div className="text-[13px] font-bold text-blk">{e.cust}</div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Badge status={e.urg} />
                            <div className="font-mono text-[11px] font-bold text-red-mrt">
                              {e.ageH >= 24 ? Math.floor(e.ageH/24)+'d' : e.ageH.toFixed(1)+'h'} old
                            </div>
                          </div>
                        </div>
                        <div className="text-[12px] text-g500 ml-[38px] truncate max-w-[280px]">
                          {e.items.length} item{e.items.length !== 1 && 's'}: {e.items.map(i => i.desc).join(', ')}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Recent Enquiries */}
              <div className="bg-white border border-g200 rounded-[6px] overflow-hidden shadow-sm hover:shadow transition-shadow">
                <div className="p-[10px_16px] border-b border-g200 flex items-center justify-between">
                  <span className="font-mono text-[9px] font-bold tracking-[2.5px] uppercase text-g500">Recent Enquiries</span>
                  <button onClick={() => navigate('/enquiries')} className="font-mono text-[9px] font-bold tracking-[1.5px] uppercase text-red-mrt hover:opacity-70 flex items-center gap-1 focus:outline-none">
                    All Enquiries <span>→</span>
                  </button>
                </div>
                <div className="p-0">
                  {data.enquiries.slice(0, 5).map(e => (
                    <div key={e.id} className="flex items-center p-[9px_16px] border-b border-g100 last:border-0 cursor-pointer hover:bg-g50 transition-colors overflow-hidden" onClick={() => openDetailPanel('enquiry', e.id)}>
                      <div className="w-[120px] font-mono text-[11px] font-bold text-red-mrt shrink-0 tracking-wider truncate pr-2">{e.id}</div>
                      <div className="font-bold text-[13px] flex-1 truncate pr-3">{e.cust}</div>
                      <div className="flex items-center justify-end shrink-0 w-[190px] gap-2.5">
                        <span className="font-mono text-[10px] text-g400 bg-g50 border border-g200 px-1.5 py-0.5 rounded-full">{e.items.length} items</span>
                        <div className="w-[68px] flex justify-center">
                          <Badge status={e.status} />
                        </div>
                        <div className="w-[42px] flex justify-end">
                          <AgeCell hours={e.ageH} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom 3 panels */}
            <div className="grid grid-cols-3 gap-3 mb-3">

              {/* Recent Quotations */}
              <div className="bg-white border border-g200 rounded-[6px] overflow-hidden shadow-sm hover:shadow transition-shadow">
                <div className="p-[10px_16px] border-b border-g200 flex items-center justify-between">
                  <span className="font-mono text-[9px] font-bold tracking-[2.5px] uppercase text-g500">Recent Quotations</span>
                  <button type="button" onClick={() => navigate('/quotes')} className="font-mono text-[9px] font-bold tracking-[1.5px] uppercase text-red-mrt hover:opacity-70 flex items-center gap-1 focus:outline-none">
                    View all →
                  </button>
                </div>
                {recentQuotes.length === 0 ? (
                  <div className="text-[12px] text-g400 text-center p-8 italic">No quotations yet.</div>
                ) : (
                  <>
                    <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-x-3 px-[16px] py-[7px] border-b border-g100">
                      <div className="font-mono text-[9px] font-bold tracking-[1.5px] uppercase text-g400">Quote No.</div>
                      <div className="font-mono text-[9px] font-bold tracking-[1.5px] uppercase text-g400">Customer</div>
                      <div className="font-mono text-[9px] font-bold tracking-[1.5px] uppercase text-g400 text-right">Value</div>
                      <div className="font-mono text-[9px] font-bold tracking-[1.5px] uppercase text-g400 text-right">Date</div>
                    </div>
                    {recentQuotes.map(q => {
                      const val = q.items.reduce((s, i) => s + i.total + (i.total * i.gst / 100), 0);
                      return (
                        <div key={q.id} className="grid grid-cols-[1fr_1fr_auto_auto] gap-x-3 items-center px-[16px] py-[8px] border-b border-g100 last:border-0 hover:bg-g50 cursor-pointer transition-colors" onClick={() => openDetailPanel('quote', q.id)}>
                          <div className="font-mono text-[10.5px] font-bold text-red-mrt truncate">{q.id}</div>
                          <div className="text-[12px] font-medium text-blk truncate">{q.cust}</div>
                          <div className="font-mono text-[11px] font-bold text-blk text-right whitespace-nowrap">{formatINR(val)}</div>
                          <div className="font-mono text-[10px] text-g400 text-right whitespace-nowrap">{new Date(q.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Enquiry Sources — donut pie chart */}
              <div className="bg-white border border-g200 p-[16px] rounded-[6px] shadow-sm hover:shadow transition-shadow">
                <div className="font-mono text-[9px] font-bold tracking-[2.5px] uppercase text-g500 mb-3">Enquiry Sources</div>
                {totalSources === 0 ? (
                  <div className="text-[12px] text-g400 text-center mt-6 italic">No enquiries yet.</div>
                ) : (
                  <SourcePieChart data={sourceCounts} total={totalSources} />
                )}
              </div>

              {/* Open Quote Pipeline By Customer */}
              <div className="bg-white border border-g200 p-[16px] rounded-[6px] shadow-sm hover:shadow transition-shadow">
                <div className="font-mono text-[9px] font-bold tracking-[2.5px] uppercase text-g500 mb-3">Open Quote Value By Customer</div>
                <div className="space-y-2.5">
                  {openCustData.length > 0 ? openCustData.map((c, i) => {
                    const pct = Math.round((c.val / maxOpenCustVal) * 100);
                    const barColors = ['#D42027','#7C3AED','#2563EB','#059669','#d97706'];
                    const col = barColors[i % barColors.length];
                    return (
                      <div key={c.cust}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-[11.5px] font-semibold text-blk truncate max-w-[130px]">{c.cust}</div>
                          <div className="font-mono text-[11px] font-bold text-blk whitespace-nowrap">{formatINR(c.val)}</div>
                        </div>
                        <div className="h-[8px] bg-g100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: col }} />
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="text-[12px] text-g400 text-center mt-8 italic">No quotes awaiting PO.</div>
                  )}
                </div>
              </div>

            </div>
          </>
        )}
      </div>
      )}
    </div>
  );
}

function SourcePieChart({ data, total }: { data: { src: string; count: number; color: string }[]; total: number }) {
  const SIZE = 120;
  const R = 42;
  const STROKE = 14;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const circumference = 2 * Math.PI * R;
  const GAP = 2; // gap between segments in px along circumference

  // Build stroke-dasharray segments
  let cumOffset = 0;
  const segments = data.map(d => {
    const arcLen = (d.count / total) * circumference;
    const dashLen = Math.max(arcLen - GAP, 0);
    const seg = { ...d, dashLen, dashOffset: -cumOffset };
    cumOffset += arcLen;
    return seg;
  });

  const topSrc = data[0]?.src ?? '';

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: 'rotate(-90deg)' }}>
          {/* track */}
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="#f3f4f6" strokeWidth={STROKE} />
          {segments.map((s, i) => (
            <circle key={i} cx={cx} cy={cy} r={R} fill="none"
              stroke={s.color} strokeWidth={STROKE}
              strokeDasharray={`${s.dashLen} ${circumference - s.dashLen}`}
              strokeDashoffset={s.dashOffset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', lineHeight: 1 }}>{total}</div>
          <div style={{ fontSize: 8, color: '#9ca3af', letterSpacing: 1, marginTop: 2, textTransform: 'uppercase' }}>{topSrc}</div>
        </div>
      </div>
      <div className="flex flex-col gap-2 min-w-0 flex-1">
        {data.map(d => (
          <div key={d.src} className="flex items-center gap-2">
            <div className="w-[3px] h-[28px] rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <div className="flex-1 min-w-0">
              <div className="text-[11.5px] font-semibold text-blk truncate">{d.src}</div>
              <div className="w-full h-[3px] bg-g100 rounded-full mt-0.5 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.round((d.count / total) * 100)}%`, backgroundColor: d.color }} />
              </div>
            </div>
            <div className="font-mono text-[11px] font-bold text-blk shrink-0">{d.count}</div>
            <div className="font-mono text-[9.5px] text-g400 w-[26px] text-right shrink-0">{Math.round((d.count / total) * 100)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const STAT_COLORS = {
  blue:   { top: 'border-t-blue-500',   iconBg: 'bg-blue-50',   iconText: 'text-blue-500'   },
  purple: { top: 'border-t-purple-500', iconBg: 'bg-purple-50', iconText: 'text-purple-500' },
  green:  { top: 'border-t-emerald-500',iconBg: 'bg-emerald-50',iconText: 'text-emerald-500'},
  orange: { top: 'border-t-orange-500', iconBg: 'bg-orange-50', iconText: 'text-orange-500' },
  red:    { top: 'border-t-red-500',    iconBg: 'bg-red-50',    iconText: 'text-red-500'    },
};

function StatCard({ label, value, sub, trend, trendColor, color, icon }: {
  label: string; value: string; sub?: string;
  trend?: string; trendColor?: 'up' | 'dn' | 'neutral';
  color: keyof typeof STAT_COLORS; icon: React.ReactNode;
}) {
  const c = STAT_COLORS[color];
  return (
    <div className={cn('bg-white rounded-[10px] border border-g200 border-t-[3px] p-5 flex flex-col gap-2 shadow-sm hover:shadow transition-shadow', c.top)}>
      <div className="flex items-start justify-between gap-2">
        <div className={cn('font-mono text-[10px] font-bold tracking-[1.5px] uppercase text-g500')}>{label}</div>
        <div className={cn('w-8 h-8 rounded-[6px] flex items-center justify-center shrink-0', c.iconBg)}>
          <div className={cn('w-4 h-4', c.iconText)}>{icon}</div>
        </div>
      </div>
      <div className="font-sans text-[28px] leading-none font-bold text-blk tracking-tight">{value}</div>
      {trend && (
        <div className={cn('flex items-center gap-1 text-[11px] font-semibold',
          trendColor === 'up' ? 'text-emerald-600' : trendColor === 'dn' ? 'text-red-500' : 'text-g400')}>
          {trendColor === 'up' && '↑'}
          {trendColor === 'dn' && '↓'}
          {trend} <span className="font-normal text-g400">vs last month</span>
        </div>
      )}
      {!trend && sub && (
        <div className="text-[11px] text-g400 font-medium truncate">{sub}</div>
      )}
    </div>
  );
}

function PipelineFunnel({ data, navigate }: { data: any; navigate: (path: string) => void }) {
  const fmt = (v: number) => v === 0 ? '₹0' : `₹${(v / 100000).toFixed(1)}L`;

  const quoteVal = (quotes: any[]) =>
    quotes.reduce((s: number, q: any) => s + q.items.reduce((a: number, i: any) => a + i.total + (i.total * i.gst / 100), 0), 0);

  const openEnqs   = data.enquiries.filter((e: any) => e.status === 'New' || e.status === 'In Review');
  const quotedEnqs = data.enquiries.filter((e: any) => e.status === 'Quoted');
  const sentQts    = data.quotes.filter((q: any) => q.status === 'Sent');
  const wonQts     = data.quotes.filter((q: any) => q.status === 'Won');
  const lostEnqs   = data.enquiries.filter((e: any) => e.status === 'Lost');
  const lostQts    = data.quotes.filter((q: any) => q.status === 'Lost');
  const activeOrds = data.orders.filter((o: any) => o.status === 'Processing');

  const stages = [
    { label: 'Open Enquiries', count: openEnqs.length,   val: 0,                  color: 'text-blue-600',    bar: 'bg-blue-500',    barHex: '#3b82f6', bgHex: '#eff6ff', path: '/enquiries' },
    { label: 'Quoted',         count: quotedEnqs.length, val: quoteVal(data.quotes.filter((q: any) => quotedEnqs.some((e: any) => e.id === q.enqRef))), color: 'text-purple-600', bar: 'bg-purple-500', barHex: '#a855f7', bgHex: '#faf5ff', path: '/quotes' },
    { label: 'Negotiating',    count: sentQts.length,    val: quoteVal(sentQts),  color: 'text-orange-600',  bar: 'bg-orange-500',  barHex: '#f97316', bgHex: '#fff7ed', path: '/quotes' },
    { label: 'Won',            count: wonQts.length,     val: quoteVal(wonQts),   color: 'text-emerald-600', bar: 'bg-emerald-500', barHex: '#10b981', bgHex: '#ecfdf5', path: '/quotes' },
    { label: 'Lost',           count: lostEnqs.length + lostQts.length, val: quoteVal(lostQts), color: 'text-red-600', bar: 'bg-red-500', barHex: '#ef4444', bgHex: '#fef2f2', path: '/enquiries' },
    { label: 'Active Orders',  count: activeOrds.length, val: 0,                  color: 'text-teal-600',    bar: 'bg-teal-500',    barHex: '#14b8a6', bgHex: '#f0fdfa', path: '/orders' },
  ];

  const maxCount = Math.max(...stages.map(s => s.count), 1);

  return (
    <div className="bg-white border border-g200 rounded-[6px] overflow-hidden shadow-sm mb-3">
      <div className="p-[10px_16px] border-b border-g200 flex items-center justify-between">
        <span className="font-mono text-[9px] font-bold tracking-[2.5px] uppercase text-g500">Sales Journey Pipeline</span>
        <span className="font-mono text-[9px] text-g400 tracking-[1px]">Click stage to filter</span>
      </div>
      <div className="flex items-stretch divide-x divide-g100">
        {stages.map((s, idx) => (
          <button
            key={s.label}
            type="button"
            onClick={() => navigate(s.path)}
            className="flex-1 flex flex-col items-center gap-1.5 py-3.5 px-3 cursor-pointer transition-colors group focus:outline-none relative hover:bg-[var(--stage-bg)]"
            style={{ '--stage-bg': s.bgHex } as React.CSSProperties}
          >
            <div className="w-full flex justify-center mb-1">
              <div
                className={`${s.bar} rounded-sm transition-all duration-300 opacity-80 group-hover:opacity-100`}
                style={{ height: '4px', width: `${Math.max(20, (s.count / maxCount) * 100)}%` }}
              />
            </div>
            <span className={`font-mono text-[9px] font-bold tracking-[1.5px] uppercase ${s.color}`}>{s.label}</span>
            <span className="font-serif text-[20px] text-blk leading-none font-bold">{s.count}</span>
            <span className={`font-mono text-[10px] font-bold ${s.color}`}>{fmt(s.val)}</span>
            {idx < stages.length - 1 && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 text-g300 text-[10px] font-bold select-none pointer-events-none">›</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

const MDO_COLORS = {
  purple: { badge: 'bg-purple-100 text-purple-700', header: 'text-purple-700', dot: 'bg-purple-500' },
  red:    { badge: 'bg-red-100 text-red-600',       header: 'text-red-600',    dot: 'bg-red-500'    },
  orange: { badge: 'bg-orange-100 text-orange-700', header: 'text-orange-700', dot: 'bg-orange-500' },
  teal:   { badge: 'bg-teal-100 text-teal-700',     header: 'text-teal-700',   dot: 'bg-teal-500'   },
};

function MdoSection({
  title, count, color, expanded, onToggle, emptyText, children,
}: {
  title: string;
  count: number;
  color: keyof typeof MDO_COLORS;
  expanded: boolean;
  onToggle: () => void;
  emptyText: string;
  children: React.ReactNode;
}) {
  const c = MDO_COLORS[color];
  return (
    <div className="bg-white border border-g200 rounded-[8px] overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-[10px_14px] hover:bg-g50 transition-colors focus:outline-none"
      >
        <div className="flex items-center gap-2">
          <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', c.dot)} />
          <span className={cn('font-mono text-[9.5px] font-bold tracking-[1.5px] uppercase', c.header)}>{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full', c.badge)}>{count}</span>
          {expanded ? <ChevronDown size={12} className="text-g400" /> : <ChevronRight size={12} className="text-g400" />}
        </div>
      </button>
      {expanded && (
        count === 0 ? (
          <div className="px-4 py-3 text-[11.5px] text-g400 italic border-t border-g100">{emptyText}</div>
        ) : (
          <div className="border-t border-g100">{children}</div>
        )
      )}
    </div>
  );
}