// Production Job Cards register — all jobs in one place, with filtering
// by stage, search, and the canonical CRM table styling.

import { useState, useMemo } from 'react';
import { Search, Plus, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProductionData } from '../lib/useProductionData';
import { Button } from '../../components/ui';
import {
  Table, THead, TH, TR, TD, EmptyRow, PageHeader, FilterBar,
  StatusPill, toneForStage, toneForStatus,
} from '../components/table';

type StageTab = 'All' | 'Queued' | 'Moulding' | 'Finishing' | 'Inspection' | 'PDI' | 'Dispatch' | 'Dispatched';

const STAGE_MAP: Record<StageTab, string | null> = {
  All:        null,
  Queued:     'queued',
  Moulding:   'moulding',
  Finishing:  'finishing',
  Inspection: 'inspection',
  PDI:        'pdi',
  Dispatch:   'dispatch',
  Dispatched: 'dispatched',
};

export function JobsList() {
  const navigate = useNavigate();
  const { jobs, loading } = useProductionData();
  const [tab, setTab] = useState<StageTab>('All');
  const [q, setQ] = useState('');
  const [pri, setPri] = useState('');

  const filtered = useMemo(() => {
    const stage = STAGE_MAP[tab];
    return jobs.filter(j => {
      if (stage && j.stage !== stage) return false;
      if (pri && j.priority !== pri) return false;
      if (q) {
        const t = q.toLowerCase();
        if (!(
          j.id.toLowerCase().includes(t) ||
          (j.product_desc || '').toLowerCase().includes(t) ||
          (j.customer_name || '').toLowerCase().includes(t) ||
          (j.job_card_no || '').toLowerCase().includes(t) ||
          (j.order_id || '').toLowerCase().includes(t)
        )) return false;
      }
      return true;
    });
  }, [jobs, tab, q, pri]);

  const counts = useMemo(() => {
    const c: Record<StageTab, number> = {
      All: jobs.length, Queued: 0, Moulding: 0, Finishing: 0,
      Inspection: 0, PDI: 0, Dispatch: 0, Dispatched: 0,
    };
    for (const j of jobs) {
      if (j.stage === 'queued')     c.Queued++;
      if (j.stage === 'moulding')   c.Moulding++;
      if (j.stage === 'finishing')  c.Finishing++;
      if (j.stage === 'inspection') c.Inspection++;
      if (j.stage === 'pdi')        c.PDI++;
      if (j.stage === 'dispatch')   c.Dispatch++;
      if (j.stage === 'dispatched') c.Dispatched++;
    }
    return c;
  }, [jobs]);

  const TabSelect = ({ current, label }: { current: StageTab; label: string }) => {
    const isActive = tab === current;
    return (
      <div
        onClick={() => setTab(current)}
        className={`px-[11px] py-1 rounded-[3px] text-[11.5px] font-medium cursor-pointer transition-colors whitespace-nowrap select-none ${
          isActive ? 'bg-white text-blk font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'text-g600 hover:text-blk'
        }`}
      >
        {label} ({counts[current]})
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      <PageHeader
        module="Production · Job Cards"
        title="Job Card"
        accent="Register"
        subtitle="Every production job, across every stage."
        actions={
          <Button onClick={() => navigate('/production/jobs/new')} variant="primary" className="gap-2">
            <Plus size={14} className="stroke-2" /> New Job
          </Button>
        }
      />

      <FilterBar>
        <div className="flex gap-[1px] bg-g100 border border-g200 rounded p-[2px]">
          <TabSelect current="All" label="All" />
          <TabSelect current="Queued" label="Queued" />
          <TabSelect current="Moulding" label="Moulding" />
          <TabSelect current="Finishing" label="Finishing" />
          <TabSelect current="Inspection" label="Inspection" />
          <TabSelect current="PDI" label="PDI" />
          <TabSelect current="Dispatch" label="Dispatch" />
          <TabSelect current="Dispatched" label="Dispatched" />
        </div>

        <div className="w-px h-[18px] bg-g200 shrink-0 mx-1" />

        <div className="flex items-center gap-1.5 bg-white border border-g200 rounded px-2 h-7 min-w-[200px] transition-colors focus-within:border-red-mrt focus-within:ring-2 focus-within:ring-red-lt">
          <Search size={11} className="text-g400 shrink-0" />
          <input
            type="text"
            placeholder="Job ID, product, customer, PO…"
            value={q}
            onChange={e => setQ(e.target.value)}
            className="bg-transparent border-none outline-none font-sans text-xs text-blk w-full placeholder:text-g400"
          />
        </div>

        <select
          title="Filter by priority"
          className="font-sans text-xs text-blk bg-white border border-g200 rounded py-1 pl-2 pr-6 cursor-pointer outline-none"
          value={pri}
          onChange={e => setPri(e.target.value)}
        >
          <option value="">All Priorities</option>
          <option value="emergency">🔴 Emergency</option>
          <option value="normal">Normal</option>
        </select>

        <div className="ml-auto font-mono text-[10px] text-g500">
          {filtered.length} jobs
        </div>
      </FilterBar>

      <div className="px-6 pb-7 pt-[14px] flex-1 overflow-y-auto">
        <Table>
          <THead>
            <tr>
              <TH>Job ID</TH>
              <TH>Job Card #</TH>
              <TH>Product</TH>
              <TH>Customer</TH>
              <TH>Qty</TH>
              <TH>LSD</TH>
              <TH>Promised</TH>
              <TH>Stage</TH>
              <TH>Status</TH>
              <TH>Press</TH>
            </tr>
          </THead>
          <tbody>
            {loading ? (
              <EmptyRow colSpan={10} text="Loading…" />
            ) : filtered.length === 0 ? (
              <EmptyRow colSpan={10} text="No jobs match this filter." />
            ) : filtered.map(j => (
              <TR key={j.id} onClick={() => navigate(`/production/jobs/${j.id}`)}>
                <TD>
                  <span className="font-mono text-[10.5px] font-bold text-red-mrt">
                    {j.priority === 'emergency' && <span className="mr-1">🔴</span>}{j.id}
                  </span>
                </TD>
                <TD className="font-mono text-[11px] text-g600">
                  {j.job_card_no || <span className="text-g400">—</span>}
                </TD>
                <TD>
                  <div className="font-semibold text-blk text-[12.5px]">{j.product_desc}</div>
                  {j.mould_code && <div className="text-[10.5px] text-g500">Mould {j.mould_code}{j.cavities ? ` · ${j.cavities} cav` : ''}</div>}
                </TD>
                <TD className="text-[12.5px]">{j.customer_name || '—'}</TD>
                <TD className="font-mono text-[11.5px]">{j.qty.toLocaleString()}</TD>
                <TD className="font-mono text-[11px] text-g600">{j.lsd || '—'}</TD>
                <TD className="font-mono text-[11px] text-g600">{j.promised_date || '—'}</TD>
                <TD><StatusPill status={j.stage} tone={toneForStage(j.stage)} /></TD>
                <TD><StatusPill status={j.status} tone={toneForStatus(j.status)} /></TD>
                <TD className="font-mono text-[11px] text-g600">
                  {j.press_id ? (
                    <span className="bg-g100 px-1.5 py-0.5 rounded-[2px]">{j.press_id}</span>
                  ) : (
                    <span className="text-g400">—</span>
                  )}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>

        <div className="mt-3 flex items-center gap-2 text-[11px] text-g500">
          <FileText size={11} />
          <span>Click any row to open the job card detail.</span>
        </div>
      </div>
    </div>
  );
}
