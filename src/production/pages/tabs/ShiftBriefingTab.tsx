// Shift Briefing — worker attendance + live OTD impact summary.
// Ports MRT_ERP_Phase1_2_v2.html renderShiftBriefing() (line 3877+).

import { useState } from 'react';
import { Sunrise, Users, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import type { ProductionData } from '../../lib/useProductionData';
import { getOTDImpactSummary } from '../../lib/otdImpact';
import { toggleWorkerPresence } from '../../lib/actions';

export function ShiftBriefingTab({ data }: { data: ProductionData }) {
  const { workers, jobs, settings, refresh } = data;
  const [busyId, setBusyId] = useState<string | null>(null);

  const present = {
    finishing: workers.filter(w => w.department === 'finishing' && w.present).length,
    inspection: workers.filter(w => w.department === 'inspection' && w.present).length,
  };
  const { safe, atrisk, breach } = getOTDImpactSummary(jobs, {
    finishers: present.finishing,
    inspectors: present.inspection,
  });

  const toggle = async (id: string, next: boolean) => {
    setBusyId(id);
    try { await toggleWorkerPresence(id, next); await refresh(); }
    finally { setBusyId(null); }
  };

  const Roster = ({ dept, label, accent }: { dept: 'finishing' | 'inspection'; label: string; accent: string }) => {
    const list = workers.filter(w => w.department === dept);
    const here = list.filter(w => w.present).length;
    const out  = list.length - here;
    return (
      <div className="bg-white border border-g200 rounded-[3px]">
        <div className={`px-3 py-2 border-b border-g200 flex items-center gap-2 border-t-2 ${accent}`}>
          <Users size={14} className="text-g500" />
          <div className="text-[12px] font-semibold text-blk flex-1">{label}</div>
          <span className="text-[10.5px] text-green-700 font-mono">
            <CheckCircle2 size={11} className="inline -mt-0.5 mr-0.5" />{here} present
          </span>
          <span className="text-[10.5px] text-red-mrt font-mono">
            <XCircle size={11} className="inline -mt-0.5 mr-0.5" />{out} absent
          </span>
        </div>
        <div className="divide-y divide-g100">
          {list.map(w => (
            <div key={w.id} className="px-3 py-2 flex items-center gap-3">
              <div className="flex-1">
                <div className="text-[12.5px] font-medium text-blk">{w.name}</div>
                <div className="text-[10px] text-g500 font-mono">{w.id} · {w.role}</div>
              </div>
              <button
                type="button"
                disabled={busyId === w.id}
                onClick={() => toggle(w.id, !w.present)}
                className={`px-2.5 py-1 text-[11px] rounded-[3px] border transition-colors disabled:opacity-50 ${
                  w.present
                    ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                    : 'bg-g100 border-g200 text-g500 hover:bg-g200'
                }`}
              >
                {w.present ? 'Present ✓' : 'Absent'}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-[3px] p-3 flex items-center gap-3">
        <Sunrise size={20} className="text-orange-600" />
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-orange-900">
            Shift Briefing — start of day
          </div>
          <div className="text-[11px] text-orange-800/80">
            Toggle worker attendance. The OTD risk numbers below update live.
          </div>
        </div>
        {settings && (
          <div className="text-[11px] text-orange-900 font-mono">
            Shift: {settings.shift_hours}h · OT budget {settings.overtime_max}h
          </div>
        )}
      </div>

      {/* OTD impact summary */}
      <div className="grid grid-cols-3 gap-2">
        <RiskCard label="On Track"  count={safe}   color="text-green-700"  bg="bg-green-50"  border="border-green-200" />
        <RiskCard label="At Risk"   count={atrisk} color="text-orange-700" bg="bg-orange-50" border="border-orange-200" icon={<AlertTriangle size={14} />} />
        <RiskCard label="Breach"    count={breach} color="text-red-mrt"    bg="bg-red-lt"    border="border-red-mrt/30" icon={<AlertTriangle size={14} />} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Roster dept="finishing"  label="Finishing Team"  accent="border-t-blue-500" />
        <Roster dept="inspection" label="Inspection Team" accent="border-t-purple-500" />
      </div>
    </div>
  );
}

function RiskCard({ label, count, color, bg, border, icon }: any) {
  return (
    <div className={`border rounded-[3px] px-3 py-2.5 ${bg} ${border}`}>
      <div className={`text-[20px] font-light leading-none ${color} flex items-center gap-1.5`}>
        {icon}
        {count}
      </div>
      <div className={`text-[10px] mt-1 ${color}`}>{label}</div>
    </div>
  );
}
