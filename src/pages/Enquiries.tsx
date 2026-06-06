import React, { useState } from 'react';
import { useAppStore } from '../store';
import { Badge, Button, SourceIcon, DateFilterBanner } from '../components/ui';
import { Search, Plus, Calendar, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { calculateAgeHours, fmtIST, isInDateRange, siteLabel } from '../lib/utils';
import { EnqStatus, Urgency } from '../lib/types';

export function Enquiries() {
  const store = useAppStore();
  const { data, globalSearchQuery, setGlobalSearchQuery, openDetailPanel, openAttachmentModal } = store;
  const { globalDateRange, setGlobalDateRange } = store as any;
  const navigate = useNavigate();
  const [tab, setTab] = useState<'All' | 'Open' | EnqStatus>('All');
  const [srcFilter, setSrcFilter] = useState('');
  const [urgFilter, setUrgFilter] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const applySearch = (search: string) => {
    setGlobalSearchQuery(search);
  };

  const filteredEnqs = data.enquiries.filter(e => {
    // Tab filter
    if (tab === 'Open' && e.status !== 'New' && e.status !== 'In Review') return false;
    else if (tab !== 'All' && tab !== 'Open' && e.status !== tab) return false;

    // Search filter
    if (globalSearchQuery) {
      const q = globalSearchQuery.toLowerCase();
      const match = e.cust.toLowerCase().includes(q) || 
                    e.id.toLowerCase().includes(q) || 
                    e.items.some(i => i.desc.toLowerCase().includes(q) || i.mat.toLowerCase().includes(q));
      if (!match) return false;
    }

    // Dropdown filters
    if (srcFilter && e.src !== srcFilter) return false;
    if (urgFilter && e.urg !== urgFilter) return false;

    // Global date range filter (recv date)
    if (!isInDateRange(e.recv, globalDateRange)) return false;

    return true;
  });

  const totalItems = filteredEnqs.reduce((acc, e) => acc + e.items.length, 0);

  const statusCounts = {
    New: data.enquiries.filter(e => e.status === 'New').length,
    'In Review': data.enquiries.filter(e => e.status === 'In Review').length,
    Quoted: data.enquiries.filter(e => e.status === 'Quoted').length,
    Won: data.enquiries.filter(e => e.status === 'Won').length,
    Lost: data.enquiries.filter(e => e.status === 'Lost').length,
    Parked: data.enquiries.filter(e => e.status === 'Parked').length,
    All: data.enquiries.length,
    Open: data.enquiries.filter(e => e.status === 'New' || e.status === 'In Review').length,
  };

  const TabSelect = ({ current, label, count }: { current: string, label: string, count?: number }) => {
    const isActive = tab === current || (tab === 'Open' && (current === 'New' || current === 'In Review'));
    return (
      <div 
        onClick={() => setTab(current as any)}
        className={`px-[11px] py-1 rounded-[3px] text-[11.5px] font-medium cursor-pointer transition-colors whitespace-nowrap select-none ${isActive ? 'bg-white text-blk font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'text-g600 hover:text-blk'}`}
      >
        {label} {count !== undefined && `(${count})`}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      <div className="pt-5 px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[9px] font-bold tracking-[3px] uppercase text-red-mrt mb-1">
              Module 01
            </div>
            <h1 className="font-serif text-2xl text-blk tracking-tight leading-tight">
              Enquiry <em className="italic text-red-mrt">Register</em>
            </h1>
            <p className="text-xs text-g500 mt-1 font-light">All enquiries with line items.</p>
          </div>
          <div className="flex items-center gap-2 mt-1 shrink-0">
            <Button onClick={() => navigate('/enquiries/new')} variant="primary" className="gap-2">
              <Plus size={14} className="stroke-2" /> Log New Enquiry
            </Button>
          </div>
        </div>
      </div>

      <DateFilterBanner globalDateRange={globalDateRange} onClear={() => setGlobalDateRange(null)} />

      <div className="flex items-center gap-2 px-6 py-2.5 bg-white border-b border-g200 flex-wrap mt-0">
        <div className="flex gap-[1px] bg-g100 border border-g200 rounded p-[2px]">
          <TabSelect current="All" label="All" count={statusCounts.All} />
          <TabSelect current="New" label="New" count={statusCounts.New} />
          <TabSelect current="In Review" label="In Review" count={statusCounts['In Review']} />
          <TabSelect current="Quoted" label="Quoted" count={statusCounts.Quoted} />
          <TabSelect current="Won" label="Won" count={statusCounts.Won} />
          <TabSelect current="Lost" label="Lost" count={statusCounts.Lost} />
          <TabSelect current="Parked" label="Parked" count={statusCounts.Parked} />
        </div>
        
        <div className="w-px h-[18px] bg-g200 shrink-0 mx-1"></div>

        <div className="flex items-center gap-1.5 bg-white border border-g200 rounded px-2 h-7 min-w-[160px] transition-colors focus-within:border-red-mrt focus-within:ring-2 focus-within:ring-red-lt">
          <Search size={11} className="text-g400 shrink-0" />
          <input
            type="text"
            placeholder="Company, item, material..."
            value={globalSearchQuery}
            onChange={(e) => applySearch(e.target.value)}
            className="bg-transparent border-none outline-none font-sans text-xs text-blk w-full placeholder:text-g400"
          />
        </div>

        <select
          title="Filter by source"
          className="font-sans text-xs text-blk bg-white border border-g200 rounded py-1 pl-2 pr-6 cursor-pointer outline-none appearance-none bg-[url('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\'%3E%3Cpath d=\'M1 1l4 4 4-4\' stroke=\'%23888\' stroke-width=\'1.5\' fill=\'none\' stroke-linecap=\'round\'/%3E%3C/svg%3E')] bg-no-repeat bg-[right_7px_center]"
          value={srcFilter}
          onChange={(e) => setSrcFilter(e.target.value)}
        >
          <option value="">All Sources</option>
          <option>Email</option>
          <option>Phone</option>
          <option>WhatsApp</option>
          <option>Exhibition</option>
          <option>Website</option>
        </select>

        <select
          title="Filter by urgency"
          className="font-sans text-xs text-blk bg-white border border-g200 rounded py-1 pl-2 pr-6 cursor-pointer outline-none appearance-none bg-[url('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\'%3E%3Cpath d=\'M1 1l4 4 4-4\' stroke=\'%23888\' stroke-width=\'1.5\' fill=\'none\' stroke-linecap=\'round\'/%3E%3C/svg%3E')] bg-no-repeat bg-[right_7px_center]"
          value={urgFilter}
          onChange={(e) => setUrgFilter(e.target.value)}
        >
          <option value="">All Urgency</option>
          <option>Hot</option>
          <option>Urgent</option>
          <option>Normal</option>
          <option>Low</option>
        </select>

        <div className="ml-auto font-mono text-[10px] text-g500">
          {filteredEnqs.length} enquiries &middot; {totalItems} items
        </div>
      </div>

      <div className="px-6 pb-7 pt-[14px] flex-1 overflow-y-auto">
        <div className="bg-white border border-g200 overflow-x-auto m-0">
          <table className="w-full border-collapse text-[12.5px]">
            <thead className="bg-g100">
              <tr>
                <th className="font-mono text-[8.5px] font-bold tracking-[1.5px] uppercase text-g500 px-[13px] py-[9px] text-left whitespace-nowrap border-b border-g200">ENQ No.</th>
                <th className="font-mono text-[8.5px] font-bold tracking-[1.5px] uppercase text-g500 px-[13px] py-[9px] text-left whitespace-nowrap border-b border-g200">Received</th>
                <th className="font-mono text-[8.5px] font-bold tracking-[1.5px] uppercase text-g500 px-[13px] py-[9px] text-left whitespace-nowrap border-b border-g200">Customer - Site/Branch</th>
                <th className="font-mono text-[8.5px] font-bold tracking-[1.5px] uppercase text-g500 px-[13px] py-[9px] text-left whitespace-nowrap border-b border-g200">Source</th>
                <th className="font-mono text-[8.5px] font-bold tracking-[1.5px] uppercase text-g500 px-[13px] py-[9px] text-left whitespace-nowrap border-b border-g200">Items</th>
                <th className="font-mono text-[8.5px] font-bold tracking-[1.5px] uppercase text-g500 px-[13px] py-[9px] text-left whitespace-nowrap border-b border-g200">Urgency</th>
                <th className="font-mono text-[8.5px] font-bold tracking-[1.5px] uppercase text-g500 px-[13px] py-[9px] text-left whitespace-nowrap border-b border-g200">Status</th>
                <th className="font-mono text-[8.5px] font-bold tracking-[1.5px] uppercase text-g500 px-[13px] py-[9px] text-left whitespace-nowrap border-b border-g200">Age</th>
                <th className="font-mono text-[8.5px] font-bold tracking-[1.5px] uppercase text-g500 px-[13px] py-[9px] text-left whitespace-nowrap border-b border-g200">Quote Ref</th>
                <th className="font-mono text-[8.5px] font-bold tracking-[1.5px] uppercase text-g500 px-[13px] py-[9px] text-left whitespace-nowrap border-b border-g200">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEnqs.length === 0 ? (
                <tr><td colSpan={10} className="text-center p-8 text-g400 text-[13px]">No enquiries match this filter</td></tr>
              ) : (
                filteredEnqs.map(e => {
                  const d = new Date(e.recv); // Assuming ISO string is stored
                  const isExpanded = expandedRow === e.id;
                  
                  return (
                    <React.Fragment key={e.id}>
                      <tr 
                        className={`transition-colors cursor-pointer border-b border-g100 last:border-b-0 hover:bg-red-mrt/5 ${isExpanded ? 'bg-red-mrt/5' : ''}`}
                        onClick={() => setExpandedRow(isExpanded ? null : e.id)}
                      >
                        <td className="px-[13px] py-[10px] align-middle"><span className="font-mono text-[10.5px] font-bold text-red-mrt">{e.id}</span></td>
                        <td className="px-[13px] py-[10px] align-middle text-[11.5px] text-g600 whitespace-nowrap">{fmtIST(d, 'dd MMM HH:mm')}</td>
                        <td className="px-[13px] py-[10px] align-middle">
                          <div className="font-semibold">{e.cust}{(() => { const sl = siteLabel(data.customers.find(c => c.name === e.cust), e.siteId); return sl ? <span className="font-normal text-g500"> — {sl}</span> : null; })()}</div>
                          <div className="text-[11px] text-g500">{e.contact}</div>
                        </td>
                        <td className="px-[13px] py-[10px] align-middle">
                          <span className="inline-flex items-center gap-1 text-[11px] text-g600 bg-g100 px-2 py-0.5 rounded-[3px] font-medium">
                            <SourceIcon source={e.src} /> {e.src}
                          </span>
                        </td>
                        <td className="px-[13px] py-[10px] align-middle">
                          <span className="font-mono text-[10px] font-bold bg-g100 text-g600 px-[7px] py-[2px] rounded-full inline-flex items-center">
                            {e.items.length} item(s)
                          </span>
                        </td>
                        <td className="px-[13px] py-[10px] align-middle"><Badge status={e.urg} /></td>
                        <td className="px-[13px] py-[10px] align-middle"><Badge status={e.status} /></td>
                        <td className="px-[13px] py-[10px] align-middle font-mono text-[10.5px] font-bold">
                          {e.ageH < 1 ? <span className="text-sW"><span className="inline-block w-[7px] h-[7px] rounded-full bg-sW mr-1"></span>Now</span> :
                           e.ageH < 4 ? <span className="text-sW"><span className="inline-block w-[7px] h-[7px] rounded-full bg-sW mr-1"></span>{e.ageH.toFixed(1)}h</span> :
                           e.ageH < 24 ? <span className="text-sR"><span className="inline-block w-[7px] h-[7px] rounded-full bg-sR mr-1"></span>{Math.round(e.ageH)}h</span> :
                           <span className="text-red-mrt"><span className="inline-block w-[7px] h-[7px] rounded-full bg-red-mrt mr-1 animate-pulse"></span>{Math.floor(e.ageH/24)}d {Math.round(e.ageH%24)}h</span>
                          }
                        </td>
                        <td className="px-[13px] py-[10px] align-middle">
                          {e.qRef ? <span className="font-mono text-[10.5px] font-bold text-sQ">{e.qRef}</span> : <span className="text-g400 text-[11px]">--</span>}
                        </td>
                        <td className="px-[13px] py-[10px] align-middle" onClick={ev => ev.stopPropagation()}>
                          <div className="flex gap-1.5">
                            <Button size="sm" variant="secondary" onClick={() => navigate(`/enquiries/new?id=${e.id}`)}>Edit</Button>
                            <Button size="sm" variant="secondary" onClick={(ev) => { ev.stopPropagation(); openDetailPanel('enquiry', e.id); }}>Detail</Button>
                            {!e.qRef && <Button size="sm" variant="ghost" onClick={(ev) => { ev.stopPropagation(); navigate(`/quotes/new?enqRef=${e.id}`); }}>Quote</Button>}
                            <Button size="sm" variant="secondary" onClick={(ev) => { ev.stopPropagation(); openAttachmentModal('enquiry', e.id); }}>Docs</Button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-red-mrt/[0.02] border-b-2 border-red-mrt">
                          <td colSpan={10} className="p-0">
                            <div className="p-[10px_16px]">
                              <div className="font-mono text-[8px] font-bold tracking-[2px] uppercase text-red-mrt mb-[7px]">Line Items -- {e.id}</div>
                              <table className="w-full border-collapse text-[11.5px] m-0">
                                <thead className="bg-g100">
                                  <tr>
                                    <th className="font-mono text-[8px] tracking-[1px] uppercase text-g400 px-2.5 py-1.5 text-left border-b border-g200">#</th>
                                    <th className="font-mono text-[8px] tracking-[1px] uppercase text-g400 px-2.5 py-1.5 text-left border-b border-g200">Product / Description</th>
                                    <th className="font-mono text-[8px] tracking-[1px] uppercase text-g400 px-2.5 py-1.5 text-left border-b border-g200">Material / Grade</th>
                                    <th className="font-mono text-[8px] tracking-[1px] uppercase text-g400 px-2.5 py-1.5 text-left border-b border-g200">Qty</th>
                                    <th className="font-mono text-[8px] tracking-[1px] uppercase text-g400 px-2.5 py-1.5 text-left border-b border-g200">UOM</th>
                                    <th className="font-mono text-[8px] tracking-[1px] uppercase text-g400 px-2.5 py-1.5 text-left border-b border-g200">Dwg Ref</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {e.items.map(i => (
                                    <tr key={i.seq}>
                                      <td className="px-2.5 py-1.5 border-b border-g100 text-blk font-mono text-[10px] text-g400 w-6">{i.seq}</td>
                                      <td className="px-2.5 py-1.5 border-b border-g100 text-blk font-medium">{i.desc}</td>
                                      <td className="px-2.5 py-1.5 border-b border-g100 text-blk font-mono text-[11px] text-g600">{i.mat}</td>
                                      <td className="px-2.5 py-1.5 border-b border-g100 text-blk font-mono text-[11.5px] font-bold">{i.qty}</td>
                                      <td className="px-2.5 py-1.5 border-b border-g100 text-blk text-g600">{i.uom}</td>
                                      <td className="px-2.5 py-1.5 border-b border-g100 text-blk font-mono text-[10px] text-g500">{i.drwg || '--'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {!e.qRef && (
                                <div className="mt-2">
                                  <Button size="sm" variant="primary" onClick={() => navigate(`/quotes/new?enqRef=${e.id}`)}>Convert to Quotation</Button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
