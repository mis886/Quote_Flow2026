import React, { useState } from 'react';
import { useAppStore } from '../store';
import { formatINR, cn } from '../lib/utils';
import { Badge, Button } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import { Plus, Clock, IndianRupee, FileSignature, Trophy } from 'lucide-react';

type Period = '30d' | 'quarter' | 'year';

export function Dashboard() {
  // @ts-ignore - Assuming globalDateRange is added to the store
  const { data, openDetailPanel, user, globalDateRange } = useAppStore();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>('30d');

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

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300 overflow-y-auto">
      <div className="pt-5 px-[30px] shrink-0">
        <div className="flex items-start justify-between gap-3 border-b border-g200 pb-4 mb-4">
          <div>
            <div className="font-mono text-[9px] font-bold tracking-[3px] uppercase text-red-mrt mb-1.5 flex items-center gap-2">
              Overview
            </div>
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
        {(!globalDateRange?.startDate && !globalDateRange?.endDate) && (
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
      </div>

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