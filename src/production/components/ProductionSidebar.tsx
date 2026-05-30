// Production workspace sidebar. Visually mirrors the CRM Sidebar but
// drives its own routes. Independent file, no shared layout component.

import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Workflow, Factory, FileText, AlertTriangle, Settings as Cog,
  ArrowLeftRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const ITEMS = [
  { to: '/production',            icon: LayoutDashboard, label: 'Dashboard',  exact: true },
  { to: '/production/sequencer',  icon: Workflow,        label: 'Sequencer' },
  { to: '/production/presses',    icon: Factory,         label: 'Press Board' },
  { to: '/production/jobs',       icon: FileText,        label: 'Job Cards' },
  { to: '/production/ncr',        icon: AlertTriangle,   label: 'NCR Log' },
  { to: '/production/settings',   icon: Cog,             label: 'Shop Floor' },
];

export function ProductionSidebar() {
  const location = useLocation();
  const isActive = (to: string, exact?: boolean) =>
    exact ? location.pathname === to : location.pathname.startsWith(to);

  return (
    <aside className="w-[220px] min-w-[220px] bg-dark flex flex-col border-r border-white/5">
      <div className="bg-white border-b border-g200 px-4 py-3.5 flex items-center gap-3">
        <img
          src="/mangla-logo.png"
          alt="Mangla"
          className="h-8"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div className="w-px h-7 bg-g200" />
        <div className="font-mono text-[8px] font-bold tracking-[2.5px] uppercase text-g500 leading-tight">
          Production<br />
          <span className="text-red-mrt">Workspace</span>
        </div>
      </div>

      <div className="flex-1 py-3 px-2 overflow-y-auto">
        <div className="mb-4">
          <div className="font-mono text-[8px] font-bold tracking-[2.5px] uppercase text-white/20 px-2.5 mb-1">
            Shop Floor
          </div>
          {ITEMS.map(({ to, icon: Icon, label, exact }) => {
            const active = isActive(to, exact);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-[5px] text-[12.5px] font-medium transition-colors',
                  active
                    ? 'bg-white/10 text-white border-l-2 border-red-mrt'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                )}
              >
                <Icon size={15} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="border-t border-white/5 p-2">
        <Link
          to="/"
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-[5px] text-[11.5px] font-medium text-white/50 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ArrowLeftRight size={13} />
          <span>Back to CRM</span>
        </Link>
      </div>
    </aside>
  );
}
