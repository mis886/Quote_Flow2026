import { useEffect, useRef, useCallback, useState } from 'react';
import confetti from 'canvas-confetti';
import { useAppStore } from '../store';
import { X } from 'lucide-react';

interface Milestone {
  key: string;
  label: string;
  sub: string;
  emoji: string;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
  check: (stats: MilestoneStats) => boolean;
}

interface MilestoneStats {
  totalEnquiries: number;
  sentQuotes: number;
  wonQuotes: number;
  totalQuoteValue: number;
  wonValue: number;
}

const MILESTONES: Milestone[] = [
  { key: 'enq_10',    emoji: '📬', tier: 'bronze',  label: '10 Enquiries Received',    sub: 'Your pipeline is alive — keep it flowing!',           check: s => s.totalEnquiries >= 10 },
  { key: 'enq_50',    emoji: '📬', tier: 'silver',  label: '50 Enquiries Received',    sub: 'Half a century of inbound interest. Great work!',      check: s => s.totalEnquiries >= 50 },
  { key: 'enq_100',   emoji: '🎯', tier: 'gold',    label: '100 Enquiries Received',   sub: 'A triple-digit pipeline. Mangla is buzzing!',          check: s => s.totalEnquiries >= 100 },
  { key: 'enq_500',   emoji: '🏆', tier: 'diamond', label: '500 Enquiries — Legend',   sub: "Five hundred strong. You're a market force!",          check: s => s.totalEnquiries >= 500 },
  { key: 'quote_10',  emoji: '📄', tier: 'bronze',  label: '10 Quotations Sent',       sub: 'Proposals flying — clients are paying attention.',     check: s => s.sentQuotes >= 10 },
  { key: 'quote_50',  emoji: '📄', tier: 'silver',  label: '50 Quotations Sent',       sub: 'Fifty offers on the table. Business is booming!',      check: s => s.sentQuotes >= 50 },
  { key: 'quote_100', emoji: '🚀', tier: 'gold',    label: '100 Quotations Sent',      sub: 'Century of quotes! Your team is unstoppable.',         check: s => s.sentQuotes >= 100 },
  { key: 'quote_250', emoji: '🔥', tier: 'diamond', label: '250 Quotations Sent',      sub: 'Quarter-thousand proposals. Elite execution!',         check: s => s.sentQuotes >= 250 },
  { key: 'won_1',     emoji: '🎉', tier: 'bronze',  label: 'First Order Won!',         sub: 'The first win is always sweetest. Many more to come!', check: s => s.wonQuotes >= 1 },
  { key: 'won_10',    emoji: '🏅', tier: 'silver',  label: '10 Orders Won',            sub: 'Ten confirmed orders. Trust is being built!',          check: s => s.wonQuotes >= 10 },
  { key: 'won_50',    emoji: '🥇', tier: 'gold',    label: '50 Orders Won',            sub: 'Fifty victories. Mangla Rubber is on a roll!',         check: s => s.wonQuotes >= 50 },
  { key: 'qval_10L',  emoji: '💰', tier: 'bronze',  label: '₹10 Lakh in Quotes',      sub: 'Seven digits of proposals. The pipeline has value!',   check: s => s.totalQuoteValue >= 1_000_000 },
  { key: 'qval_50L',  emoji: '💰', tier: 'silver',  label: '₹50 Lakh in Quotes',      sub: 'Fifty lakh worth of opportunity. Keep closing!',       check: s => s.totalQuoteValue >= 5_000_000 },
  { key: 'qval_1cr',  emoji: '💎', tier: 'gold',    label: '₹1 Crore in Quotes',      sub: 'One crore milestone unlocked. Outstanding!',           check: s => s.totalQuoteValue >= 10_000_000 },
  { key: 'qval_5cr',  emoji: '👑', tier: 'diamond', label: '₹5 Crore in Quotes',      sub: "Five crore in proposals. You're a rubber giant!",      check: s => s.totalQuoteValue >= 50_000_000 },
  { key: 'oval_10L',  emoji: '💸', tier: 'bronze',  label: '₹10 Lakh Revenue Won',    sub: 'Lakh in the bank. The grind is paying off!',           check: s => s.wonValue >= 1_000_000 },
  { key: 'oval_50L',  emoji: '💸', tier: 'silver',  label: '₹50 Lakh Revenue Won',    sub: 'Half a crore of closed business. Phenomenal!',         check: s => s.wonValue >= 5_000_000 },
  { key: 'oval_1cr',  emoji: '🤑', tier: 'diamond', label: '₹1 Crore Revenue Won',    sub: 'Crore club! Mangla Rubber is delivering big.',         check: s => s.wonValue >= 10_000_000 },
];

const TIER_STYLES = {
  bronze:  { bg: 'from-[#7c4a1e] to-[#3d1f08]', ring: 'border-amber-700/60',  badge: 'bg-amber-700/30 text-amber-300',   star: '#cd7f32' },
  silver:  { bg: 'from-[#3a3a4a] to-[#1a1a2e]', ring: 'border-slate-400/60',  badge: 'bg-slate-400/20 text-slate-300',   star: '#c0c0c0' },
  gold:    { bg: 'from-[#5a3e00] to-[#1a1200]', ring: 'border-yellow-500/60', badge: 'bg-yellow-500/20 text-yellow-300', star: '#FFD700' },
  diamond: { bg: 'from-[#0d1b3e] to-[#060d1f]', ring: 'border-blue-400/60',   badge: 'bg-blue-400/20 text-blue-200',     star: '#6495C8' },
};

const STORAGE_KEY = 'mrt_milestones_v2'; // v2 — fresh key, no stale data from old runs
const TTL_MS = 24 * 60 * 60 * 1000;

