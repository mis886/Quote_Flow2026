import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store';
import { generateId, formatINR } from '../lib/utils';
import { QuoteItem, Quote, AuthorizedSignatory, QuoteStatus } from '../lib/types';
import { Button } from '../components/ui';
import { generateQuotePDF } from '../lib/pdfGenerator';
import { SendEmailModal } from '../components/SendEmailModal';

const STEPS = ['Form', 'Preview'];

type TncState = {
  delivery: string; leadTime: string; pnf: string;
  freight: string; payment: string; validity: string; taxes: string;
};

const defaultTnc = (): TncState => ({
  delivery: 'Ex-works, Meerut',
  leadTime: '3-4 weeks from receipt of PO',
  pnf: 'Extra @ 2%',
  freight: 'Courier charges extra at actuals',
  payment: '30 days',
  validity: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  taxes: 'GST Extra as applicable, 18% at present',
});

const selectCls = "w-full font-sans text-[13px] text-blk bg-white border border-g300 rounded-[3px] p-[8px_10px] outline-none appearance-none bg-[url('data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'10\\' height=\\'6\\'%3E%3Cpath d=\\'M1 1l4 4 4-4\\' stroke=\\'%23888\\' stroke-width=\\'1.5\\' fill=\\'none\\' stroke-linecap=\\'round\\'/%3E%3C/svg%3E')] bg-no-repeat bg-[right_9px_center] pr-[26px] cursor-pointer focus:border-red-mrt focus:ring-[3px] focus:ring-red-lt";

