import React from 'react';
import { Calendar, X } from 'lucide-react';
import { useAppStore } from '../store';

export function GlobalDateRangePicker() {
  // @ts-ignore - Ensure globalDateRange and setGlobalDateRange are added to your store
  const { globalDateRange, setGlobalDateRange } = useAppStore();

  const startDate = globalDateRange?.startDate || '';
  const endDate = globalDateRange?.endDate || '';

  return (
    <div className="flex items-center gap-2 bg-white border border-g200 rounded-[4px] px-3 py-1.5 shadow-sm">
      <Calendar size={14} className="text-g500" />
      <input
        type="date"
        value={startDate}
        onChange={(e) => setGlobalDateRange?.({ ...globalDateRange, startDate: e.target.value })}
        className="text-[12px] font-mono text-blk outline-none bg-transparent cursor-pointer"
        title="Start Date"
      />
      <span className="text-g400 text-[11px] font-medium">to</span>
      <input
        type="date"
        value={endDate}
        onChange={(e) => setGlobalDateRange?.({ ...globalDateRange, endDate: e.target.value })}
        className="text-[12px] font-mono text-blk outline-none bg-transparent cursor-pointer"
        title="End Date"
      />
      {(startDate || endDate) && (
        <button 
          onClick={() => setGlobalDateRange?.(null)} 
          className="text-g400 hover:text-red-mrt ml-1 transition-colors"
          title="Clear Dates"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}