// Standalone layout for the /production workspace.
// Mirrors the CRM Layout shape but uses its own Sidebar.
// Reuses the CRM Topbar so the workspace pill, search, and sync controls
// stay consistent. That's fine — Topbar is presentational; it doesn't
// touch any production state.

import { Outlet } from 'react-router-dom';
import { ProductionSidebar } from './ProductionSidebar';
import { Topbar } from '../../components/Topbar';

export function ProductionLayout() {
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