export function NewQuote() {
  const [searchParams] = useSearchParams();
  const enqRef = searchParams.get('enqRef');
  const editId = searchParams.get('id');
  const navigate = useNavigate();
  const { data, addQuote, updateQuote, updateEnquiry, addCustomer, addSignatory } = useAppStore();

  const descSuggestions = useMemo(() =>
    [...new Set([
      ...data.enquiries.flatMap(e => e.items.map(i => i.desc)),
      ...data.quotes.flatMap(q => q.items.map(i => i.desc)),
    ].filter(Boolean))].sort(), [data.enquiries, data.quotes]);
  const matSuggestions = useMemo(() =>
    [...new Set([
      ...data.enquiries.flatMap(e => e.items.map(i => i.mat)),
      ...data.quotes.flatMap(q => q.items.map(i => i.mat)),
    ].filter(Boolean))].sort(), [data.enquiries, data.quotes]);
  const hsnSuggestions = useMemo(() =>
    [...new Set(data.quotes.flatMap(q => q.items.map(i => i.hsn ?? '')).filter(Boolean))].sort(),
    [data.quotes]);

  const [step, setStep] = useState(1);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [validity, setValidity] = useState(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
  const [custName, setCustName] = useState('');
  const [siteId, setSiteId] = useState('');
  const [contactId, setContactId] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [inco, setInco] = useState('EXW - Ex Works');
  const [customInco, setCustomInco] = useState('');
  const [curr, setCurr] = useState('INR');
  const [pay, setPay] = useState('30 days');
  const [unitId, setUnitId] = useState('');
  const [custEnquiryDocNo, setCustEnquiryDocNo] = useState('');
  const [authName, setAuthName] = useState('');
  const [authDesignation, setAuthDesignation] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [selectedSigId, setSelectedSigId] = useState('');
  const [quoteStatus, setQuoteStatus] = useState<QuoteStatus>('Sent');
  const [tnc, setTnc] = useState<TncState>(defaultTnc);
  const setTncField = (k: keyof TncState, v: string) => setTnc((p: TncState) => ({ ...p, [k]: v }));
  const [sigMsg, setSigMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [quoteId, setQuoteId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [savedQuote, setSavedQuote] = useState<Quote | null>(null);

  // Auto-load default signatory
  useEffect(() => {
    if (editId || enqRef || authName) return;
    const def = data.signatories.find((s: AuthorizedSignatory) => s.is_default);
    if (def) { setAuthName(def.name); setAuthDesignation(def.designation); setAuthPhone(def.phone); setSelectedSigId(def.id); }
  }, [data.signatories, editId, enqRef]);

  // Load / init
  useEffect(() => {
    if (editId) {
      const q = data.quotes.find(x => x.id === editId);
      if (q) {
        setQuoteId(q.id); setDate(q.date); setValidity(q.validity || '');
        setCustName(q.cust); setInco(q.inco || 'EXW - Ex Works');
        setCurr(q.curr || 'INR'); setPay(q.pay || '30 days');
        setAuthName(q.authorizedPerson?.name || ''); setAuthDesignation(q.authorizedPerson?.designation || ''); setAuthPhone(q.authorizedPerson?.phone || '');
        setQuoteStatus(q.status);
        if (q.unitId) setUnitId(q.unitId);
        if (q.custEnquiryDocNo) setCustEnquiryDocNo(q.custEnquiryDocNo);
        if (q.terms) { try { setTnc({ ...defaultTnc(), ...JSON.parse(q.terms) }); } catch { /**/ } }
        setItems(q.items);
        const matched = data.signatories.find((s: AuthorizedSignatory) => s.name === q.authorizedPerson?.name);
        if (matched) setSelectedSigId(matched.id);
        const c = data.customers.find(x => x.name === q.cust);
        if (c) {
          const ps = (c.sites ?? []).find((s: any) => s.isPrimary) || (c.sites ?? [])[0];
          if (ps) { setSiteId(ps.id); const pc = (ps.contacts ?? []).find((ct: any) => ct.isPrimary) || (ps.contacts ?? [])[0]; if (pc) { setContactId(pc.id); setContact(pc.name); setEmail(pc.email); } }
        }
      }
    } else if (enqRef) {
      setQuoteId(generateId('MRT', data.quotes.map(q => q.id)));
      const enq = data.enquiries.find(e => e.id === enqRef);
      if (enq) {
        setCustName(enq.cust); if (enq.siteId) setSiteId(enq.siteId); if (enq.contactId) setContactId(enq.contactId);
        setContact(enq.contact); setEmail(enq.email);
        const cr = data.customers.find(c => c.name === enq.cust);
        if (cr) { setInco(cr.inco || 'EXW - Ex Works'); setCurr(cr.curr || 'INR'); setPay(cr.pay || '30 days'); }
        setItems(enq.items.map((i, idx) => ({ ...i, seq: idx + 1, hsn: '40169930', unitPrice: 0, gst: 18, total: 0 })));
      }
    } else {
      setQuoteId(generateId('MRT', data.quotes.map(q => q.id)));
      setItems([{ seq: 1, desc: '', mat: '', hsn: '40169930', qty: 1, uom: 'pcs', unitPrice: 0, gst: 18, total: 0 }]);
    }
  }, [editId, enqRef, data.enquiries, data.customers, data.quotes]);

  // Auto-load default unit
  useEffect(() => {
    if (unitId || editId) return;
    const def = data.units.find(u => u.is_default) ?? data.units[0];
    if (def) setUnitId(def.id);
  }, [data.units, unitId, editId]);

  // Cascading customer → site → contact auto-fill
  useEffect(() => {
    if (!custName) return;
    const customer = data.customers.find(c => c.name === custName);
    if (!customer) return;
    if (!editId) { setInco(customer.inco || 'EXW - Ex Works'); setCurr(customer.curr || 'INR'); setPay(customer.pay || '30 days'); }
    const sites = customer.sites ?? [];
    if (siteId) {
      const site = sites.find(s => s.id === siteId);
      if (site) {
        const contacts = site.contacts ?? [];
        if (contactId) { const ct = contacts.find(c => c.id === contactId); if (ct) { setContact(ct.name); setEmail(ct.email); } }
        else { const pc = contacts.find(ct => ct.isPrimary) || contacts[0]; if (pc) { setContactId(pc.id); setContact(pc.name); setEmail(pc.email); } }
      }
    } else { const ps = sites.find(s => s.isPrimary) || sites[0]; if (ps) setSiteId(ps.id); }
  }, [custName, siteId, contactId, data.customers, editId]);

  // T&C auto-fill from incoterms
  useEffect(() => {
    if (editId) return;
    const sel = inco === 'OVERRIDE' ? customInco : inco;
    let delivery = 'As per schedule', pnf = 'Extra @ 2%', freight = 'Courier charges extra at actuals';
    if (sel.includes('EXW')) { delivery = 'Ex-works, Meerut'; }
    else if (sel.includes('FOB')) { delivery = 'FOB Port of Loading'; pnf = 'Included'; freight = "Buyer's account from port"; }
    else if (sel.includes('CIF') || sel.includes('CIP')) { delivery = 'CIF/CIP Destination'; pnf = 'Included'; freight = 'Included up to destination'; }
    else if (sel.includes('DDP') || sel.includes('DAP')) { delivery = 'Door Delivery, Customer Site'; pnf = 'Included'; freight = 'Included'; }
    setTnc(p => ({ ...p, delivery, pnf, freight, payment: pay, validity }));
  }, [inco, customInco, pay, validity, editId]);

  // Item helpers
  const updateItem = (idx: number, field: keyof QuoteItem, value: any) => {
    const ni = [...items]; (ni[idx] as any)[field] = value;
    if (field === 'qty' || field === 'unitPrice') ni[idx].total = Number(ni[idx].qty) * Number(ni[idx].unitPrice);
    setItems(ni);
  };
  const addItem = () => setItems([...items, { seq: items.length + 1, desc: '', mat: '', hsn: '40169930', qty: 1, uom: 'pcs', unitPrice: 0, gst: 18, total: 0 }]);
  const removeItem = (idx: number) => { if (items.length === 1) return; setItems(items.filter((_, i) => i !== idx).map((it, i) => ({ ...it, seq: i + 1 }))); };

  const subTotal = items.reduce((s, i) => s + i.total, 0);
  const gstTotal = items.reduce((s, i) => s + i.total * i.gst / 100, 0);
  const grandTotal = subTotal + gstTotal;

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!custName) e.custName = 'Customer is required';
    if (items.some(i => !i.desc || Number(i.qty) <= 0)) e.items = 'All items need a description and quantity > 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildQuoteData = (): Quote => ({
    id: quoteId, enqRef: enqRef || '', cust: custName, date, validity,
    status: editId ? quoteStatus : 'Sent',
    curr, pay, items,
    authorizedPerson: { name: authName, designation: authDesignation, phone: authPhone },
    terms: JSON.stringify(tnc),
    inco: inco === 'OVERRIDE' ? customInco : inco,
    unitId: unitId || undefined,
    custEnquiryDocNo: custEnquiryDocNo.trim() || undefined,
  });

  // Persist the quote (without PDF). Returns the qData used, so callers can
  // reuse it for the PDF without rebuilding.
  const persistQuote = async (): Promise<Quote | null> => {
    if (!validateStep1()) { setStep(1); return null; }
    setErrors({});
    const qData = buildQuoteData();
    if (editId) {
      await updateQuote(editId, qData);
    } else {
      await addQuote(qData);
      if (enqRef) await updateEnquiry(enqRef, { status: 'Quoted', qRef: quoteId });
    }
    if (!data.customers.find(c => c.name.toLowerCase() === custName.toLowerCase())) {
      await addCustomer({ id: generateId('CUST', data.customers.map(c => c.id)), code: generateId('CUS', data.customers.map(c => c.code)), name: custName, seg: 'General', gstin: '', inco: 'Ex-Works', curr: 'INR', pay: '30 days', sites: [] });
    }
    return qData;
  };

  // Save only: persist + navigate to /quotes. No PDF.
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const qData = await persistQuote();
      if (qData) navigate('/quotes');
    } catch {
      setErrors({ global: 'Failed to save. Please check your connection.' });
    } finally { setIsSaving(false); }
  };

  // Generate PDF: persist + download. Stays on the page so doer can review.
  const handleGeneratePDF = async () => {
    setIsSaving(true);
    try {
      const qData = await persistQuote();
      if (!qData) return;
      const unit = unitId ? data.units.find(u => u.id === unitId) : data.units.find(u => u.is_default);
      const unitSig = unit?.signatory_id ? data.signatories.find(s => s.id === unit.signatory_id) : undefined;
      const sig = unitSig ?? data.signatories.find((s: any) => s.is_default);
      generateQuotePDF(qData, data.customers.find(c => c.name === custName), data.settings, sig, true, unit);
    } catch {
      setErrors({ global: 'Failed to generate PDF. Please check your connection.' });
    } finally { setIsSaving(false); }
  };

  const goPreview = () => { if (validateStep1()) setStep(2); };

  // Stepper
  const Stepper = () => (
    <div className="flex items-center flex-1 px-6">
      {STEPS.map((label, i) => {
        const n = i + 1; const active = step === n; const done = step > n;
        return (
          <React.Fragment key={n}>
            <button type="button" onClick={() => (done || n < step) ? setStep(n) : undefined}
              className={`flex flex-col items-center gap-1 ${done ? 'cursor-pointer' : 'cursor-default'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${active ? 'bg-red-mrt text-white shadow-sm' : done ? 'bg-green-500 text-white' : 'bg-g200 text-g400'}`}>
                {done ? '✓' : n}
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-wider whitespace-nowrap ${active ? 'text-red-mrt' : done ? 'text-green-600' : 'text-g400'}`}>{label}</span>
            </button>
            {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-3 transition-all ${step > n ? 'bg-green-400' : 'bg-g200'}`} />}
          </React.Fragment>
        );
      })}
    </div>
  );

  const customer = data.customers.find(c => c.name === custName);

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">

      {/* Header */}
      <div className="pt-4 px-5 pb-3 border-b border-g200">
        <div className="flex items-center justify-between gap-4">
          <div className="shrink-0">
            <div className="font-mono text-[9px] font-bold tracking-[3px] uppercase text-red-mrt mb-0.5">Module 02</div>
            <h1 className="font-serif text-[22px] text-blk tracking-tight leading-tight">
              {editId ? 'Edit' : 'Create'} <em className="italic text-red-mrt">Quotation</em>
            </h1>
          </div>
          <Stepper />
          <div className="flex items-center gap-3 shrink-0">
            {editId && (
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-g500 uppercase tracking-wide">Status</label>
                <select title="Quote status" value={quoteStatus}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setQuoteStatus(e.target.value as QuoteStatus)}
                  className="font-mono text-[11px] font-bold border border-g300 rounded-[3px] p-[5px_10px] outline-none focus:border-red-mrt bg-white cursor-pointer">
                  <option value="Draft">Draft</option><option value="Sent">Sent</option>
                  <option value="Won">Won</option><option value="Lost">Lost</option><option value="Parked">Parked</option>
                </select>
              </div>
            )}
            <Button variant="secondary" onClick={() => navigate('/quotes')}>Back</Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pb-6 pt-3 flex-1 overflow-y-auto">

        {/* ══ STEP 1: Form ══ */}
        {step === 1 && (
          <div className="flex flex-col gap-[12px]">

            {enqRef && (
              <div className="bg-sW/5 border border-sW/20 rounded-[3px] p-[9px_14px] flex items-center gap-[10px] text-[12px]">
                <span className="text-sW text-[14px]">✓</span>
                <div><strong className="text-sW">Items loaded from {enqRef}</strong> — Add unit prices to complete.</div>
              </div>
            )}

            {/* Quote ID + dates row */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="bg-blk p-[9px_16px] rounded-[3px] shrink-0">
                <div className="font-mono text-[8px] font-bold tracking-[2px] uppercase text-white/40 mb-0.5">Quote Ref</div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[15px] font-bold text-white">{quoteId}</span>
                  {enqRef && <span className="font-mono text-[9px] text-white/40 border-l border-white/10 pl-2">ENQ: {enqRef}</span>}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-g500 uppercase tracking-[0.5px] mb-[3px]">Date of Issue</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="font-sans text-[13px] text-blk bg-white border border-g300 rounded-[3px] p-[7px_10px] outline-none focus:border-red-mrt" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-red-mrt uppercase tracking-[0.5px] mb-[3px]">Valid Until</label>
                <input type="date" value={validity} onChange={e => setValidity(e.target.value)}
                  className="font-mono text-[13px] font-bold text-blk bg-white border-2 border-red-mrt/30 rounded-[3px] p-[7px_10px] outline-none focus:border-red-mrt" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-g500 uppercase tracking-[0.5px] mb-[3px]">Customer Enquiry Doc No.</label>
                <input type="text" value={custEnquiryDocNo} onChange={e => setCustEnquiryDocNo(e.target.value)}
                  placeholder="(if customer provided one)"
                  className="font-sans text-[13px] text-blk bg-white border border-g300 rounded-[3px] p-[7px_10px] outline-none focus:border-red-mrt" />
              </div>
            </div>

            {/* Customer & Contact + Trading Terms */}
            <div className="grid grid-cols-12 gap-[12px]">
              <div className="col-span-8 bg-white border border-g200">
                <div className="font-mono text-[8.5px] font-bold tracking-[2.5px] uppercase text-red-mrt p-[11px_16px] border-b border-g200">Customer & Contact</div>
                <div className="p-[12px_16px] grid grid-cols-2 gap-[10px]">
                  <div>
                    <label className="block text-[10px] font-bold text-g600 tracking-[0.5px] uppercase mb-[4px]">Customer <span className="text-red-mrt">*</span></label>
                    <select value={custName} onChange={e => { setCustName(e.target.value); setSiteId(''); setContactId(''); setErrors({ ...errors, custName: '' }); }}
                      className={selectCls.replace('border-g300', errors.custName ? 'border-red-mrt' : 'border-g300')}>
                      <option value="">Select Customer...</option>
                      {data.customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                    {errors.custName && <p className="text-red-mrt text-[10px] mt-1">{errors.custName}</p>}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-g600 tracking-[0.5px] uppercase mb-[4px]">Site / Branch</label>
                    <select value={siteId} onChange={e => { setSiteId(e.target.value); setContactId(''); }} disabled={!custName} className={selectCls + ' disabled:bg-g50 disabled:cursor-not-allowed'}>
                      <option value="">Select Site...</option>
                      {(data.customers.find(c => c.name === custName)?.sites ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}{s.city ? ` (${s.city})` : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-g600 tracking-[0.5px] uppercase mb-[4px]">Contact Person</label>
                    <select value={contactId} onChange={e => setContactId(e.target.value)} disabled={!siteId} className={selectCls + ' disabled:bg-g50 disabled:cursor-not-allowed'}>
                      <option value="">Select Contact...</option>
                      {((data.customers.find(c => c.name === custName)?.sites ?? []).find((s: any) => s.id === siteId)?.contacts ?? []).map((ct: any) => <option key={ct.id} value={ct.id}>{ct.name}{ct.role ? ` – ${ct.role}` : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-g600 tracking-[0.5px] uppercase mb-[4px]">Email</label>
                    <input type="email" placeholder="contact@company.com" value={email} onChange={e => setEmail(e.target.value)}
                      className="w-full font-sans text-[13px] text-blk bg-white border border-g300 rounded-[3px] p-[8px_10px] outline-none focus:border-red-mrt focus:ring-[3px] focus:ring-red-lt" />
                  </div>
                </div>
              </div>

              <div className="col-span-4 bg-white border border-g200">
                <div className="font-mono text-[8.5px] font-bold tracking-[2.5px] uppercase text-g600 p-[11px_16px] border-b border-g200">Trading Terms</div>
                <div className="p-[12px_16px] flex flex-col gap-[10px]">
                  <div>
                    <label className="block text-[10px] font-bold text-g600 tracking-[0.5px] uppercase mb-[4px]">Incoterms</label>
                    <select value={inco} onChange={e => setInco(e.target.value)} className={selectCls}>
                      <option>EXW - Ex Works</option><option>FOB - Free On Board</option>
                      <option>CIF - Cost, Insurance & Freight</option><option>CIP - Carriage and Insurance Paid To</option>
                      <option>DAP - Delivered At Place</option><option>DDP - Delivered Duty Paid</option>
                      <option>FCA - Free Carrier</option><option>CPT - Carriage Paid To</option>
                      <option value="OVERRIDE">Override...</option>
                    </select>
                    {inco === 'OVERRIDE' && <input type="text" value={customInco} placeholder="e.g. FCA Mumbai" onChange={e => setCustomInco(e.target.value)} className="w-full mt-2 font-sans text-[13px] text-blk bg-white border border-g300 rounded-[3px] p-[8px_10px] outline-none focus:border-red-mrt" />}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-g600 tracking-[0.5px] uppercase mb-[4px]">Payment Terms</label>
                    <input type="text" value={pay} onChange={e => setPay(e.target.value)} className="w-full font-sans text-[13px] text-blk border border-g300 rounded-[3px] p-[8px_10px] outline-none focus:border-red-mrt" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-g600 tracking-[0.5px] uppercase mb-[4px]">Currency</label>
                    <select value={curr} onChange={e => setCurr(e.target.value)} className={selectCls + ' font-bold'}>
                      <option>INR</option><option>USD</option><option>EUR</option><option>GBP</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="bg-white border border-g200">
              <div className="p-[11px_16px] border-b border-g200 flex items-center justify-between">
                <span className="font-mono text-[8.5px] font-bold tracking-[2.5px] uppercase text-g500">Line Items <span className="text-red-mrt">*</span></span>
                {errors.items && <span className="text-red-mrt text-[11px] font-medium">{errors.items}</span>}
              </div>
              <div className="overflow-x-auto">
                <datalist id="qt-desc-list">{descSuggestions.map(s => <option key={s} value={s} />)}</datalist>
                <datalist id="qt-mat-list">{matSuggestions.map(s => <option key={s} value={s} />)}</datalist>
                <datalist id="qt-hsn-list">{hsnSuggestions.map(s => <option key={s} value={s} />)}</datalist>
                  <table className="w-full border-collapse border border-g400 text-[12px]">
                    <thead className="bg-g100">
                      <tr>
                        <th className="font-mono text-[8px] tracking-[1px] uppercase text-g500 px-3 py-1.5 text-left border border-g400 w-8">#</th>
                        <th className="font-mono text-[8px] tracking-[1px] uppercase text-red-mrt px-3 py-1.5 text-left border-b border-g200">Product / Description *</th>
                        <th className="font-mono text-[8px] tracking-[1px] uppercase text-g500 px-3 py-1.5 text-left border border-g400 min-w-[110px]">Material</th>
                        <th className="font-mono text-[8px] tracking-[1px] uppercase text-g500 px-3 py-1.5 text-left border border-g400 w-24">HSN Code</th>
                        <th className="font-mono text-[8px] tracking-[1px] uppercase text-red-mrt px-3 py-1.5 text-center border border-g400 w-16">Qty *</th>
                        <th className="font-mono text-[8px] tracking-[1px] uppercase text-g500 px-3 py-1.5 text-center border border-g400 w-24">Price Basis</th>
                        <th className="font-mono text-[8px] tracking-[1px] uppercase text-g500 px-3 py-1.5 text-right border border-g400 w-28">Unit Rate ({curr === 'INR' ? '₹' : curr})</th>
                        <th className="font-mono text-[8px] tracking-[1px] uppercase text-g500 px-3 py-1.5 text-center border border-g400 w-20">GST %</th>
                        <th className="font-mono text-[8px] tracking-[1px] uppercase text-g500 px-3 py-1.5 text-right border border-g400 w-28">Amount ({curr === 'INR' ? '₹' : curr})</th>
                        <th className="w-8 border border-g400"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={item.seq} className="hover:bg-g50/50">
                          <td className="px-3 py-[5px] border border-g400 align-middle font-mono font-bold text-g400 text-[11px]">{item.seq}</td>
                          <td className="px-3 py-[5px] border border-g400 align-middle">
                            <input type="text" list="qt-desc-list" value={item.desc} placeholder="Product name / description"
                              onChange={e => { updateItem(idx, 'desc', e.target.value); setErrors({ ...errors, items: '' }); }}
                              className={`w-full bg-transparent outline-none text-[12px] font-sans placeholder:text-g300 ${errors.items && !item.desc ? 'text-red-mrt' : 'text-blk'}`} />
                          </td>
                          <td className="px-3 py-[5px] border border-g400 align-middle">
                            <input type="text" list="qt-mat-list" placeholder="Material" value={item.mat} onChange={e => updateItem(idx, 'mat', e.target.value)} className="w-full bg-transparent outline-none text-[12px] font-sans text-blk placeholder:text-g300" />
                          </td>
                          <td className="px-3 py-[5px] border border-g400 align-middle">
                            <input type="text" list="qt-hsn-list" title="HSN Code" value={item.hsn} placeholder="e.g. 2905" onChange={e => updateItem(idx, 'hsn', e.target.value)} className="w-full bg-transparent outline-none font-mono text-[11px] text-blk placeholder:text-g300" />
                          </td>
                          <td className="px-3 py-[5px] border border-g400 align-middle">
                            <input type="number" min="1" value={item.qty || ''} placeholder="0" onChange={e => { updateItem(idx, 'qty', Number(e.target.value)); setErrors({ ...errors, items: '' }); }}
                              className={`w-full bg-transparent outline-none font-mono text-[12px] text-center placeholder:text-g300 ${errors.items && Number(item.qty) <= 0 ? 'text-red-mrt' : 'text-blk'}`} />
                          </td>
                          <td className="px-3 py-[5px] border border-g400 align-middle">
                            <input list="qt-uom-list" value={item.uom} onChange={e => updateItem(idx, 'uom', e.target.value)} placeholder="uom" className="w-full bg-g50 border border-g300 rounded-[3px] px-1.5 py-[3px] font-mono text-[11px] text-blk outline-none cursor-pointer focus:border-red-mrt focus:bg-white transition-colors" />
                          </td>
                          <td className="px-3 py-[5px] border border-g400 align-middle">
                            <input type="number" step="any" min="0" value={item.unitPrice || ''} placeholder="0.00" onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))}
                              className="w-full bg-transparent outline-none font-mono text-[12px] text-right text-blk placeholder:text-g300" />
                          </td>
                          <td className="px-3 py-[5px] border border-g400 align-middle">
                            <select value={item.gst} onChange={e => updateItem(idx, 'gst', Number(e.target.value))} className="w-full bg-transparent outline-none text-[12px] text-center font-mono text-blk appearance-none cursor-pointer">
                              <option value={18}>18%</option><option value={12}>12%</option><option value={5}>5%</option><option value={0}>0%</option>
                            </select>
                          </td>
                          <td className="px-3 py-[5px] border border-g400 align-middle text-right font-mono text-[12px] font-bold text-blk">{formatINR(item.total)}</td>
                          <td className="px-1 py-[5px] border border-g400 align-middle">
                            <button type="button" onClick={() => removeItem(idx)} className="text-g400 hover:text-red-mrt p-1 transition-colors disabled:opacity-30" title="Remove">
                              <svg viewBox="0 0 16 16" width="13" height="13" className="fill-current"><path d="M5.5 1h5v1h-5V1zM3 3v1h10V3H3zm1 2v9h8V5H4zm2 1h1v7H6V6zm3 0h1v7H9V6z" /></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-g200 bg-g50/50">
                        <td colSpan={8} className="px-3 py-2 text-right text-[11px] text-g500">Subtotal (before tax)</td>
                        <td className="px-3 py-2 text-right font-mono text-[12px] font-bold text-blk">{formatINR(subTotal)}</td>
                        <td></td>
                      </tr>
                      <tr className="border-b border-g200 bg-g50/50">
                        <td colSpan={8} className="px-3 py-2 text-right text-[11px] text-g500">GST Total</td>
                        <td className="px-3 py-2 text-right font-mono text-[12px] font-bold text-blk">{formatINR(gstTotal)}</td>
                        <td></td>
                      </tr>
                      <tr className="bg-[#1e293b]">
                        <td colSpan={8} className="px-3 py-2.5 text-right text-[12px] font-bold text-white">Grand Total</td>
                        <td className="px-3 py-2.5 text-right font-mono text-[13px] font-bold text-white">{formatINR(grandTotal)}</td>
                        <td className="bg-[#1e293b]"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="p-[8px_12px]">
                  <div className="inline-flex items-center gap-[6px] p-[7px_9px] text-red-mrt cursor-pointer text-[12px] font-semibold border border-dashed border-red-mrt/25 rounded-[3px] transition-colors hover:bg-red-lt" onClick={addItem}>
                    <svg viewBox="0 0 16 16" className="w-[13px] h-[13px] stroke-red-mrt fill-none stroke-2"><path d="M8 3v10M3 8h10"/></svg>
                    Add Another Line Item
                  </div>
                </div>
            </div>

            {/* Company Unit for PDF */}
            <div className="bg-white border border-g200">
              <div className="p-[11px_16px] border-b border-g200 flex items-center justify-between">
                <span className="font-mono text-[8.5px] font-bold tracking-[2.5px] uppercase text-g600">Company Unit (for Quotation PDF)</span>
                {data.units.length === 0 && (
                  <button type="button" onClick={() => navigate('/settings')} className="text-[9px] font-bold text-red-mrt uppercase hover:underline">Configure in Settings →</button>
                )}
              </div>
              <div className="p-[12px_16px]">
                <label className="block text-[10px] font-bold text-g500 uppercase tracking-[0.5px] mb-[4px]">Company Unit</label>
                <select title="Select unit" value={unitId} onChange={e => setUnitId(e.target.value)} className="w-full font-sans text-[13px] text-blk bg-white border border-g300 rounded-[3px] p-[7px_10px] outline-none focus:border-red-mrt" disabled={data.units.length === 0}>
                  <option value="">{data.units.length === 0 ? '— No units configured —' : '— Select unit —'}</option>
                  {data.units.map(u => (
                    <option key={u.id} value={u.id}>{u.name}{u.is_default ? ' (default)' : ''}</option>
                  ))}
                </select>
                {unitId && (() => {
                  const u = data.units.find(x => x.id === unitId);
                  return u ? (
                    <div className="text-[10px] text-g400 mt-1.5 font-mono leading-relaxed">
                      {u.gstin && <span>GSTIN: <span className="text-g600 font-semibold">{u.gstin}</span></span>}
                      {u.header_url && <span className="ml-3 text-emerald-600">✓ Letterhead set</span>}
                    </div>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Signatory & T&C */}
            <div className="grid grid-cols-12 gap-[12px]">
              {/* T&C */}
              <div className="col-span-8 bg-white border border-g200">
                <div className="p-[11px_16px] border-b border-g200 flex items-center justify-between">
                  <span className="font-mono text-[8.5px] font-bold tracking-[2.5px] uppercase text-red-mrt">Terms & Conditions</span>
                  <button type="button" onClick={() => setTnc(p => ({ ...p, ...defaultTnc(), payment: pay, validity }))} className="text-[9px] font-bold text-g400 uppercase hover:text-red-mrt hover:underline">Reset</button>
                </div>
                <div className="p-[12px_16px]">
                  <table className="w-full border border-g200 text-[12px] border-collapse">
                    <thead>
                      <tr className="bg-g50">
                        <th className="w-7 border border-g200 px-2 py-1.5 font-mono text-[9px] text-g400 text-center">#</th>
                        <th className="w-[150px] border border-g200 px-2 py-1.5 font-bold text-g600 text-left text-[11px]">Condition</th>
                        <th className="border border-g200 px-2 py-1.5 font-bold text-g600 text-left text-[11px]">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {([['delivery','Delivery Point'],['leadTime','Lead Time'],['pnf','Packing & Fwd'],['freight','Freight'],['payment','Payment'],['validity','Validity'],['taxes','Taxes']] as [keyof TncState, string][]).map(([key, label], idx) => (
                        <tr key={key} className="border-b border-g200 last:border-0">
                          <td className="border border-g200 px-2 py-1 font-mono text-[9px] text-g400 text-center">{idx + 1}</td>
                          <td className="border border-g200 px-2 py-1 font-bold text-g600 whitespace-nowrap text-[11px]">{label}</td>
                          <td className="border border-g200 px-1 py-0.5">
                            <input type="text" value={tnc[key]} onChange={e => setTncField(key, e.target.value)} title={label}
                              className="w-full font-sans text-[12px] text-blk bg-transparent px-2 py-1 outline-none focus:bg-g50 rounded-[2px]" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signatory */}
              <div className="col-span-4 bg-white border border-g200">
                <div className="p-[11px_16px] border-b border-g200"><span className="font-mono text-[8.5px] font-bold tracking-[2.5px] uppercase text-g600">Authorized Signatory</span></div>
                <div className="p-[12px_16px] flex flex-col gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-g500 uppercase tracking-[0.5px] mb-[4px]">Select from List</label>
                    <select value={selectedSigId}
                      onChange={e => { const sid = e.target.value; setSelectedSigId(sid); const sig = data.signatories.find(s => s.id === sid); if (sig) { setAuthName(sig.name); setAuthDesignation(sig.designation); setAuthPhone(sig.phone); } }}
                      className={selectCls}>
                      <option value="">-- Select or Type Below --</option>
                      {data.signatories.map(s => <option key={s.id} value={s.id}>{s.name} ({s.designation})</option>)}
                    </select>
                  </div>
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-bold text-g500 uppercase tracking-[0.5px]">Details</label>
                    <button type="button" onClick={async () => {
                      if (!authName.trim()) { setSigMsg({ type: 'error', text: 'Enter a name first' }); setTimeout(() => setSigMsg(null), 3000); return; }
                      try { const ns: AuthorizedSignatory = { id: 'sig-' + Date.now(), name: authName.trim(), designation: authDesignation.trim(), phone: authPhone.trim(), is_default: false }; await addSignatory(ns); setSelectedSigId(ns.id); setSigMsg({ type: 'success', text: 'Saved' }); setTimeout(() => setSigMsg(null), 3000); }
                      catch { setSigMsg({ type: 'error', text: 'Could not save' }); }
                    }} className="text-[9px] font-bold text-red-mrt uppercase hover:underline">Save to List</button>
                  </div>
                  {sigMsg && <div className={`text-[10px] font-semibold ${sigMsg.type === 'success' ? 'text-green-600' : 'text-red-mrt'}`}>{sigMsg.text}</div>}
                  <div className="flex flex-col gap-2">
                    <input type="text" value={authName} onChange={e => { setAuthName(e.target.value); setSelectedSigId(''); }} placeholder="Name"
                      className="w-full font-sans text-[13px] text-blk border border-g300 rounded-[3px] p-[7px_10px] outline-none focus:border-red-mrt" />
                    <input type="text" value={authDesignation} onChange={e => { setAuthDesignation(e.target.value); setSelectedSigId(''); }} placeholder="Designation"
                      className="w-full font-sans text-[13px] text-blk border border-g300 rounded-[3px] p-[7px_10px] outline-none focus:border-red-mrt" />
                    <input type="text" value={authPhone} onChange={e => { setAuthPhone(e.target.value); setSelectedSigId(''); }} placeholder="Phone"
                      className="w-full font-sans text-[13px] text-blk border border-g300 rounded-[3px] p-[7px_10px] outline-none focus:border-red-mrt" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ STEP 2: Preview ══ */}
        {step === 2 && (
          <div className="space-y-[12px]">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-[12px]">
              <div className="bg-white border border-g200 rounded-[3px] p-4">
                <div className="font-mono text-[8px] font-bold tracking-[2px] uppercase text-red-mrt pb-2 border-b border-g200 mb-3">Quote Info</div>
                <div className="space-y-1.5 text-[12px]">
                  <div className="flex justify-between"><span className="text-g500">Reference</span><span className="font-mono font-bold text-blk">{quoteId}</span></div>
                  <div className="flex justify-between"><span className="text-g500">Date</span><span>{date}</span></div>
                  <div className="flex justify-between"><span className="text-g500">Valid Until</span><span className="text-red-mrt font-medium">{validity}</span></div>
                  {editId && <div className="flex justify-between"><span className="text-g500">Status</span><span className="font-bold uppercase text-[10px] px-2 py-0.5 bg-g100 rounded">{quoteStatus}</span></div>}
                </div>
              </div>
              <div className="bg-white border border-g200 rounded-[3px] p-4">
                <div className="font-mono text-[8px] font-bold tracking-[2px] uppercase text-red-mrt pb-2 border-b border-g200 mb-3">Customer</div>
                <div className="text-[12px] space-y-1">
                  <div className="font-bold text-[14px] text-blk">{custName || '—'}</div>
                  {contact && <div className="text-g500">{contact}</div>}
                  {email && <div className="text-g400 text-[11px] break-all">{email}</div>}
                </div>
              </div>
              <div className="bg-white border border-g200 rounded-[3px] p-4">
                <div className="font-mono text-[8px] font-bold tracking-[2px] uppercase text-red-mrt pb-2 border-b border-g200 mb-3">Trading Terms</div>
                <div className="text-[12px] space-y-1.5">
                  <div className="flex justify-between"><span className="text-g500">Incoterms</span><span className="font-medium">{inco === 'OVERRIDE' ? customInco : inco}</span></div>
                  <div className="flex justify-between"><span className="text-g500">Payment</span><span>{pay}</span></div>
                  <div className="flex justify-between"><span className="text-g500">Currency</span><span className="font-bold">{curr}</span></div>
                </div>
              </div>
            </div>

            {/* Line items */}
            <div className="bg-white border border-g200 rounded-[3px]">
              <div className="p-[11px_16px] border-b border-g200 flex justify-between items-center">
                <span className="font-mono text-[8.5px] font-bold tracking-[2.5px] uppercase text-g600">{items.length} Line Item{items.length !== 1 ? 's' : ''}</span>
                <span className="font-mono text-[12px] font-bold text-red-mrt">{formatINR(grandTotal)}</span>
              </div>
              <table className="w-full text-[12px]">
                <tbody>
                  {items.map(item => (
                    <tr key={item.seq} className="border-b border-g200 last:border-0">
                      <td className="px-4 py-2 font-mono text-g400 text-[10px] w-8">{item.seq}</td>
                      <td className="px-4 py-2 text-blk">{item.desc || <span className="text-g300 italic">No description</span>}</td>
                      <td className="px-4 py-2 text-g500">{item.mat}</td>
                      <td className="px-4 py-2 text-g500 text-right w-24">{item.qty} {item.uom}</td>
                      <td className="px-4 py-2 font-mono text-right w-28">{formatINR(item.unitPrice)}</td>
                      <td className="px-4 py-2 font-mono font-bold text-right w-28 text-blk">{formatINR(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end p-4">
                <div className="w-[240px] text-[12px] space-y-1.5">
                  <div className="flex justify-between text-g500"><span>Sub-Total</span><span className="font-mono">{formatINR(subTotal)}</span></div>
                  <div className="flex justify-between text-g500"><span>GST</span><span className="font-mono">{formatINR(gstTotal)}</span></div>
                  <div className="flex justify-between font-bold text-blk border-t border-g200 pt-2 text-[14px]"><span>Grand Total</span><span className="font-mono text-red-mrt">{formatINR(grandTotal)}</span></div>
                </div>
              </div>
            </div>

            {/* Signatory & T&C */}
            <div className="grid grid-cols-2 gap-[12px]">
              <div className="bg-white border border-g200 rounded-[3px] p-4">
                <div className="font-mono text-[8px] font-bold tracking-[2px] uppercase text-g500 pb-2 border-b border-g200 mb-3">Authorized Signatory</div>
                {authName ? (
                  <div className="text-[12px] space-y-1"><div className="font-bold text-[14px] text-blk">{authName}</div><div className="text-g500">{authDesignation}</div>{authPhone && <div className="text-g400">{authPhone}</div>}</div>
                ) : <div className="text-[11px] text-g400 italic">No signatory set</div>}
              </div>
              <div className="bg-white border border-g200 rounded-[3px] p-4">
                <div className="font-mono text-[8px] font-bold tracking-[2px] uppercase text-g500 pb-2 border-b border-g200 mb-3">Terms & Conditions</div>
                <table className="w-full text-[11px] border-collapse">
                  <tbody>
                    {([['Delivery',tnc.delivery],['Lead Time',tnc.leadTime],['P&F',tnc.pnf],['Freight',tnc.freight],['Payment',tnc.payment],['Validity',tnc.validity],['Taxes',tnc.taxes]] as [string,string][]).map(([label, val], i) => (
                      <tr key={label} className="border-b border-g200 last:border-0">
                        <td className="pr-1.5 py-1 font-mono text-[9px] text-g400 w-4 align-top">{i + 1}</td>
                        <td className="pr-3 py-1 font-bold text-g600 whitespace-nowrap align-top">{label}</td>
                        <td className="py-1 text-g500">{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="flex items-center justify-between p-[12px_20px] bg-white border-t border-g200 sticky bottom-0 z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
        <div>
          {step > 1 && (
            <button type="button" onClick={() => setStep(1)} className="bg-white border border-g300 text-g600 font-mono text-[10px] font-bold tracking-widest uppercase px-[16px] py-[9px] rounded-[3px] hover:bg-g50 flex items-center gap-2">
              ← Back
            </button>
          )}
        </div>
        <div className="flex items-center gap-[10px]">
          {step === 1 ? (
            <button type="button" onClick={goPreview} className="bg-red-mrt text-white font-mono text-[11px] font-bold tracking-widest uppercase px-[20px] py-[10px] rounded-[3px] shadow-sm hover:bg-red-h hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2">
              Preview →
            </button>
          ) : (
            <>
              <button type="button" onClick={handleSave} disabled={isSaving}
                className="bg-red-mrt text-white font-mono text-[11px] font-bold tracking-widest uppercase px-[20px] py-[10px] rounded-[3px] shadow-sm hover:bg-red-h disabled:opacity-50 flex items-center gap-2">
                <svg viewBox="0 0 16 16" width="12" height="12" className="fill-current"><path d="M4 2v12h8V6l-4-4H4zm1 1h2v3h2V3h1.172L11 3.828V13H5V3zm2 6v3h2v-3H7z" /></svg>
                {isSaving ? 'Saving...' : 'Save & PDF'}
              </button>
              <button type="button" onClick={() => setShowEmailModal(true)} disabled={isSaving}
                className="bg-blk text-white font-mono text-[11px] font-bold tracking-widest uppercase px-[20px] py-[10px] rounded-[3px] shadow-sm hover:bg-g700 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 flex items-center gap-2">
                <svg viewBox="0 0 16 16" width="12" height="12" className="fill-current"><path d="M2 4h12v8H2zM3 5l5 3.5L13 5v-.5L8 8 3 4.5V5z" /></svg>
                Email to Client
              </button>
              <div className="h-5 w-px bg-g200" />
              <button type="button" onClick={() => navigate('/quotes')} disabled={isSaving} className="bg-white border border-g300 text-g600 font-mono text-[10px] font-bold tracking-widest uppercase px-[16px] py-[9px] rounded-[3px] hover:bg-g50 disabled:opacity-50">
                Cancel
              </button>
            </>
          )}
          {errors.global && <span className="text-red-mrt text-[11px] font-bold">{errors.global}</span>}
        </div>
      </div>

      {/* Email modal */}
      {showEmailModal && (
        <SendEmailModal
          mode="quote"
          doc={buildQuoteData()}
          customer={customer}
          settings={data.settings}
          defaultSignatory={data.signatories.find((s: any) => s.is_default)}
          onClose={() => setShowEmailModal(false)}
          onSent={async () => {
            setShowEmailModal(false);
            await handleSave();
          }}
        />
      )}
    </div>
  );
}