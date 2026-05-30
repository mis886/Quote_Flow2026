// Shift Briefing — worker attendance + live OTD impact summary.
// Styled to match MRT ERP v2 design system.

import { useState } from 'react';
import { Sunrise, Users, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import type { ProductionData } from '../../lib/useProductionData';
import { getOTDImpactSummary } from '../../lib/otdImpact';
import { toggleWorkerPresence } from '../../lib/actions';

export function ShiftBriefingTab({ data }: { data: ProductionData }) {
  const { workers, jobs, settings, refresh } = data;
  const [busyId, setBusyId] = useState<string | null>(null);

  const present = {
    finishing:  workers.filter(w => w.department === 'finishing'  && w.present).length,
    inspection: workers.filter(w => w.department === 'inspection' && w.present).length,
  };
  const { safe, atrisk, breach } = getOTDImpactSummary(jobs, {
    finishers:  present.finishing,
    inspectors: present.inspection,
  });

  const toggle = async (id: string, next: boolean) => {
    setBusyId(id);
    try { await toggleWorkerPresence(id, next); await refresh(); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-3">
      {/* Header banner */}
      <div className="bg-[#FFF8EC] border border-[#FFE0B2] rounded-[3px] p-3 flex items-center gap-3">
        <Sunrise size={18} className="text-[#E9730C] flex-shrink-0" />
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-[#32363A]">Shift Briefing — start of day</div>
          <div className="text-[11px] text-[#6A6D70]">Toggle worker attendance. OTD risk numbers update live.</div>
        </div>
        {settings && (
          <div className="text-[11px] text-[#32363A] font-mono">
            Shift: {settings.shift_hours}h · OT {settings.overtime_max}h
          </div>
        )}
      </div>

      {/* OTD impact summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <RiskCard label="On Track" count={safe}   borderColor="border-t-[#107E3E]" bg="bg-[#E8F5E9]" textColor="text-[#107E3E]" />
        <RiskCard label="At Risk"  count={atrisk} borderColor="border-t-[#E9730C]" bg="bg-[#FFF3E0]" textColor="text-[#E9730C]" icon={<AlertTriangle size={13} />} />
        <RiskCard label="Breach"   count={breach} borderColor="border-t-[#BB0000]" bg="bg-[#FFEBEE]" textColor="text-[#BB0000]" icon={<AlertTriangle size={13} />} />
      </div>

      {/* Worker rosters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Roster dept="finishing"  label="Finishing Team"  accentColor="border-t-[#0A6ED1]" workers={workers} busyId={busyId} onToggle={toggle} />
        <Roster dept="inspection" label="Inspection Team" accentColor="border-t-[#107E3E]" workers={workers} busyId={busyId} onToggle={toggle} />
      </div>
    </div>
  );
}

function Roster({
  dept, label, accentColor, workers, busyId, onToggle,
}: {
  dept: 'finishing' | 'inspection';
  label: string;
  accentColor: string;
  workers: ReturnType<typeof import('../../lib/useProductionData').useProductionData>['workers'];
  busyId: string | null;
  onToggle: (id: string, next: boolean) => void;
}) {
  const list = workers.filter(w => w.department === dept);
  const here = list.filter(w => w.present).length;
  const out  = list.length - here;
  return (
    <div className={`bg-white border border-[#E4E5E6] border-t-[3px] rounded-[3px] ${accentColor}`}>
      <div className="px-3 py-2 border-b border-[#E4E5E6] flex items-center gap-2">
        <Users size={13} className="text-[#6A6D70]" />
        <div className="text-[12px] font-semibold text-[#32363A] flex-1">{label}</div>
        <span className="text-[10.5px] text-[#107E3E] flex items-center gap-0.5">
          <CheckCircle2 size={10} />{here} present
        </span>
        <span className="text-[10.5px] text-[#BB0000] flex items-center gap-0.5 ml-2">
          <XCircle size={10} />{out} absent
        </span>
      </div>
      <div className="divide-y divide-[#F3F3F3]">
        {list.map(w => (
          <div key={w.id} className="px-3 py-2 flex items-center gap-3">
            <div className="flex-1">
              <div className="text-[12px] font-medium text-[#32363A]">{w.name}</div>
              <div className="text-[10px] text-[#6A6D70]">{w.id} · {w.role}</div>
            </div>
            <button
              type="button"
              disabled={busyId === w.id}
              onClick={() => onToggle(w.id, !w.present)}
              className={[
                'px-[9px] py-[3px] text-[11px] rounded-[3px] border transition-colors disabled:opacity-50',
                w.present
                  ? 'bg-[#E8F5E9] border-[#107E3E]/40 text-[#107E3E] hover:bg-[#C5E1A5]/40'
                  : 'bg-[#F5F6F7] border-[#E4E5E6] text-[#6A6D70] hover:bg-[#EBEBEB]',
              ].join(' ')}
            >
              {w.present ? 'Present ✓' : 'Absent'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskCard({
  label, count, borderColor, bg, textColor, icon,
}: {
  label: string; count: number; borderColor: string;
  bg: string; textColor: string; icon?: React.ReactNode;
}) {
  return (
    <div className={`border border-[#E4E5E6] border-t-[3px] rounded-[3px] px-3 py-2.5 ${borderColor} ${bg}`}>
      <div className={`text-[24px] font-light leading-none flex items-center gap-1.5 ${textColor}`}>
        {icon}{count}
      </div>
      <div className={`text-[10px] mt-1 ${textColor}`}>{label}</div>
    </div>
  );
}
