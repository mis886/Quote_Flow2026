import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, FileSignature, ShoppingCart, Users, LineChart, Settings, Boxes, LogOut, Phone, Brain, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAppStore } from '../store';

// Exported so Layout can render the toggle tab outside the clipped aside.
export function useSidebarCollapse() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(location.pathname === '/followups');
  useEffect(() => {
    if (location.pathname === '/followups') setCollapsed(true);
  }, [location.pathname]);
  return { collapsed, setCollapsed };
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation();
  const { data, user, logout } = useAppStore();

  const newEnqCount = data.enquiries.filter(e => e.status === 'New' || e.status === 'In Review').length;
  const sentQuotesCount = data.quotes.filter(q => q.status === 'Sent').length;
  const activeOrdersCount = data.orders.filter(o => o.status === 'Processing').length;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueFollowUpsCount = data.followups.filter(f => {
    const quote = data.quotes.find(q => q.id === f.quote_id);
    if (!quote || quote.status !== 'Sent') return false;
    return f.next_date && new Date(f.next_date) < today;
  }).length;

  const isActive = (path: string) => location.pathname === path;

  // Derive initials and name from user metadata
  const userInitials = user?.user_metadata?.full_name 
    ? user.user_metadata.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || '??';
  
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  return (
    <aside className={cn(
      "bg-dark flex flex-col border-r border-white/5 transition-all duration-300 shrink-0 overflow-hidden h-full",
      collapsed ? "w-0 min-w-0" : "w-[220px] min-w-[220px]"
    )}>
      <div className="bg-white border-b border-g200 px-4 py-3.5 flex items-center gap-3">
        <img
          src="/mangla-logo.png"
          alt="Mangla"
          className="h-8"
          onError={(e) => {
            const t = e.currentTarget;
            t.style.display = 'none';
            const span = document.createElement('span');
            span.textContent = 'MANGLA';
            span.style.cssText = 'font-family:Georgia,serif;font-weight:bold;font-size:15px;color:#D42027;letter-spacing:1px;';
            t.parentNode?.insertBefore(span, t);
          }}
        />
        <div className="w-px h-7 bg-g200"></div>
        <div className="font-mono text-[8px] font-bold tracking-[2.5px] uppercase text-g500 leading-tight">
          EQ System<br />v2.0
        </div>
      </div>

      <div className="flex-1 py-3 px-2 overflow-y-auto">
        <div className="mb-4">
          <div className="font-mono text-[8px] font-bold tracking-[2.5px] uppercase text-white/20 px-2.5 mb-1">
            Main
          </div>
          
          <NavItem to="/" icon={<LayoutDashboard size={15} />} label="Dashboard" active={isActive('/')} dataTour="nav-dashboard" />
          <NavItem
            to="/enquiries"
            icon={<FileText size={15} />}
            label="Enquiries"
            active={isActive('/enquiries')}
            badge={newEnqCount > 0 ? { text: newEnqCount.toString(), className: 'bg-red-mrt' } : undefined}
            dataTour="nav-enquiries"
          />
          <NavItem
            to="/quotes"
            icon={<FileSignature size={15} />}
            label="Quotations"
            active={isActive('/quotes')}
            badge={sentQuotesCount > 0 ? { text: sentQuotesCount.toString(), className: 'bg-sR' } : undefined}
            dataTour="nav-quotations"
          />
          <NavItem
            to="/orders"
            icon={<ShoppingCart size={15} />}
            label="Orders"
            active={isActive('/orders')}
            badge={activeOrdersCount > 0 ? { text: activeOrdersCount.toString(), className: 'bg-sW' } : undefined}
            dataTour="nav-orders"
          />
          <NavItem
            to="/followups"
            icon={<Phone size={15} />}
            label="Follow-Ups"
            active={isActive('/followups')}
            badge={overdueFollowUpsCount > 0 ? { text: overdueFollowUpsCount.toString(), className: 'bg-red-mrt' } : undefined}
            dataTour="nav-followups"
          />
          <NavItem to="/customers" icon={<Users size={15} />} label="Customers" active={isActive('/customers')} dataTour="nav-customers" />
        </div>

        <div className="mb-4">
          <div className="font-mono text-[8px] font-bold tracking-[2.5px] uppercase text-white/20 px-2.5 mb-1">
            Insights
          </div>
          <NavItem to="/analytics" icon={<LineChart size={15} />} label="Analytics" active={isActive('/analytics')} dataTour="nav-analytics" />
          <NavItem to="/intelligence" icon={<Brain size={15} />} label="Customer Intel" active={isActive('/intelligence')} />
          <NavItem to="/blueprint" icon={<Boxes size={15} />} label="System Plan" active={isActive('/blueprint')} />
          <NavItem to="/settings" icon={<Settings size={15} />} label="Settings" active={isActive('/settings')} />
        </div>
      </div>

      <div className="p-3 border-t border-white/5 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-red-mrt flex items-center justify-center font-mono text-[10px] font-bold text-white shrink-0">
            {userInitials}
          </div>
          <div className="min-w-0">
            <div className="text-xs text-white/80 font-medium truncate">{userName}</div>
            <div className="text-[10px] text-white/20 truncate">{user?.email}</div>
          </div>
        </div>
        <button 
          onClick={() => {
            if (confirm('Logout from Mangla EQ?')) logout();
          }}
          className="flex items-center gap-2 px-2.5 py-2 rounded-[5px] text-[12px] text-white/40 hover:bg-white/5 hover:text-white/80 transition-colors"
        >
          <LogOut size={14} strokeWidth={2} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

function NavItem({
  to,
  icon,
  label,
  active,
  badge,
  dataTour,
}: {
  to: string,
  icon: React.ReactNode,
  label: string,
  active: boolean,
  badge?: { text: string, className?: string },
  dataTour?: string,
}) {
  return (
    <Link
      to={to}
      data-tour={dataTour}
      className={cn(
        "flex items-center gap-2.5 px-2.5 py-2 rounded-[5px] text-[13px] transition-colors relative mb-px group",
        active ? "bg-red-mrt/15 text-white" : "text-white/40 hover:bg-white/5 hover:text-white/80"
      )}
    >
      {active && <div className="absolute left-0 top-2 bottom-2 w-[3px] bg-red-mrt rounded-r-sm" />}
      <div className="shrink-0 [&>svg]:stroke-[1.7px]">{icon}</div>
      <span>{label}</span>
      {badge && (
        <span className={cn(
          "ml-auto text-white font-mono text-[9px] font-bold px-1.5 py-px rounded-full min-w-[18px] text-center",
          badge.className
        )}>
          {badge.text}
        </span>
      )}
    </Link>
  );
}
