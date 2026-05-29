// Workspace switcher pill rendered in the CRM Topbar.
// Visible only when production_beta_enabled=true on app_settings.
// Click → /production. From inside /production the same pill links back.

import { Link, useLocation } from 'react-router-dom';
import { Factory, ArrowLeftRight } from 'lucide-react';
import { useProductionBetaEnabled } from '../lib/useBetaFlag';

export function WorkspaceSwitcher() {
  const enabled = useProductionBetaEnabled();
  const location = useLocation();
  if (!enabled) return null;

  const inProduction = location.pathname.startsWith('/production');
  const to = inProduction ? '/' : '/production';
  const label = inProduction ? 'Back to CRM' : 'Production';

  return (
    <Link
      to={to}
      title={inProduction ? 'Switch to CRM workspace' : 'Switch to Production workspace'}
      className={`h-[30px] flex items-center gap-1.5 px-2.5 rounded-[5px] border text-[11px] font-medium transition-colors ${
        inProduction
          ? 'bg-g100 border-g200 text-g600 hover:bg-g200'
          : 'bg-red-lt border-red-mrt/30 text-red-mrt hover:bg-red-mrt/15'
      }`}
    >
      {inProduction ? <ArrowLeftRight size={11} /> : <Factory size={11} />}
      <span className="hidden sm:inline">{label}</span>
      {!inProduction && (
        <span className="ml-1 px-1 rounded-[3px] bg-red-mrt text-white text-[9px] tracking-wider font-bold">
          BETA
        </span>
      )}
    </Link>
  );
}
