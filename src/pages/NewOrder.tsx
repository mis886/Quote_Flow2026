import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store';
import { generateId, formatINR, parseQuoteTerms } from '../lib/utils';
import { OrderItem, Order, AuthorizedSignatory, OrderStatus } from '../lib/types';
import { Button } from '../components/ui';
import { generatePIPDF } from '../lib/pdfGenerator';
import { uploadToS3 } from '../lib/s3';
import { Upload } from 'lucide-react';
import { SendEmailModal } from '../components/SendEmailModal';

const STEPS = ['Form', 'Preview'];

// Pre-defined optional T&C clauses the doer can toggle per customer requirement.
// Selected clauses are appended to the Terms & Conditions textarea as separate lines.
const OPTIONAL_TNC_CLAUSES = [
  'Inspection: Customer inspection welcome at our works before dispatch.',
  'Warranty: 6 months from date of dispatch against manufacturing defects.',
  'Packing: Standard export packing included.',
  'Cancellation: Once accepted, the order cannot be cancelled.',
  'Force Majeure: Delivery subject to force majeure conditions.',
  'Jurisdiction: All disputes subject to Meerut jurisdiction only.',
  'Advance: 50% advance with PO, balance before dispatch.',
  'LD Clause: No LD clause applicable.',
  'Quality: As per approved sample / drawing only.',
  'Returns: No returns accepted on customized items.',
];

const selectCls = "w-full font-sans text-[13px] text-blk bg-white border border-g300 rounded-[3px] p-[8px_10px] outline-none appearance-none bg-[url('data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'10\\' height=\\'6\\'%3E%3Cpath d=\\'M1 1l4 4 4-4\\' stroke=\\'%23888\\' stroke-width=\\'1.5\\' fill=\\'none\\' stroke-linecap=\\'round\\'/%3E%3C/svg%3E')] bg-no-repeat bg-[right_9px_center] pr-[26px] cursor-pointer focus:border-red-mrt focus:ring-[3px] focus:ring-red-lt";

