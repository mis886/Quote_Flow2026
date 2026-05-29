// Standalone layout for the /production workspace.
// Mirrors the CRM Layout shape but uses its own Sidebar.
// Reuses the CRM Topbar so the workspace pill, search, and sync controls
// stay consistent. That's fine — Topbar is presentational; it doesn't
// touch any production state.

import { Outlet } from 'react-router-dom';
import { ProductionSidebar } from './ProductionSidebar';
import { Topbar } from '../../components/Topbar';
import { useProductionBetaEnabled } from '../lib/useBetaFlag';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';

export function ProductionLayout() {
  const enabled = useProductionBetaEnabled();

  if (!enabled) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-cream">
        <div className="max-w-[420px] text-center px-6">
          <div className="w-14 h-14 mx-auto rounded-full bg-red-lt flex items-center justify-center mb-4">
            <Lock size={22} className="text-red-mrt" />
          </div>
          <div className="font-mono text-[10px] font-bold tracking-[3px] uppercase text-blk opacity-60 mb-2">
            Production · Beta
          </div>
          <h1 className="text-[18px] font-semibold text-blk mb-2">
            Beta workspace not enabled
          </h1>
          <p className="text-[13px] text-g600 mb-5 leading-relaxed">
            An administrator can enable the Production Beta workspace by setting
            <code className="mx-1 px-1.5 py-0.5 rounded bg-g100 text-[11px] font-mono">
              app_settings.production_beta_enabled = true
            </code>
            in Supabase.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[5px] bg-blk text-white text-[12px] font-medium hover:bg-g700"
          >
            Back to CRM
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full h-screen overflow-hidden relative">
      <ProductionSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-cream relative">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