function getShown(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}
function wasShownRecently(key: string): boolean {
  const s = getShown();
  return !!s[key] && Date.now() - s[key] < TTL_MS;
}
function markShown(key: string) {
  const s = getShown();
  s[key] = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function fireConfetti(tier: Milestone['tier']) {
  const colors = ['#D42027', '#FFD700', '#ffffff', '#6495C8'];
  if (tier === 'bronze') {
    confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors });
  } else if (tier === 'silver') {
    confetti({ particleCount: 160, spread: 80, origin: { y: 0.55 }, colors });
  } else if (tier === 'gold') {
    confetti({ particleCount: 100, angle: 60,  spread: 55, origin: { x: 0 }, colors });
    setTimeout(() => confetti({ particleCount: 100, angle: 120, spread: 55, origin: { x: 1 }, colors }), 150);
  } else {
    const end = Date.now() + 2500;
    const frame = () => {
      confetti({ particleCount: 8, angle: 60,  spread: 55, origin: { x: 0 }, colors });
      confetti({ particleCount: 8, angle: 120, spread: 55, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }
}

export function MilestoneConfetti() {
  const { data } = useAppStore();
  const [banner, setBanner] = useState<Milestone | null>(null);
  const [visible, setVisible] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guard: only evaluate once data has actually loaded (non-empty)
  const evaluated = useRef(false);

  const dismiss = useCallback(() => {
    setVisible(false);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setBanner(null), 400);
  }, []);

  useEffect(() => {
    // Wait until we have real data before evaluating
    if (data.enquiries.length === 0 && data.quotes.length === 0) return;
    // Only evaluate once per session (re-trigger only if new data arrives after initial load)
    if (evaluated.current) return;
    evaluated.current = true;

    const stats: MilestoneStats = {
      totalEnquiries: data.enquiries.length,
      sentQuotes: data.quotes.filter(q => ['Sent', 'Won', 'Lost'].includes(q.status)).length,
      wonQuotes: data.quotes.filter(q => q.status === 'Won').length,
      totalQuoteValue: data.quotes.reduce((a, q) => a + q.items.reduce((s, i) => s + i.total + i.total * i.gst / 100, 0), 0),
      wonValue: data.quotes.filter(q => q.status === 'Won').reduce((a, q) => a + q.items.reduce((s, i) => s + i.total + i.total * i.gst / 100, 0), 0),
    };

    // All milestones currently achieved that haven't been shown in the last 24h
    const due = MILESTONES.filter(m => m.check(stats) && !wasShownRecently(m.key));
    if (due.length === 0) return;

    // Show the highest-tier one (last in the list = hardest)
    const top = due[due.length - 1];
    // Mark all achieved ones as shown so they don't repeat within 24h
    due.forEach(m => markShown(m.key));

    const t = setTimeout(() => {
      fireConfetti(top.tier);
      setBanner(top);
      setVisible(true);
    }, 1200);
    return () => clearTimeout(t);
  }, [data.enquiries.length, data.quotes.length]);

  if (!banner) return null;
  const s = TIER_STYLES[banner.tier];

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-all duration-500 ${visible ? 'bg-black/60 backdrop-blur-sm' : 'bg-black/0 pointer-events-none'}`}
      onClick={dismiss}
    >
      {/* Ribbon strips */}
      {visible && (
        <>
          <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-red-mrt via-yellow-400 to-red-mrt animate-pulse pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-2 bg-gradient-to-r from-red-mrt via-yellow-400 to-red-mrt animate-pulse pointer-events-none" />
        </>
      )}

      <div
        onClick={e => e.stopPropagation()}
        className={`relative w-[440px] max-w-[92vw] rounded-2xl bg-gradient-to-b ${s.bg} border-2 ${s.ring} shadow-2xl px-8 py-9 flex flex-col items-center text-center transition-all duration-500 ${visible ? 'scale-100 opacity-100 translate-y-0' : 'scale-75 opacity-0 translate-y-12'}`}
      >
        {/* Shimmer top */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent rounded-t-2xl" />

        {/* Close */}
        <button type="button" onClick={dismiss} title="Dismiss" aria-label="Dismiss"
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-colors">
          <X size={13} />
        </button>

        {/* Tier badge */}
        <span className={`font-mono text-[9px] font-bold tracking-[2.5px] uppercase px-3 py-1 rounded-full ${s.badge} mb-5`}>
          {banner.tier} milestone
        </span>

        {/* Emoji */}
        <div className="text-7xl mb-4 drop-shadow-lg select-none leading-none">{banner.emoji}</div>

        {/* Heading */}
        <div className="text-white font-bold text-[24px] leading-tight mb-2">{banner.label}</div>

        {/* Sub */}
        <div className="text-white/55 text-[13px] leading-relaxed mb-7 max-w-[320px]">{banner.sub}</div>

        {/* Stars */}
        <div className="flex items-center gap-1.5 mb-7">
          {Array.from({ length: banner.tier === 'bronze' ? 1 : banner.tier === 'silver' ? 2 : banner.tier === 'gold' ? 3 : 4 }).map((_, i) => (
            <svg key={i} width="20" height="20" viewBox="0 0 20 20" fill={s.star}>
              <path d="M10 1l2.6 5.3 5.9.8-4.3 4.1 1 5.8L10 14.3l-5.2 2.7 1-5.8L1.5 7.1l5.9-.8z" />
            </svg>
          ))}
        </div>

        {/* CTA */}
        <button type="button" onClick={dismiss}
          className="px-10 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono text-[11px] font-bold tracking-widest uppercase transition-colors border border-white/20">
          Keep Going 🚀
        </button>
      </div>
    </div>
  );
}