export function NewOrder() {
  const [searchParams] = useSearchParams();
  const quoteRef = searchParams.get('quoteRef');
  const editOrderId = searchParams.get('orderId');
  const navigate = useNavigate();
  const { data, addOrder, updateOrder, updateQuote, addCustomer, addSignatory } = useAppStore();

  const descSuggestions = useMemo(() =>
    [...new Set([
      ...data.enquiries.flatMap(e => e.items.map(i => i.desc)),
      ...data.orders.flatMap(o => o.items.map(i => i.desc)),
    ].filter(Boolean))].sort(), [data.enquiries, data.orders]);
  const matSuggestions = useMemo(() =>
    [...new Set([
      ...data.enquiries.flatMap(e => e.items.map(i => i.mat)),
      ...data.orders.flatMap(o => o.items.map(i => i.mat)),
    ].filter(Boolean))].sort(), [data.enquiries, data.orders]);

  const [step, setStep] = useState(1);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const [poNo, setPoNo] = useState('');
  const [poFile, setPoFile] = useState<File | null>(null);
  const [existingPoFileName, setExistingPoFileName] = useState<string | null>(null);
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [dlvDate, setDlvDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
  const [dlvTerms, setDlvTerms] = useState('EXW - Ex Works');
  const [customDlvTerms, setCustomDlvTerms] = useState('');
  const [dlvPriority, setDlvPriority] = useState('Standard');
  const [shipAddr, setShipAddr] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [custName, setCustName] = useState('');
  const [siteId, setSiteId] = useState('');
  const [contactId, setContactId] = useState('');
  const [authName, setAuthName] = useState('');
  const [authDesignation, setAuthDesignation] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [selectedSigId, setSelectedSigId] = useState('');
  const [customTerms, setCustomTerms] = useState('');
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('Processing');
  const [sigMsg, setSigMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [orderId, setOrderId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [unitId, setUnitId] = useState<string>('');
  const [bankAccountId, setBankAccountId] = useState<string>('');
  const [priceBasis, setPriceBasis] = useState<string>('');
  const [eximCode, setEximCode] = useState<string>('');
  const [customPoint, setCustomPoint] = useState<string>('');
  const [pan, setPan] = useState<string>('');
  const [defaultHsn, setDefaultHsn] = useState<string>('');

  // Auto-load default signatory
  useEffect(() => {
    if (editOrderId || quoteRef || authName) return;
    const def = data.signatories.find((s: any) => s.is_default);
    if (def) { setAuthName(def.name); setAuthDesignation(def.designation); setAuthPhone(def.phone); setSelectedSigId(def.id); }
  }, [data.signatories, editOrderId, quoteRef]);

  // Auto-load default unit (when not editing an existing order that already has one)
  useEffect(() => {
    if (unitId || editOrderId) return;
    const def = data.units.find(u => u.is_default) ?? data.units[0];
    if (def) setUnitId(def.id);
  }, [data.units, unitId, editOrderId]);

  // When unit changes, pick that unit's default bank account
  useEffect(() => {
    if (!unitId) { setBankAccountId(''); return; }
    if (bankAccountId && data.bankAccounts.find(b => b.id === bankAccountId)?.unit_id === unitId) return;
    const banks = data.bankAccounts.filter(b => b.unit_id === unitId);
    const def = banks.find(b => b.is_default) ?? banks[0];
    setBankAccountId(def?.id ?? '');
  }, [unitId, data.bankAccounts]);

  // Load / init
  useEffect(() => {
    if (editOrderId) {
      const o = data.orders.find(ord => ord.id === editOrderId);
      if (o) {
        setOrderId(o.id); setPoNo(o.poNo); setPoDate(o.poDate); setDlvDate(o.dlvDate);
        setCustName(o.cust); setAuthName(o.authorizedPerson?.name || '');
        setAuthDesignation(o.authorizedPerson?.designation || ''); setAuthPhone(o.authorizedPerson?.phone || '');
        setOrderStatus(o.status as OrderStatus); setCustomTerms(parseQuoteTerms(o.terms)); setItems(o.items);
        if (o.unitId) setUnitId(o.unitId);
        if (o.bankAccountId) setBankAccountId(o.bankAccountId);
        if (o.priceBasis) setPriceBasis(o.priceBasis);
        if (o.eximCode) setEximCode(o.eximCode);
        if (o.customPoint) setCustomPoint(o.customPoint);
        if (o.pan) setPan(o.pan);
        if (o.hsn) setDefaultHsn(o.hsn);
        if (o.poFileName) setExistingPoFileName(o.poFileName);
        const matched = data.signatories.find((s: AuthorizedSignatory) => s.name === o.authorizedPerson?.name);
        if (matched) setSelectedSigId(matched.id);
      }
    } else if (quoteRef) {
      setOrderId(generateId('ORD', data.orders.map(o => o.id)));
      const q = data.quotes.find(e => e.id === quoteRef);
      if (q) {
        setCustName(q.cust); setAuthName(q.authorizedPerson?.name || '');
        setAuthDesignation(q.authorizedPerson?.designation || ''); setAuthPhone(q.authorizedPerson?.phone || '');
        setCustomTerms(parseQuoteTerms(q.terms));
        setItems(q.items.map(i => ({ ...i, agreedRate: i.unitPrice, remarks: '' })));
      }
    } else {
      setOrderId(generateId('ORD', data.orders.map(o => o.id)));
      setItems([{ seq: 1, desc: '', mat: '', qty: 1, uom: 'pcs', agreedRate: 0, gst: 18, total: 0, remarks: '' }]);
    }
  }, [quoteRef, editOrderId, data.orders, data.quotes]);

  // Cascading customer → site → contact auto-fill
  useEffect(() => {
    if (!custName) return;
    const customer = data.customers.find(c => c.name === custName);
    if (!customer) return;
    if (!editOrderId) {
      setDlvTerms(customer.inco || 'EXW - Ex Works');
      if (!priceBasis) setPriceBasis(customer.inco || '');
    }
    const sites = customer.sites ?? [];
    if (siteId) {
      const site = sites.find((s: any) => s.id === siteId);
      if (site) {
        if (!editOrderId && !quoteRef) setShipAddr(site.address || '');
        const contacts = site.contacts ?? [];
        if (contactId) { const ct = contacts.find((c: any) => c.id === contactId); if (ct) { setContact(ct.name); setEmail(ct.email); } }
        else { const pc = contacts.find((ct: any) => ct.isPrimary) || contacts[0]; if (pc) { setContactId(pc.id); setContact(pc.name); setEmail(pc.email); } }
      }
    } else { const ps = sites.find((s: any) => s.isPrimary) || sites[0]; if (ps) setSiteId(ps.id); }
  }, [custName, siteId, contactId, data.customers, editOrderId, quoteRef]);

  // T&C from delivery terms
  useEffect(() => {
    if (editOrderId) return;
    const sel = dlvTerms === 'OVERRIDE' ? customDlvTerms : dlvTerms;
    let t = '';
    if (sel.includes('EXW')) t = '1. Delivery: Ex-Works, Meerut.\n2. Packing & Forwarding: Extra @ 2%.\n3. Freight: To be paid by the buyer.\n4. Payment: As per agreement.\n5. Taxes: GST 18% extra as applicable.';
    else if (sel.includes('FOB')) t = '1. Delivery: FOB Port of Loading.\n2. Packing & Forwarding: Included.\n3. Freight: Payable by buyer from port.\n4. Payment: As per agreement.';
    else if (sel.includes('DDP') || sel.includes('DAP') || sel.includes('CIF')) t = `1. Delivery: ${sel} Destination.\n2. Insurance & Freight: Included.\n3. Taxes/Duties: As per quotation.\n4. Payment: As per agreement.`;
    if (t && !customTerms) setCustomTerms(t);
  }, [dlvTerms, customDlvTerms, editOrderId]);

  // Item helpers
  const updateItem = (idx: number, field: keyof OrderItem, value: any) => {
    const ni = [...items]; (ni[idx] as any)[field] = value;
    if (field === 'qty' || field === 'agreedRate') ni[idx].total = Number(ni[idx].qty) * Number(ni[idx].agreedRate);
    setItems(ni);
  };
  const addItem = () => setItems([...items, { seq: items.length + 1, desc: '', mat: '', qty: 1, uom: 'pcs', agreedRate: 0, gst: 18, total: 0, remarks: '' }]);
  const removeItem = (idx: number) => { if (items.length === 1) return; setItems(items.filter((_, i) => i !== idx).map((it, i) => ({ ...it, seq: i + 1 }))); };

  const subTotal = items.reduce((s, i) => s + i.total, 0);
  const gstTotal = items.reduce((s, i) => s + i.total * i.gst / 100, 0);
  const grandTotal = subTotal + gstTotal;

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!poNo.trim()) e.poNo = 'PO Number is required';
    if (!custName) e.custName = 'Customer is required';
    if (items.some(i => !i.desc || Number(i.qty) <= 0)) e.items = 'All items need a description and quantity > 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildOrderData = (): Order => ({
    id: orderId, quoteRef: quoteRef || '',
    enqRef: quoteRef ? (data.quotes.find(q => q.id === quoteRef)?.enqRef || '') : '',
    cust: custName, poNo, poDate, dlvDate,
    status: editOrderId ? orderStatus : 'Processing',
    value: grandTotal,
    inco: dlvTerms === 'OVERRIDE' ? customDlvTerms : dlvTerms,
    items, poFileName: existingPoFileName || undefined,
    authorizedPerson: { name: authName, designation: authDesignation, phone: authPhone },
    terms: customTerms,
    unitId: unitId || undefined,
    bankAccountId: bankAccountId || undefined,
    priceBasis: priceBasis || undefined,
    eximCode: eximCode || undefined,
    customPoint: customPoint || undefined,
    pan: pan || undefined,
    hsn: defaultHsn || undefined,
  });

  // Persist the order (with PO upload if any). Returns the orderPayload used,
  // so callers like Generate-PI can pass the same object straight to the PDF.
  const persistOrder = async (): Promise<Order | null> => {
    if (!validateStep1()) { setStep(1); return null; }
    setErrors({});
    let finalPoFileName = poFile ? poFile.name : existingPoFileName || undefined;
    if (poFile) {
      try {
        const safeName = poFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const s3Path = await uploadToS3(poFile, `orders/${orderId}/${safeName}`);
        if (s3Path) finalPoFileName = s3Path;
      } catch { /* use local name */ }
    }
    const orderPayload: Order = { ...buildOrderData(), poFileName: finalPoFileName };
    if (editOrderId) {
      await updateOrder(editOrderId, orderPayload);
    } else {
      await addOrder(orderPayload);
      if (quoteRef) await updateQuote(quoteRef, { status: 'Won' });
      if (!data.customers.find(c => c.name.toLowerCase() === custName.toLowerCase())) {
        await addCustomer({ id: generateId('CUST', data.customers.map(c => c.id)), code: generateId('CUS', data.customers.map(c => c.code)), name: custName, seg: 'General', gstin: '', inco: 'Ex-Works', curr: 'INR', pay: '30 days', sites: [] });
      }
    }
    return orderPayload;
  };

  // Save only: persist + navigate back to /orders. No PDF.
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = await persistOrder();
      if (payload) navigate('/orders');
    } catch (err) {
      setErrors({ global: `Failed to save: ${(err as any)?.message || 'Check connection'}` });
    } finally { setIsSaving(false); }
  };

  // Generate PI: persist (if needed) + download the PDF. Stays on the page
  // so the doer can review and re-tweak before final exit.
  const handleGeneratePI = async () => {
    setIsSaving(true);
    try {
      const payload = await persistOrder();
      if (!payload) return;
      const qt = quoteRef ? data.quotes.find(q => q.id === quoteRef) : undefined;
      const unit = unitId ? data.units.find(u => u.id === unitId) : data.units.find(u => u.is_default);
      const bank = bankAccountId ? data.bankAccounts.find(b => b.id === bankAccountId)
        : data.bankAccounts.find(b => b.unit_id === unit?.id && b.is_default);
      const unitSig = unit?.signatory_id ? data.signatories.find(s => s.id === unit.signatory_id) : undefined;
      const sig = unitSig ?? data.signatories.find((s: any) => s.is_default);
      generatePIPDF(payload, qt, data.customers.find(c => c.name === custName), data.settings, sig, true, unit, bank);
    } catch (err) {
      setErrors({ global: `Failed to generate PI: ${(err as any)?.message || 'Check connection'}` });
    } finally { setIsSaving(false); }
  };

  const goPreview = () => { if (validateStep1()) setStep(2); };

  const Stepper = () => (
    <div className="flex items-center flex-1 px-6">
      {STEPS.map((label, i) => {
        const n = i + 1; const active = step === n; const done = step > n;
        return (
          <React.Fragment key={n}>
            <button type="button" onClick={() => done ? setStep(n) : undefined}
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
  const relatedQuote = quoteRef ? data.quotes.find(q => q.id === quoteRef) : undefined;

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">

      {/* Header */}
      <div className="pt-4 px-5 pb-3 border-b border-g200">
        <div className="flex items-center justify-between gap-4">
          <div className="shrink-0">
            <div className="font-mono text-[9px] font-bold tracking-[3px] uppercase text-red-mrt mb-0.5">Module 03</div>
            <h1 className="font-serif text-[22px] text-blk tracking-tight leading-tight">
              {editOrderId ? 'Edit' : 'Create'} <em className="italic text-red-mrt">Order</em>
            </h1>
          </div>
          <Stepper />
          <div className="flex items-center gap-3 shrink-0">
            {editOrderId && (
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-g500 uppercase tracking-wide">Status</label>
                <select title="Order status" value={orderStatus}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setOrderStatus(e.target.value as OrderStatus)}
                  className="font-mono text-[11px] font-bold border border-g300 rounded-[3px] p-[5px_10px] outline-none focus:border-red-mrt bg-white cursor-pointer">
                  <option value="Processing">Processing</option>
                  <option value="Delivered">Delivered</option>
                </select>
              </div>
            )}
            <Button variant="secondary" onClick={() => navigate('/orders')}>Back</Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pb-6 pt-3 flex-1 overflow-y-auto">

        {/* ══ STEP 1: Form ══ */}
        {step === 1 && (
          <div className="flex flex-col gap-[12px]">

            {quoteRef && !editOrderId && (
              <div className="bg-sW/5 border border-sW/20 rounded-[3px] p-[9px_14px] flex items-center gap-[10px] text-[12px]">
                <span className="text-sW text-[14px]">✓</span>
                <div><strong className="text-sW">Converted from {quoteRef} ({custName})</strong> — Line items loaded.</div>
              </div>
            )}

            {/* Order ID + PO dates row */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="bg-blk p-[9px_16px] rounded-[3px] shrink-0">
                <div className="font-mono text-[8px] font-bold tracking-[2px] uppercase text-white/40 mb-0.5">Order No.</div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[15px] font-bold text-white">{orderId}</span>
                  {quoteRef && <span className="font-mono text-[9px] text-white/40 border-l border-white/10 pl-2">{quoteRef}</span>}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-g500 uppercase tracking-[0.5px] mb-[3px]">PO Number <span className="text-red-mrt">*</span></label>
                <input type="text" value={poNo} placeholder="Customer PO reference"
                  onChange={e => { setPoNo(e.target.value); setErrors({ ...errors, poNo: '' }); }}
                  className={`font-sans text-[13px] text-blk bg-white border ${errors.poNo ? 'border-red-mrt' : 'border-g300 focus:border-red-mrt'} rounded-[3px] p-[7px_10px] outline-none focus:ring-[3px] focus:ring-red-lt w-[180px]`} />
                {errors.poNo && <p className="text-red-mrt text-[10px] mt-1">{errors.poNo}</p>}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-g500 uppercase tracking-[0.5px] mb-[3px]">PO Date</label>
                <input type="date" value={poDate} onChange={e => setPoDate(e.target.value)}
                  className="font-sans text-[13px] text-blk bg-white border border-g300 rounded-[3px] p-[7px_10px] outline-none focus:border-red-mrt" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-red-mrt uppercase tracking-[0.5px] mb-[3px]">Required Delivery By</label>
                <input type="date" value={dlvDate} onChange={e => setDlvDate(e.target.value)}
                  className="font-mono text-[13px] font-bold text-blk bg-white border-2 border-red-mrt/30 rounded-[3px] p-[7px_10px] outline-none focus:border-red-mrt" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-g500 uppercase tracking-[0.5px] mb-[3px]">Priority</label>
                <select title="Priority" value={dlvPriority} onChange={e => setDlvPriority(e.target.value)} className={selectCls + ' w-[160px]'}>
                  <option>Standard</option><option>Priority</option><option>Critical - Expedite</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-g500 uppercase tracking-[0.5px] mb-[3px]">PO Document</label>
                <div className="flex items-center gap-1.5">
                  <input type="file" id="po-upload" className="hidden" onChange={e => { if (e.target.files?.length) setPoFile(e.target.files[0]); }} accept=".pdf,.jpeg,.jpg,.png" />
                  <label htmlFor="po-upload" className="cursor-pointer font-sans text-[11px] font-medium text-blk bg-white border border-g300 rounded-[3px] p-[7px_10px] flex items-center gap-2 hover:bg-g50 transition-colors h-[36px] w-[140px]">
                    <Upload size={13} className="text-g500 shrink-0" />
                    {poFile ? <span className="truncate">{poFile.name}</span> : existingPoFileName ? <span className="truncate">{existingPoFileName}</span> : 'Upload PO'}
                  </label>
                  {(poFile || existingPoFileName) && <button type="button" title="Remove" onClick={() => { setPoFile(null); setExistingPoFileName(null); }} className="text-g400 hover:text-red-mrt text-[16px]">×</button>}
                </div>
              </div>
            </div>

            {/* Customer & Contact + Delivery Terms */}
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
                <div className="font-mono text-[8.5px] font-bold tracking-[2.5px] uppercase text-g600 p-[11px_16px] border-b border-g200">Delivery</div>
                <div className="p-[12px_16px] flex flex-col gap-[10px]">
                  <div>
                    <label className="block text-[10px] font-bold text-g600 tracking-[0.5px] uppercase mb-[4px]">Delivery Terms</label>
                    <select title="Delivery terms" value={dlvTerms} onChange={e => setDlvTerms(e.target.value)} className={selectCls}>
                      <option>EXW - Ex Works</option><option>FOB - Free On Board</option>
                      <option>CIF - Cost, Insurance & Freight</option><option>CIP - Carriage and Insurance Paid To</option>
                      <option>DAP - Delivered At Place</option><option>DDP - Delivered Duty Paid</option>
                      <option>FCA - Free Carrier</option><option>CPT - Carriage Paid To</option>
                      <option value="OVERRIDE">Override...</option>
                    </select>
                    {dlvTerms === 'OVERRIDE' && <input type="text" value={customDlvTerms} placeholder="Specify custom terms..." onChange={e => setCustomDlvTerms(e.target.value)} className="w-full mt-2 font-sans text-[13px] text-blk bg-white border border-g300 rounded-[3px] p-[8px_10px] outline-none focus:border-red-mrt" />}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-g600 tracking-[0.5px] uppercase mb-[4px]">Shipping Address</label>
                    <input type="text" value={shipAddr} onChange={e => setShipAddr(e.target.value)} placeholder="Delivery address"
                      className="w-full font-sans text-[13px] text-blk bg-white border border-g300 rounded-[3px] p-[8px_10px] outline-none focus:border-red-mrt" />
                  </div>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="bg-white border border-g200">
              <div className="p-[11px_16px] border-b border-g200 flex items-center justify-between">
                <span className="font-mono text-[8.5px] font-bold tracking-[2.5px] uppercase text-g500">Order Line Items</span>
                {errors.items && <span className="text-red-mrt text-[11px] font-medium">{errors.items}</span>}
              </div>
              <div className="p-[10px_12px]">
                <datalist id="ord-desc-list">{descSuggestions.map(s => <option key={s} value={s} />)}</datalist>
                <datalist id="ord-mat-list">{matSuggestions.map(s => <option key={s} value={s} />)}</datalist>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-g400 text-[12px]">
                    <thead className="bg-g100">
                      <tr>
                        <th className="font-mono text-[8px] tracking-[1px] uppercase text-g500 px-2 py-1.5 text-left border border-g400 w-8">#</th>
                        <th className="font-mono text-[8px] tracking-[1px] uppercase text-red-mrt px-2 py-1.5 text-left border border-g400 min-w-[200px]">Description *</th>
                        <th className="font-mono text-[8px] tracking-[1px] uppercase text-g500 px-2 py-1.5 text-left border border-g400 w-[110px]">MOC</th>
                        <th className="font-mono text-[8px] tracking-[1px] uppercase text-g500 px-2 py-1.5 text-center border border-g400 w-[78px]" title="Leave blank to use default HSN">HSN</th>
                        <th className="font-mono text-[8px] tracking-[1px] uppercase text-red-mrt px-2 py-1.5 text-center border border-g400 w-14">Qty *</th>
                        <th className="font-mono text-[8px] tracking-[1px] uppercase text-g500 px-2 py-1.5 text-center border border-g400 w-[88px]">UOM</th>
                        <th className="font-mono text-[8px] tracking-[1px] uppercase text-red-mrt px-2 py-1.5 text-right border border-g400 w-32">Agreed Rate *</th>
                        <th className="font-mono text-[8px] tracking-[1px] uppercase text-g500 px-2 py-1.5 text-center border border-g400 w-20">GST %</th>
                        <th className="font-mono text-[8px] tracking-[1px] uppercase text-g500 px-2 py-1.5 text-right border border-g400 w-28">Total</th>
                        <th className="font-mono text-[8px] tracking-[1px] uppercase text-g500 px-2 py-1.5 text-left border border-g400 w-[110px]">Remarks</th>
                        <th className="w-8 border border-g400"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={item.seq} className="hover:bg-g50/50">
                          <td className="px-2 py-[5px] border border-g400 align-middle font-mono font-bold text-g400 text-[11px]">{item.seq}</td>
                          <td className="px-2 py-[5px] border border-g400 align-middle">
                            <input type="text" list="ord-desc-list" value={item.desc}
                              onChange={e => { updateItem(idx, 'desc', e.target.value); setErrors({ ...errors, items: '' }); }}
                              className={`w-full bg-transparent outline-none text-[12px] font-sans placeholder:text-g300 ${errors.items && !item.desc ? 'text-red-mrt' : 'text-blk'}`} />
                          </td>
                          <td className="px-2 py-[5px] border border-g400 align-middle">
                            <input type="text" list="ord-mat-list" value={item.mat} onChange={e => updateItem(idx, 'mat', e.target.value)} className="w-full bg-transparent outline-none text-[12px] font-sans text-blk placeholder:text-g300" />
                          </td>
                          <td className="px-2 py-[5px] border border-g400 align-middle">
                            <input type="text" value={item.hsn || ''} onChange={e => updateItem(idx, 'hsn', e.target.value)} placeholder="default" className="w-full bg-transparent outline-none font-mono text-[11px] text-center text-blk placeholder:text-g300" />
                          </td>
                          <td className="px-2 py-[5px] border border-g400 align-middle text-center">
                            <input type="number" min="1" value={item.qty || ''} onChange={e => { updateItem(idx, 'qty', Number(e.target.value)); setErrors({ ...errors, items: '' }); }}
                              className={`w-full bg-transparent outline-none font-mono text-[12px] text-center placeholder:text-g300 ${errors.items && Number(item.qty) <= 0 ? 'text-red-mrt' : 'text-blk'}`} placeholder="0" />
                          </td>
                          <td className="px-1 py-[3px] border border-g400 align-middle">
                            <input list="ord-uom-list" value={item.uom} onChange={e => updateItem(idx, 'uom', e.target.value)} placeholder="uom" className="w-full bg-g50 border border-g300 rounded-[3px] px-1.5 py-[3px] font-mono text-[11px] text-blk outline-none cursor-pointer focus:border-red-mrt focus:bg-white transition-colors" />
                          </td>
                          <td className="px-2 py-[5px] border border-g400 align-middle">
                            <input type="number" step="any" min="0" value={item.agreedRate || ''} onChange={e => updateItem(idx, 'agreedRate', Number(e.target.value))}
                              className="w-full bg-transparent outline-none font-mono text-[12px] text-right text-blk font-bold placeholder:text-g300" placeholder="0.00" />
                          </td>
                          <td className="px-2 py-[5px] border border-g400 align-middle">
                            <select title="GST rate" value={item.gst} onChange={e => updateItem(idx, 'gst', Number(e.target.value))} className="w-full bg-transparent outline-none text-[12px] text-center font-mono text-blk appearance-none cursor-pointer">
                              <option value={18}>18%</option><option value={12}>12%</option><option value={5}>5%</option><option value={0}>0%</option>
                            </select>
                          </td>
                          <td className="px-2 py-[5px] border border-g400 align-middle text-right font-mono text-[12px] font-bold text-blk">{formatINR(item.total)}</td>
                          <td className="px-2 py-[5px] border border-g400 align-middle">
                            <input type="text" value={item.remarks || ''} onChange={e => updateItem(idx, 'remarks', e.target.value)} className="w-full bg-transparent outline-none text-[12px] font-sans text-blk placeholder:text-g300" placeholder="Note..." />
                          </td>
                          <td className="px-1 py-[5px] border border-g400 align-middle">
                            <button type="button" onClick={() => removeItem(idx)} disabled={items.length === 1} className="text-g400 hover:text-red-mrt p-1 transition-colors disabled:opacity-30" title="Remove">
                              <svg viewBox="0 0 16 16" width="13" height="13" className="fill-current"><path d="M5.5 1h5v1h-5V1zM3 3v1h10V3H3zm1 2v9h8V5H4zm2 1h1v7H6V6zm3 0h1v7H9V6z" /></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="inline-flex items-center gap-[6px] p-[7px_9px] text-red-mrt cursor-pointer text-[12px] font-semibold border border-dashed border-red-mrt/25 rounded-[3px] transition-colors hover:bg-red-lt" onClick={addItem}>
                  <svg viewBox="0 0 16 16" className="w-[13px] h-[13px] stroke-red-mrt fill-none stroke-2"><path d="M8 3v10M3 8h10"/></svg>
                  Add Another Line Item
                </div>
                <div className="mt-3 flex justify-end">
                  <div className="w-[260px] bg-g50/50 border border-g200 rounded-[3px] p-[10px_14px] space-y-1.5 text-[12px]">
                    <div className="flex justify-between text-g500"><span>Sub-Total (excl. GST)</span><span className="font-mono font-bold text-blk">{formatINR(subTotal)}</span></div>
                    <div className="flex justify-between text-g500"><span>Total GST</span><span className="font-mono font-bold text-blk">{formatINR(gstTotal)}</span></div>
                    <div className="flex justify-between font-bold text-blk border-t border-g200 pt-2 text-[13px]"><span>Order Value</span><span className="font-mono text-red-mrt text-[15px]">{formatINR(grandTotal)}</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Export / Tax Details for PI */}
            <div className="bg-white border border-g200">
              <div className="p-[11px_16px] border-b border-g200">
                <span className="font-mono text-[8.5px] font-bold tracking-[2.5px] uppercase text-g600">Export / Tax Details (for Proforma Invoice)</span>
              </div>
              <div className="p-[12px_16px] grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-g500 uppercase tracking-[0.5px] mb-[4px]">Price Basis (Incoterms)</label>
                  <input type="text" value={priceBasis} onChange={e => setPriceBasis(e.target.value)} placeholder="EXW - Ex Works"
                    className="w-full font-sans text-[13px] text-blk border border-g300 rounded-[3px] p-[7px_10px] outline-none focus:border-red-mrt" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-g500 uppercase tracking-[0.5px] mb-[4px]">Exim Code</label>
                  <input type="text" value={eximCode} onChange={e => setEximCode(e.target.value.toUpperCase())} placeholder="IEC0123456789"
                    className="w-full font-mono text-[13px] text-blk border border-g300 rounded-[3px] p-[7px_10px] outline-none focus:border-red-mrt uppercase" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-g500 uppercase tracking-[0.5px] mb-[4px]">Custom Point</label>
                  <input type="text" value={customPoint} onChange={e => setCustomPoint(e.target.value)} placeholder="ICD Tughlakabad, New Delhi"
                    className="w-full font-sans text-[13px] text-blk border border-g300 rounded-[3px] p-[7px_10px] outline-none focus:border-red-mrt" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-g500 uppercase tracking-[0.5px] mb-[4px]">Company PAN No.</label>
                  <input type="text" value={pan} onChange={e => setPan(e.target.value.toUpperCase())} placeholder="ABMFM1195K"
                    className="w-full font-mono text-[13px] text-blk border border-g300 rounded-[3px] p-[7px_10px] outline-none focus:border-red-mrt uppercase" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-g500 uppercase tracking-[0.5px] mb-[4px]">Default HSN Code</label>
                  <input type="text" value={defaultHsn} onChange={e => setDefaultHsn(e.target.value)} placeholder="40169390"
                    className="w-full font-mono text-[13px] text-blk border border-g300 rounded-[3px] p-[7px_10px] outline-none focus:border-red-mrt" />
                  <div className="text-[9px] text-g400 mt-1">Used when an item row has no HSN. Override per-item in the items table.</div>
                </div>
              </div>
            </div>

            {/* Company Unit & Bank Account for PI */}
            <div className="bg-white border border-g200">
              <div className="p-[11px_16px] border-b border-g200 flex items-center justify-between">
                <span className="font-mono text-[8.5px] font-bold tracking-[2.5px] uppercase text-g600">Company Unit & Bank Account (for Proforma Invoice)</span>
                {data.units.length === 0 && (
                  <button type="button" onClick={() => navigate('/settings')} className="text-[9px] font-bold text-red-mrt uppercase hover:underline">Configure in Settings →</button>
                )}
              </div>
              <div className="p-[12px_16px] grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-g500 uppercase tracking-[0.5px] mb-[4px]">Company Unit</label>
                  <select title="Select unit" value={unitId} onChange={e => setUnitId(e.target.value)} className={selectCls} disabled={data.units.length === 0}>
                    <option value="">{data.units.length === 0 ? '— No units configured —' : '— Select unit —'}</option>
                    {data.units.map(u => (
                      <option key={u.id} value={u.id}>{u.name}{u.is_default ? ' (default)' : ''}</option>
                    ))}
                  </select>
                  {unitId && (() => {
                    const u = data.units.find(x => x.id === unitId);
                    return u ? (
                      <div className="text-[10px] text-g400 mt-1.5 font-mono leading-relaxed">
                        {u.gstin && <div>GSTIN: <span className="text-g600 font-semibold">{u.gstin}</span></div>}
                        {u.address && <div className="truncate" title={u.address}>{u.address}</div>}
                      </div>
                    ) : null;
                  })()}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-g500 uppercase tracking-[0.5px] mb-[4px]">Bank Account</label>
                  <select title="Select bank account" value={bankAccountId} onChange={e => setBankAccountId(e.target.value)} className={selectCls} disabled={!unitId}>
                    <option value="">{!unitId ? '— Select unit first —' : '— Select bank account —'}</option>
                    {data.bankAccounts.filter(b => b.unit_id === unitId).map(b => (
                      <option key={b.id} value={b.id}>{b.bank_name} · ****{b.account_no.slice(-4)}{b.is_default ? ' (default)' : ''}</option>
                    ))}
                  </select>
                  {bankAccountId && (() => {
                    const b = data.bankAccounts.find(x => x.id === bankAccountId);
                    return b ? (
                      <div className="text-[10px] text-g400 mt-1.5 font-mono leading-relaxed">
                        <div>A/c: <span className="text-g600 font-semibold">{b.account_no}</span> · IFSC: <span className="text-g600 font-semibold">{b.ifsc}</span></div>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            </div>

            {/* Signatory & T&C */}
            <div className="grid grid-cols-12 gap-[12px]">
              <div className="col-span-8 bg-white border border-g200">
                <div className="p-[11px_16px] border-b border-g200 flex items-center justify-between">
                  <span className="font-mono text-[8.5px] font-bold tracking-[2.5px] uppercase text-red-mrt">Terms & Conditions (Proforma)</span>
                  <button type="button" onClick={() => setCustomTerms('')} className="text-[9px] font-bold text-g400 uppercase hover:text-red-mrt hover:underline">Reset</button>
                </div>
                <div className="p-[12px_16px] space-y-3">
                  <textarea value={customTerms} onChange={e => setCustomTerms(e.target.value)}
                    placeholder="1. Delivery within 3-4 weeks&#10;2. Freight extra at actuals&#10;3. GST 18% extra"
                    className="w-full min-h-[140px] font-sans text-[12.5px] text-blk bg-white border border-g300 rounded-[3px] p-[8px_10px] outline-none focus:border-red-mrt focus:ring-[3px] focus:ring-red-lt resize-none" />

                  {/* Optional additional clauses */}
                  <div>
                    <div className="font-mono text-[8.5px] font-bold tracking-[1.5px] uppercase text-g500 mb-2">Additional Clauses (optional)</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                      {OPTIONAL_TNC_CLAUSES.map(clause => {
                        const checked = customTerms.includes(clause);
                        return (
                          <label key={clause} className="flex items-start gap-2 cursor-pointer text-[11.5px] text-g700 hover:bg-g50 px-1.5 py-1 rounded">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                if (checked) {
                                  // Remove the clause line (any prefix/numbering) then renumber the rest
                                  const lines = customTerms.split(/\r?\n/).filter(l => !l.includes(clause));
                                  setCustomTerms(parseQuoteTerms(lines.join('\n')));
                                } else {
                                  // Append clause and renumber
                                  const next = (customTerms.trim() ? customTerms.trim() + '\n' : '') + clause;
                                  setCustomTerms(parseQuoteTerms(next));
                                }
                              }}
                              className="mt-0.5 accent-red-mrt"
                            />
                            <span>{clause}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-span-4 bg-white border border-g200">
                <div className="p-[11px_16px] border-b border-g200"><span className="font-mono text-[8.5px] font-bold tracking-[2.5px] uppercase text-g600">Authorized Signatory</span></div>
                <div className="p-[12px_16px] flex flex-col gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-g500 uppercase tracking-[0.5px] mb-[4px]">Select from List</label>
                    <select title="Select signatory" value={selectedSigId}
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
            <div className="grid grid-cols-3 gap-[12px]">
              <div className="bg-white border border-g200 rounded-[3px] p-4">
                <div className="font-mono text-[8px] font-bold tracking-[2px] uppercase text-red-mrt pb-2 border-b border-g200 mb-3">Order Info</div>
                <div className="space-y-1.5 text-[12px]">
                  <div className="flex justify-between"><span className="text-g500">Order No.</span><span className="font-mono font-bold text-blk">{orderId}</span></div>
                  <div className="flex justify-between"><span className="text-g500">PO No.</span><span className="font-medium">{poNo}</span></div>
                  <div className="flex justify-between"><span className="text-g500">PO Date</span><span>{poDate}</span></div>
                  <div className="flex justify-between"><span className="text-g500">Delivery By</span><span className="text-red-mrt font-medium">{dlvDate}</span></div>
                  {editOrderId && <div className="flex justify-between"><span className="text-g500">Status</span><span className="font-bold uppercase text-[10px] px-2 py-0.5 bg-g100 rounded">{orderStatus}</span></div>}
                </div>
              </div>
              <div className="bg-white border border-g200 rounded-[3px] p-4">
                <div className="font-mono text-[8px] font-bold tracking-[2px] uppercase text-red-mrt pb-2 border-b border-g200 mb-3">Customer</div>
                <div className="text-[12px] space-y-1">
                  <div className="font-bold text-[14px] text-blk">{custName || '—'}</div>
                  {contact && <div className="text-g500">{contact}</div>}
                  {email && <div className="text-g400 text-[11px] break-all">{email}</div>}
                  {shipAddr && <div className="text-g400 text-[11px] mt-1 border-t border-g100 pt-1">{shipAddr}</div>}
                </div>
              </div>
              <div className="bg-white border border-g200 rounded-[3px] p-4">
                <div className="font-mono text-[8px] font-bold tracking-[2px] uppercase text-red-mrt pb-2 border-b border-g200 mb-3">Delivery</div>
                <div className="text-[12px] space-y-1.5">
                  <div className="flex justify-between"><span className="text-g500">Terms</span><span>{dlvTerms === 'OVERRIDE' ? customDlvTerms : dlvTerms}</span></div>
                  <div className="flex justify-between"><span className="text-g500">Priority</span><span>{dlvPriority}</span></div>
                  {(poFile || existingPoFileName) && <div className="flex justify-between"><span className="text-g500">PO Doc</span><span className="text-green-600 text-[11px]">✓ Attached</span></div>}
                </div>
              </div>
            </div>

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
                      <td className="px-4 py-2 font-mono text-right w-28">{formatINR(item.agreedRate)}</td>
                      <td className="px-4 py-2 font-mono font-bold text-right w-28 text-blk">{formatINR(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end p-4">
                <div className="w-[240px] text-[12px] space-y-1.5">
                  <div className="flex justify-between text-g500"><span>Sub-Total</span><span className="font-mono">{formatINR(subTotal)}</span></div>
                  <div className="flex justify-between text-g500"><span>GST</span><span className="font-mono">{formatINR(gstTotal)}</span></div>
                  <div className="flex justify-between font-bold text-blk border-t border-g200 pt-2 text-[14px]"><span>Order Value</span><span className="font-mono text-red-mrt">{formatINR(grandTotal)}</span></div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-[12px]">
              <div className="bg-white border border-g200 rounded-[3px] p-4">
                <div className="font-mono text-[8px] font-bold tracking-[2px] uppercase text-g500 pb-2 border-b border-g200 mb-3">Authorized Signatory</div>
                {authName ? (
                  <div className="text-[12px] space-y-1"><div className="font-bold text-[14px] text-blk">{authName}</div><div className="text-g500">{authDesignation}</div>{authPhone && <div className="text-g400">{authPhone}</div>}</div>
                ) : <div className="text-[11px] text-g400 italic">No signatory set</div>}
              </div>
              <div className="bg-white border border-g200 rounded-[3px] p-4">
                <div className="font-mono text-[8px] font-bold tracking-[2px] uppercase text-g500 pb-2 border-b border-g200 mb-3">Terms & Conditions</div>
                <div className="text-[11px] text-g500 whitespace-pre-wrap leading-relaxed line-clamp-6">{customTerms || <span className="italic">No terms set</span>}</div>
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
                className="bg-white border border-g300 text-blk font-mono text-[11px] font-bold tracking-widest uppercase px-[20px] py-[10px] rounded-[3px] shadow-sm hover:bg-g50 hover:border-blk disabled:opacity-50 flex items-center gap-2">
                <svg viewBox="0 0 16 16" width="12" height="12" className="fill-current"><path d="M4 2v12h8V6l-4-4H4zm1 1h2v3h2V3h1.172L11 3.828V13H5V3zm2 6v3h2v-3H7z" /></svg>
                {isSaving ? 'Saving...' : (editOrderId ? 'Save Amendments' : 'Save Order')}
              </button>
              <button type="button" onClick={handleGeneratePI} disabled={isSaving}
                className="bg-red-mrt text-white font-mono text-[11px] font-bold tracking-widest uppercase px-[20px] py-[10px] rounded-[3px] shadow-sm hover:bg-red-h hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 flex items-center gap-2">
                <svg viewBox="0 0 16 16" width="12" height="12" className="fill-current"><path d="M14 4h-3V3a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v1H2v2h12V4zM7 3h2v1H7V3zM2 7v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7H2zm3 7H4V8h1v6zm3 0H7V8h1v6zm3 0h-1V8h1v6z"/></svg>
                {isSaving ? 'Working...' : 'Generate PI'}
              </button>
              <button type="button" onClick={() => setShowEmailModal(true)} disabled={isSaving}
                className="bg-blk text-white font-mono text-[11px] font-bold tracking-widest uppercase px-[20px] py-[10px] rounded-[3px] shadow-sm hover:bg-g700 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 flex items-center gap-2">
                <svg viewBox="0 0 16 16" width="12" height="12" className="fill-current"><path d="M2 4h12v8H2zM3 5l5 3.5L13 5v-.5L8 8 3 4.5V5z" /></svg>
                Email to Client
              </button>
              <div className="h-5 w-px bg-g200" />
              <button type="button" onClick={() => navigate('/orders')} disabled={isSaving} className="bg-white border border-g300 text-g600 font-mono text-[10px] font-bold tracking-widest uppercase px-[16px] py-[9px] rounded-[3px] hover:bg-g50 disabled:opacity-50">
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
          mode="order"
          doc={buildOrderData()}
          relatedQuote={relatedQuote}
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