import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store';
import { Button } from '../components/ui';
import { Customer, Site, Contact } from '../lib/types';
import { generateId } from '../lib/utils';
import { Plus, Trash2, MapPin, User, Mail, Phone } from 'lucide-react';

type CustTab = 'company' | 'sites' | 'commercial';

export function NewCustomer() {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const navigate = useNavigate();
  const { data, addCustomer, updateCustomer } = useAppStore();

  const [activeTab, setActiveTab] = useState<CustTab>('company');

  const [id, setId] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [seg, setSeg] = useState('Power / Nuclear');
  const [inco, setInco] = useState('Ex-Works');
  const [curr, setCurr] = useState('INR');
  const [pay, setPay] = useState('30 days');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [sites, setSites] = useState<Site[]>([
    { id: 'S1', name: 'Main Office', city: '', contacts: [{ id: 'C1', name: '', role: 'Purchase', email: '', isPrimary: true }] }
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editId) {
      const cust = data.customers.find(c => c.id === editId);
      if (cust) {
        setId(cust.id);
        setCode(cust.code);
        setName(cust.name);
        setSeg(cust.seg || 'Power / Nuclear');
        setInco(cust.inco || 'Ex-Works');
        setCurr(cust.curr || 'INR');
        setPay(cust.pay || '30 days');
        setGstin(cust.gstin || '');
        setPan(cust.pan || '');
        setSites(cust.sites || []);
      }
    } else {
      setId(generateId('CUST', data.customers.map(c => c.id)));
      setCode(generateId('CUS', data.customers.map(c => c.code)));
    }
  }, [editId, data.customers]);

  const addSite = () => {
    setSites([...sites, {
      id: 'S' + Date.now(), name: '', city: '',
      contacts: [{ id: 'C' + Date.now(), name: '', role: '', email: '', isPrimary: false }]
    }]);
  };
  const updateSite = (sIdx: number, field: keyof Site, value: any) => {
    const s = [...sites]; (s[sIdx] as any)[field] = value; setSites(s);
  };
  const removeSite = (sIdx: number) => setSites(sites.filter((_, i) => i !== sIdx));
  const addContact = (sIdx: number) => {
    const s = [...sites];
    s[sIdx].contacts.push({ id: 'C' + Date.now(), name: '', role: '', email: '' });
    setSites(s);
  };
  const updateContact = (sIdx: number, cIdx: number, field: keyof Contact, value: any) => {
    const s = [...sites]; (s[sIdx].contacts[cIdx] as any)[field] = value; setSites(s);
  };
  const removeContact = (sIdx: number, cIdx: number) => {
    const s = [...sites]; s[sIdx].contacts = s[sIdx].contacts.filter((_, i) => i !== cIdx); setSites(s);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Company name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) { setActiveTab('company'); return; }
    const cust: Customer = {
      id, code: code.trim().toUpperCase(), name: name.trim(),
      seg, inco, curr, pay, gstin: gstin.trim().toUpperCase(), pan: pan.trim().toUpperCase() || undefined, sites
    };
    if (editId) await updateCustomer(editId, cust);
    else await addCustomer(cust);
    navigate('/customers');
  };

  const TABS: { key: CustTab; label: string; count?: number }[] = [
    { key: 'company', label: 'Company Info' },
    { key: 'sites', label: 'Sites & Contacts', count: sites.length },
    { key: 'commercial', label: 'Commercial Terms' },
  ];

  const inputCls = 'w-full font-sans text-sm bg-white border border-g300 rounded-[3px] p-2 outline-none focus:border-red-mrt focus:ring-4 focus:ring-red-lt transition-all';
  const labelCls = 'block text-[10px] font-bold text-g600 uppercase tracking-wide mb-1';

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      {/* Sticky header with tab bar */}
      <div className="bg-white border-b border-g200 sticky top-0 z-10">
        <div className="pt-5 px-6 pb-0 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl text-blk tracking-tight leading-tight">
              {editId ? 'Edit' : 'Add'} <em className="italic text-red-mrt">Customer</em>
            </h2>
            <p className="text-xs text-g500 mt-1">
              {editId ? `Updating corporate record ${code}` : 'Create a new hierarchical customer master record.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate('/customers')}>Cancel</Button>
            <Button variant="primary" onClick={handleSave}>Save Record</Button>
          </div>
        </div>

        <div className="flex px-6 mt-4 gap-0">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
                activeTab === t.key
                  ? 'border-red-mrt text-red-mrt'
                  : 'border-transparent text-g500 hover:text-blk hover:border-g300'
              }`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === t.key ? 'bg-red-mrt text-white' : 'bg-g200 text-g500'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 flex-1 overflow-y-auto pb-20">

        {/* ── TAB 1: Company Info ── */}
        {activeTab === 'company' && (
          <div className="max-w-lg space-y-4">
            <div className="bg-white border border-g200 p-5 rounded-[3px] space-y-4">
              <div className="font-mono text-[9px] font-bold tracking-[2px] uppercase text-red-mrt pb-2 border-b border-g200">Company Profile</div>

              <div>
                <label className={labelCls}>Customer Code</label>
                <div className="bg-g100 border border-g200 rounded-[3px] p-2 text-xs font-mono font-bold text-g500">{code}</div>
              </div>

              <div>
                <label className={labelCls}>Company Name <span className="text-red-mrt">*</span></label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)}
                  className={inputCls + (errors.name ? ' border-red-mrt' : '')}
                  placeholder="e.g. Aditya Birla Chemicals"
                />
                {errors.name && <p className="text-red-mrt text-[10px] mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className={labelCls}>Segment</label>
                <select value={seg} onChange={e => setSeg(e.target.value)} className={inputCls}>
                  <option>Power / Nuclear</option>
                  <option>Sugar</option>
                  <option>Chemical</option>
                  <option>Valve OEM</option>
                  <option>PHE OEM</option>
                  <option>Defence</option>
                  <option>Export</option>
                  <option>General</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>Primary GSTIN</label>
                <input
                  type="text" value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())}
                  className={inputCls + ' font-mono'}
                  placeholder="09AABCM1234A1Z5"
                />
              </div>

              <div>
                <label className={labelCls}>PAN No.</label>
                <input
                  type="text" value={pan} onChange={e => setPan(e.target.value.toUpperCase())}
                  className={inputCls + ' font-mono'}
                  placeholder="AABCM1234A"
                  maxLength={10}
                />
              </div>
            </div>

            <button
              onClick={() => setActiveTab('sites')}
              className="w-full py-2.5 bg-red-mrt text-white font-mono text-[11px] font-bold tracking-widest uppercase rounded-[3px] hover:bg-red-h transition-colors"
            >
              Next: Sites & Contacts →
            </button>
          </div>
        )}

        {/* ── TAB 2: Sites & Contacts ── */}
        {activeTab === 'sites' && (
          <div className="max-w-4xl">
            <div className="flex items-center justify-between mb-4">
              <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-blk">
                Manufacturing Sites & Branches
              </div>
              <Button size="sm" variant="secondary" onClick={addSite} className="gap-1.5">
                <Plus size={14} /> Add New Site
              </Button>
            </div>

            <div className="space-y-4">
              {sites.map((site, sIdx) => (
                <div key={site.id} className="bg-white border border-g200 rounded-[3px] shadow-sm overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
                  <div className="bg-g50 p-4 border-b border-g200 flex items-center gap-3">
                    <MapPin size={15} className="text-red-mrt shrink-0" />
                    <input
                      type="text" value={site.name}
                      onChange={e => updateSite(sIdx, 'name', e.target.value)}
                      placeholder="Site Name (e.g. Pune Plant)"
                      className="bg-transparent border-none outline-none font-sans font-bold text-sm text-blk placeholder:text-g400 flex-1"
                    />
                    <input
                      type="text" value={site.city || ''}
                      onChange={e => updateSite(sIdx, 'city', e.target.value)}
                      placeholder="City"
                      className="bg-white border border-g300 rounded px-2 py-1 text-xs w-28 outline-none focus:border-red-mrt"
                    />
                    <input
                      type="text" value={site.state || ''}
                      onChange={e => updateSite(sIdx, 'state', e.target.value)}
                      placeholder="State"
                      className="bg-white border border-g300 rounded px-2 py-1 text-xs w-28 outline-none focus:border-red-mrt"
                    />
                    <button onClick={() => removeSite(sIdx)} className="text-g400 hover:text-red-mrt transition-colors p-1">
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="p-4 space-y-4">
                    <div>
                      <label className={labelCls}>Full Address / Postal Address</label>
                      <textarea
                        value={site.fullAddress || ''}
                        onChange={e => updateSite(sIdx, 'fullAddress', e.target.value)}
                        placeholder="Complete corporate address for this site..."
                        className="w-full font-sans text-xs bg-g50 border border-g300 rounded-[3px] p-2 outline-none focus:border-red-mrt h-14 resize-none transition-all focus:bg-white"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-g500 flex items-center gap-1.5">
                          <User size={10} /> Contact Persons at this site
                        </div>
                        <button onClick={() => addContact(sIdx)} className="text-[11px] font-bold text-red-mrt flex items-center gap-1 hover:underline">
                          <Plus size={12} /> Add Contact
                        </button>
                      </div>
                      <div className="space-y-2">
                        {site.contacts.map((ct, cIdx) => (
                          <div key={ct.id} className="p-3 bg-g50 border border-g200 rounded-[3px] space-y-2 group">
                            <div className="flex items-center gap-2">
                              <input
                                type="text" value={ct.name}
                                onChange={e => updateContact(sIdx, cIdx, 'name', e.target.value)}
                                placeholder="Contact Name"
                                className="bg-white border border-g300 rounded px-2 py-1 flex-1 text-xs outline-none focus:border-red-mrt"
                              />
                              <input
                                type="text" value={ct.role}
                                onChange={e => updateContact(sIdx, cIdx, 'role', e.target.value)}
                                placeholder="Designation"
                                className="bg-white border border-g300 rounded px-2 py-1 w-36 text-xs outline-none focus:border-red-mrt"
                              />
                              <label className="flex items-center gap-1.5 px-2 text-[10px] font-bold text-g500 uppercase cursor-pointer whitespace-nowrap">
                                <input
                                  type="checkbox" checked={!!ct.isPrimary}
                                  onChange={() => {
                                    const s = [...sites];
                                    s[sIdx].contacts.forEach((c, i) => c.isPrimary = i === cIdx);
                                    setSites(s);
                                  }}
                                  className="w-3 h-3 accent-red-mrt"
                                />
                                Primary
                              </label>
                              <button onClick={() => removeContact(sIdx, cIdx)} className="text-g300 group-hover:text-red-mrt transition-colors">
                                <Trash2 size={13} />
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <Mail size={11} className="absolute left-2.5 top-[7px] text-g400" />
                                <input
                                  type="email" value={ct.email}
                                  onChange={e => updateContact(sIdx, cIdx, 'email', e.target.value)}
                                  placeholder="email@company.com"
                                  className="w-full bg-white border border-g300 rounded pl-7 pr-2 py-1 text-xs outline-none focus:border-red-mrt"
                                />
                              </div>
                              <div className="relative flex-1">
                                <Phone size={11} className="absolute left-2.5 top-[7px] text-g400" />
                                <input
                                  type="tel" value={ct.phone || ''}
                                  onChange={e => updateContact(sIdx, cIdx, 'phone', e.target.value)}
                                  placeholder="Phone"
                                  className="w-full bg-white border border-g300 rounded pl-7 pr-2 py-1 text-xs outline-none focus:border-red-mrt"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {sites.length === 0 && (
                <div className="text-center py-10 text-g400 text-sm border border-dashed border-g300 rounded-[3px]">
                  No sites added yet. Click "Add New Site" to begin.
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => setActiveTab('company')} className="px-5 py-2.5 border border-g300 text-g600 text-[11px] font-bold uppercase rounded-[3px] hover:bg-g50">
                ← Back
              </button>
              <button onClick={() => setActiveTab('commercial')} className="flex-1 py-2.5 bg-red-mrt text-white font-mono text-[11px] font-bold tracking-widest uppercase rounded-[3px] hover:bg-red-h">
                Next: Commercial Terms →
              </button>
            </div>
          </div>
        )}

        {/* ── TAB 3: Commercial Terms ── */}
        {activeTab === 'commercial' && (
          <div className="max-w-lg space-y-4">
            <div className="bg-white border border-g200 p-5 rounded-[3px] space-y-4">
              <div className="font-mono text-[9px] font-bold tracking-[2px] uppercase text-g500 pb-2 border-b border-g200">
                Default Trading Terms
              </div>
              <p className="text-[11px] text-g400">
                These defaults auto-populate when this customer is selected in a quotation or order.
              </p>

              <div>
                <label className={labelCls}>Incoterms</label>
                <select value={inco} onChange={e => setInco(e.target.value)} className={inputCls}>
                  <option>Ex-Works</option>
                  <option>FOB</option>
                  <option>CIF</option>
                  <option>FOR</option>
                  <option>DDP</option>
                  <option>DAP</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>Currency</label>
                <select value={curr} onChange={e => setCurr(e.target.value)} className={inputCls}>
                  <option>INR</option>
                  <option>USD</option>
                  <option>EUR</option>
                  <option>GBP</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>Payment Terms</label>
                <input
                  type="text" value={pay} onChange={e => setPay(e.target.value)}
                  className={inputCls} placeholder="e.g. 30 days net"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setActiveTab('sites')} className="px-5 py-2.5 border border-g300 text-g600 text-[11px] font-bold uppercase rounded-[3px] hover:bg-g50">
                ← Back
              </button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-red-mrt text-white font-mono text-[11px] font-bold tracking-widest uppercase rounded-[3px] hover:bg-red-h transition-colors">
                Save Record
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}