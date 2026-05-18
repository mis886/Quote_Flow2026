import React, { useState } from 'react';
import { Search, Bell, RefreshCw } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '../store';
import { hasActiveToken } from '../lib/gmail';
import { GlobalDateRangePicker } from './GlobalDateRangePicker';

const PATH_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/enquiries': 'Enquiries',
  '/quotes': 'Quotations',
  '/orders': 'Orders',
  '/customers': 'Customers',
  '/analytics': 'Analytics',
  '/blueprint': 'System Plan',
  '/settings': 'Settings',
};

export function Topbar() {
  const location = useLocation();
  const { globalSearchQuery, setGlobalSearchQuery, syncGmailEnquiries, data } = useAppStore();
  const [isSyncing, setIsSyncing] = useState(false);

  const basePath = '/' + location.pathname.split('/')[1];
  const title = PATH_TITLES[basePath] || 'Dashboard';

  const gmailEnabled = data.settings?.gmail_enabled ?? false;

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try { await syncGmailEnquiries(); } catch {}
    setIsSyncing(false);
  };

  const lastSync = data.settings?.gmail_last_sync
    ? new Date(data.settings.gmail_last_sync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <header className="h-[50px] bg-white border-b border-g200 flex items-center px-5 gap-2.5 shrink-0">
      <div className="text-[13px] text-g500">
        Mangla EQ <span className="text-g300 mx-1">/</span> <strong className="text-blk font-semibold">{title}</strong>
      </div>

      <div className="ml-auto flex items-center gap-2 bg-g100 border border-g200 rounded-[5px] px-2.5 h-[30px] w-[200px] transition-all focus-within:bg-white focus-within:border-g400 focus-within:ring-[3px] focus-within:ring-red-lt">
        <Search size={12} className="text-g400 shrink-0" />
        <input
          type="text"
          placeholder="Search everywhere..."
          value={globalSearchQuery}
          onChange={(e) => setGlobalSearchQuery(e.target.value)}
          className="bg-transparent border-none outline-none font-sans text-[12.5px] text-blk w-full placeholder:text-g400"
        />
      </div>

      {/* Gmail sync pill — only shown when gmail is enabled */}
      {gmailEnabled && (
        <button
          onClick={handleSync}
          disabled={isSyncing}
          title={lastSync ? `Last synced ${lastSync}` : 'Sync Gmail enquiries'}
          className={`h-[30px] flex items-center gap-1.5 px-2.5 rounded-[5px] border text-[11px] font-medium transition-colors disabled:opacity-60 ${
            hasActiveToken()
              ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
              : 'bg-g100 border-g200 text-g500 hover:bg-g200'
          }`}
        >
          <RefreshCw size={11} className={isSyncing ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">{isSyncing ? 'Syncing…' : lastSync ? `Synced ${lastSync}` : 'Sync Gmail'}</span>
        </button>
      )}

      <GlobalDateRangePicker />

      <button type="button" title="Notifications" className="w-[30px] h-[30px] rounded-[5px] border border-g200 bg-transparent flex items-center justify-center cursor-pointer transition-colors hover:bg-g100 relative group">
        <Bell size={14} className="text-g500" />
        <span className="absolute -top-[2px] -right-[2px] w-[7px] h-[7px] rounded-full bg-red-mrt border-2 border-white"></span>
      </button>
    </header>
  );
}
