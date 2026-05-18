import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Customer, Quote, Order, AppSettings, CompanyUnit, BankAccount } from './types';
import { formatINR } from './utils';

export function getQuoteTotals(q: Quote) {
  const sub = q.items.reduce((a, i) => a + i.total, 0);
  const gst = q.items.reduce((a, i) => a + (i.total * i.gst / 100), 0);
  return { sub, gst, grand: sub + gst };
}

export function getOrderTotals(o: Order) {
  const sub = o.items.reduce((a, i) => a + i.total, 0);
  const gst = o.items.reduce((a, i) => a + (i.total * i.gst / 100), 0);
  return { sub, gst, grand: sub + gst };
}

function getCurrencySymbol(curr: string) {
  switch (curr) {
    case 'INR': return 'Rs. ';
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    default: return curr + ' ';
  }
}

function fmtRate(value: number, sym: string): string {
  const s = value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return sym.trimEnd() + ' ' + s.replace('.', '=');
}

function fmtAmount(value: number, sym: string): string {
  const s = value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return sym.trimEnd() + ' ' + s.replace('.', '=');
}

const TRUST_BLUE: [number, number, number] = [10, 100, 188];
const HEAD_BORDER: [number, number, number] = [5, 60, 120];

type SigPerson = { name: string; designation: string; phone?: string };

export function generateQuotePDF(
  quote: Quote,
  customer: Customer | undefined,
  settings: AppSettings | null = null,
  defaultSignatory?: SigPerson,
  download = true,
  unit?: CompanyUnit,
) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pw = 210, ph = 297;
  // Body content matches header image width (header bleeds 10mm beyond original 25.4 margin)
  const mx = 15.4;
  const rx = pw - 15.4;
  const cw = rx - mx;
  const sym = getCurrencySymbol(quote.curr);
  const customHeader = unit?.header_url || settings?.header_url || localStorage.getItem('mrt_header_img');
  const sigImg = unit?.sig_url || settings?.sig_url || localStorage.getItem('mrt_sig_img');

// ── Header ───────────────────────────────────────────────────────────────
  const headerH = 33;
  let y: number;

  if (customHeader) {
    const hFmt = customHeader.startsWith('data:image/png') ? 'PNG' : 'JPEG';
    try { doc.addImage(customHeader, hFmt, mx, 0, cw, headerH); } catch (e) { console.warn('Header image failed', e); }
    y = headerH;
    // GSTIN is already part of the letterhead image — don't stamp it again
  } else {
    doc.setFont('times', 'bold'); doc.setFontSize(13); doc.setTextColor(0, 0, 0);
    doc.text('Mangla Rubber Technologies' + (unit?.name ? ' — ' + unit.name : ''), mx, 12);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(50, 50, 50);
    const addrLines = doc.splitTextToSize(unit?.address || '319, Shivaji Road; Vijay Nagar; Meerut (UP) – 250002; India', 95) as string[];
    addrLines.forEach((line, i) => doc.text(line, rx, 8 + i * 4, { align: 'right' }));
    doc.text('0121 – 2441966, (M) +91 9760024630', rx, 13, { align: 'right' });
    doc.text('E-mail: info@manglarubbers.com', rx, 18, { align: 'right' });
    doc.text('Website: www.manglarubbers.com', rx, 23, { align: 'right' });
    doc.text('GSTIN no.: ' + (unit?.gstin || '09ABMFM1195K1ZP'), rx, 28, { align: 'right' });
    y = headerH;
  }

  // ── Manufacturer tagline ─────────────────────────────────────────────────
  y += 3.5;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(0, 0, 0);
  const mfrText =
    'Manufacturers: High Performance Kalrez, FFKM, EPDM, Viton, HNBR, Silicone, Nitrile, Neoprene, Butyl and Natural Rubber Components for Medium ' +
    'and Heavy Industries | Specialist: Manufacturers of Rubber Gaskets for PHEs and Liners for Butterfly type valves.';
  (doc.splitTextToSize(mfrText, cw) as string[]).forEach((l) => { doc.text(l, mx, y); y += 3.5; });

  // ── Ref | Date ───────────────────────────────────────────────────────────
  y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(30, 30, 30);
  doc.text('Ref: ' + quote.id, mx, y);
  const dateStr = quote.date
    ? new Date(quote.date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : '';
  doc.text(dateStr, rx, y, { align: 'right' });



  // ── QUOTATION heading ────────────────────────────────────────────────────
  y += 9;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0, 0, 0);
  doc.text('QUOTATION', pw / 2, y, { align: 'center' });
  const qw = doc.getTextWidth('QUOTATION');
  doc.setLineWidth(0.4);
  doc.line(pw / 2 - qw / 2, y + 0.8, pw / 2 + qw / 2, y + 0.8);

  // ── K.A. contact ─────────────────────────────────────────────────────────
  const primarySite = (customer?.sites ?? []).find((s) => s.isPrimary) || (customer?.sites ?? [])[0];
  const primaryContact =
    (primarySite?.contacts ?? []).find((c) => c.isPrimary) || (primarySite?.contacts ?? [])[0];
  if (primaryContact?.name) {
    y += 7;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('K.A.: ' + primaryContact.name, pw / 2, y, { align: 'center' });
  }

  // ── Customer address ─────────────────────────────────────────────────────
  y += 8;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(0, 0, 0);
  doc.text(quote.cust + ',', mx, y);

  if (primarySite) {
    const addrParts: string[] = [];
    if (primarySite.fullAddress || primarySite.address)
      addrParts.push(primarySite.fullAddress || primarySite.address || '');
    if (primarySite.city)
      addrParts.push(primarySite.city + (primarySite.state ? ', ' + primarySite.state : ''));
    addrParts.forEach((part) => {
      const lines = doc.splitTextToSize(part, cw - 30) as string[];
      lines.forEach((l) => { y += 5; doc.text(l, mx, y); });
    });
    if (customer?.gstin) { y += 5; doc.text('GSTIN: ' + customer.gstin, mx, y); }
  }

  // ── Customer Reference (their doc no.) ──────────────────────────────────
  if (quote.custEnquiryDocNo) {
    y += 8;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    doc.text('Reference No.: ' + quote.custEnquiryDocNo, mx, y);
  }

  // ── Dear Sir + intro ─────────────────────────────────────────────────────
  y += 8;
  doc.text('Dear Sir,', mx, y);
  y += 6;
  const intro =
    'Thank you for your enquiry, we are pleased to submit our offer for the same as under. ' +
    'We hope this is in line with your requirement and your valued order follows soon.';
  (doc.splitTextToSize(intro, cw) as string[]).forEach((l) => {
    doc.text(l, mx, y);
    y += 5;
  });

  // ── Items table ──────────────────────────────────────────────────────────
  // Columns: S.No.(15) | Quantity(28) | Particulars(flex) | Rates(32) | Per(20)
  const colParticulars = cw - 15 - 28 - 32 - 20; // ~64.2mm
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [['S. No.', 'Quantity', 'Particulars', 'Rates (' + quote.curr + ')', 'Per']],
    body: quote.items.map((i) => [
      i.seq,
      i.qty + ' ' + (i.uom || 'nos.'),
      i.desc + (i.mat ? '-' + i.mat : ''),
      fmtRate(i.unitPrice, sym),
      i.uom || 'Each',
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: TRUST_BLUE,
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 1.5,
      lineColor: HEAD_BORDER,
      lineWidth: 0.5,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 1.5,
      textColor: [30, 30, 30],
      lineColor: [80, 80, 80],
      lineWidth: 0.35,
    },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 28, halign: 'center' },
      2: { cellWidth: colParticulars },
      3: { cellWidth: 32, halign: 'right' },
      4: { cellWidth: 20, halign: 'center'},
    },
    margin: { left: mx, right: mx },
    //alternateRowStyles: { fillColor: [248, 248, 250] },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Terms & Conditions table ─────────────────────────────────────────────
  type TncRow = { label: string; value: string };
  let tncRows: TncRow[];
  try {
    const parsed = JSON.parse(quote.terms || '{}');
    tncRows = [
      { label: 'Delivery point',       value: parsed.delivery || '' },
      { label: 'Lead time',            value: parsed.leadTime || '' },
      { label: 'Packing & forwarding', value: parsed.pnf      || '' },
      { label: 'Freight',              value: parsed.freight  || '' },
      { label: 'Payment',              value: parsed.payment  || '' },
      { label: 'Validity',             value: parsed.validity || '' },
      { label: 'Taxes',                value: parsed.taxes    || '' },
    ].filter((r) => r.value);
  } catch {
    tncRows = (quote.terms || '').split('\n').filter(Boolean).map((line, i) => {
      const stripped = line.replace(/^[•\d]+[.)]\s*/, '');
      const colon = stripped.indexOf(':');
      return colon > 0
        ? { label: stripped.slice(0, colon).trim(), value: stripped.slice(colon + 1).trim() }
        : { label: String(i + 1), value: stripped };
    });
  }

  if (y > ph - 60) { doc.addPage(); y = 20; }

  const tncBody: any[] = [
    [
      {
        content: 'Terms & Conditions:',
        colSpan: 3,
        styles: {
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'left',
          cellPadding: 1.5,
          fillColor: TRUST_BLUE,
          textColor: [0, 0, 0],
          lineColor: HEAD_BORDER,
          lineWidth: 0.5,
        },
      },
    ],
    ...tncRows.map((row, idx) => [
      { content: String(idx + 1), styles: { halign: 'center' } },
      { content: row.label },
      { content: row.value },
    ]),
  ];

  autoTable(doc, {
    startY: y,
    body: tncBody,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 1.5,
      textColor: [30, 30, 30],
      lineColor: [0, 0, 0],
      lineWidth: 0.35,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 55 },
      2: { cellWidth: cw - 12 - 55 },
    },
    margin: { left: mx, right: mx },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Sign-off ─────────────────────────────────────────────────────────────
  if (y > ph - 35) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(0, 0, 0);
  doc.text('Thanks & Kind Regards,', mx, y);
  y += 7;

  if (sigImg) {
    try {
      const fmt = sigImg.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(sigImg, fmt, mx, y, 40, 15);
      y += 17;
    } catch (e) { console.warn('Signature image failed', e); }
  }

  const person: SigPerson = quote.authorizedPerson?.name
    ? quote.authorizedPerson
    : defaultSignatory || { name: 'Akash Gupta', designation: 'Rubber Technologist', phone: '' };

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
  const boldPart = 'Mangla Rubber Technologies';
  doc.text(boldPart, mx, y);
  const boldW = doc.getTextWidth(boldPart);
  doc.setFont('helvetica', 'normal');
  const restPart =
    ' | ' + person.name + ' | ' + person.designation + (person.phone ? ' | Tel.: ' + person.phone : '');
  doc.text(restPart, mx + boldW, y);

  // ── Page number ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(100, 100, 100);
  doc.text('Page 1 of 1', rx, ph - 8, { align: 'right' });

  if (download !== false) doc.save(quote.id + '.pdf');
  return doc;
}

export function generatePIPDF(
  order: Order,
  quote: Quote | undefined,
  customer: Customer | undefined,
  settings: AppSettings | null = null,
  defaultSignatory?: SigPerson,
  download = true,
  unit?: CompanyUnit,
  bankAccount?: BankAccount,
) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pw = 210, ph = 297;
  // Body content matches header image width (header bleeds 10mm beyond original 25.4 margin)
  const mx = 15.4;
  const rx = pw - 15.4;
  const cw = rx - mx;
  const t = getOrderTotals(order);
  const sym = getCurrencySymbol(quote?.curr || 'INR');
  const customHeader = unit?.header_url || settings?.header_url || localStorage.getItem('mrt_header_img');
  const sigImg = unit?.sig_url || settings?.sig_url || localStorage.getItem('mrt_sig_img');

  // ── Header ───────────────────────────────────────────────────────────────
  const headerH = 33;
  let y: number;

  if (customHeader) {
    const hFmt = customHeader.startsWith('data:image/png') ? 'PNG' : 'JPEG';
    try { doc.addImage(customHeader, hFmt, mx, 0, cw, headerH); } catch (e) { console.warn('Header image failed', e); }
    y = headerH;
    // GSTIN is already part of the letterhead image — don't stamp it again
  } else {
    doc.setFont('times', 'bold'); doc.setFontSize(13); doc.setTextColor(0, 0, 0);
    doc.text('Mangla Rubber Technologies' + (unit?.name ? ' — ' + unit.name : ''), mx, 12);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(50, 50, 50);
    const addrLines = doc.splitTextToSize(unit?.address || '319, Shivaji Road; Vijay Nagar; Meerut (UP) – 250002; India', 95) as string[];
    addrLines.forEach((line, i) => doc.text(line, rx, 8 + i * 4, { align: 'right' }));
    doc.text('0121 – 2441966, (M) +91 9760024630', rx, 13, { align: 'right' });
    doc.text('E-mail: info@manglarubbers.com', rx, 18, { align: 'right' });
    doc.text('Website: www.manglarubbers.com', rx, 23, { align: 'right' });
    doc.text('GSTIN no.: ' + (unit?.gstin || '09ABMFM1195K1ZP'), rx, 28, { align: 'right' });
    y = headerH;
  }

  // ── Manufacturer tagline ─────────────────────────────────────────────────
  y += 3.5;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(0, 0, 0);
  const mfrText =
    'Manufacturers: High Performance Kalrez, FFKM, EPDM, Viton, HNBR, Silicone, Nitrile, Neoprene, Butyl and Natural Rubber Components for Medium ' +
    'and Heavy Industries | Specialist: Manufacturers of Rubber Gaskets for PHEs and Liners for Butterfly type valves.';
  (doc.splitTextToSize(mfrText, cw) as string[]).forEach((l) => { doc.text(l, mx, y); y += 3.5; });

  // ── PROFORMA INVOICE heading + details ──────────────────────────────────
  y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(30, 30, 30);
  doc.text('Ref: ' + order.id, mx, y);
  const dateStr = order.poDate
    ? new Date(order.poDate + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : '';
  doc.text(dateStr, rx, y, { align: 'right' });

  y += 9;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0, 0, 0);
  doc.text('PROFORMA INVOICE', pw / 2, y, { align: 'center' });
  const piw = doc.getTextWidth('PROFORMA INVOICE');
  doc.setLineWidth(0.4);
  doc.line(pw / 2 - piw / 2, y + 0.8, pw / 2 + piw / 2, y + 0.8);

  // ── Subject line ─────────────────────────────────────────────────────────
  y += 7;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(30, 30, 30);
  const poDateLong = order.poDate
    ? new Date(order.poDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
  doc.setFont('helvetica', 'bold'); doc.text('Sub: ', mx, y);
  const subLabelW = doc.getTextWidth('Sub: ');
  doc.setFont('helvetica', 'normal');
  const subText = `Performa Invoice against your Order No. ${order.poNo || '—'} dtd. ${poDateLong}`;
  const subLines = doc.splitTextToSize(subText, cw - subLabelW) as string[];
  subLines.forEach((l, i) => {
    doc.text(l, mx + (i === 0 ? subLabelW : 0), y + i * 4.5);
  });
  y += (subLines.length - 1) * 4.5;

  // ── Dear Sir letter ──────────────────────────────────────────────────────
  y += 7;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(30, 30, 30);
  doc.text('Dear Sir,', mx, y);
  y += 5;
  const letterBody = 'We are sending here with our Performa Invoice. You are requested to kindly deposit the payment with our bank account under intimation to us so that we may be able to provide your material.';
  (doc.splitTextToSize(letterBody, cw) as string[]).forEach((l) => {
    doc.text(l, mx, y); y += 4.5;
  });

  // ── Customer + PO details ────────────────────────────────────────────────
  y += 4;
  const primarySite = (customer?.sites ?? []).find((s) => s.isPrimary) || (customer?.sites ?? [])[0];
  const primaryContact = (primarySite?.contacts ?? []).find((c) => c.isPrimary) || (primarySite?.contacts ?? [])[0];

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(0, 0, 0);
  doc.text('Bill To:', mx, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
  y += 5; doc.text(order.cust, mx, y);
  if (primaryContact?.name) { y += 5; doc.text('Attn: ' + primaryContact.name, mx, y); }
  if (primarySite?.city) { y += 5; doc.text(primarySite.city, mx, y); }
  if (customer?.gstin) { y += 5; doc.text('GSTIN: ' + customer.gstin, mx, y); }

  // PO details on right
  let ry = y - 15;
  const piDetails: [string, string][] = [
    ['PO Number', order.poNo || '—'],
    ['PO Date', order.poDate ? new Date(order.poDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'],
    ['Delivery Date', order.dlvDate ? new Date(order.dlvDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'],
    ['Quote Ref', order.quoteRef || '—'],
  ];
  piDetails.forEach(([k, v]) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(100, 100, 100);
    doc.text(k + ':', rx - 60, ry);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30);
    doc.text(v, rx, ry, { align: 'right' });
    ry += 5;
  });

  y = Math.max(y, ry) + 8;

  // ── Items table ──────────────────────────────────────────────────────────
  // Columns: # / Qty / Particulars / HSN / Rate / Amount
  const wSno = 12, wQty = 24, wHsn = 24, wRate = 30, wAmt = 34;
  const wPart = cw - wSno - wQty - wHsn - wRate - wAmt;
  autoTable(doc, {
    startY: y,
    head: [['S. No.', 'Quantity', 'Particulars', 'HSN', 'Rate (' + (quote?.curr || 'INR') + ')', 'Amount']],
    body: order.items.map((i) => [
      i.seq,
      i.qty + ' ' + (i.uom || 'nos.'),
      i.desc + (i.mat ? ' - ' + i.mat : ''),
      i.hsn || order.hsn || '—',
      fmtRate(i.agreedRate, sym),
      fmtAmount(Number(i.qty) * Number(i.agreedRate), sym),
    ]),
    theme: 'grid',
    headStyles: { fillColor: TRUST_BLUE, textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9, cellPadding: 1.5, lineColor: HEAD_BORDER, lineWidth: 0.5, halign: 'center' },
    bodyStyles: { fontSize: 9, cellPadding: 1.5, textColor: [30, 30, 30], lineColor: [80, 80, 80], lineWidth: 0.35 },
    columnStyles: {
      0: { cellWidth: wSno, halign: 'center' },
      1: { cellWidth: wQty, halign: 'center' },
      2: { cellWidth: wPart },
      3: { cellWidth: wHsn, halign: 'center' },
      4: { cellWidth: wRate, halign: 'right' },
      5: { cellWidth: wAmt, halign: 'right' },
    },
    margin: { left: mx, right: mx },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Totals ───────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
  doc.text('Sub-Total (excl. GST)', rx - 55, y); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30);
  doc.text(fmtAmount(t.sub, sym), rx, y, { align: 'right' }); y += 5.5;
  doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
  doc.text('GST Amount', rx - 55, y); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30);
  doc.text(fmtAmount(t.gst, sym), rx, y, { align: 'right' }); y += 2;
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.4); doc.line(rx - 60, y, rx, y); y += 5;
  doc.setFontSize(11); doc.setTextColor(0, 0, 0);
  doc.text('Grand Total', rx - 55, y);
  doc.text(fmtAmount(t.grand, sym), rx, y, { align: 'right' });
  y += 10;

  // ── Banking + Terms side by side ─────────────────────────────────────────
  const halfW = cw / 2 - 4;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
  const headingY = y;
  doc.text('Banking Details:', mx, headingY);
  doc.text('Terms & Conditions:', mx + halfW + 8, headingY);

  // Build list of bank lines from BankAccount, falling back to legacy settings
  type BLine = { label: string; value: string };
  const bankLines: BLine[] = [];
  if (bankAccount) {
    if (bankAccount.beneficiary) bankLines.push({ label: 'Beneficiary', value: bankAccount.beneficiary });
    bankLines.push({ label: 'Bank', value: bankAccount.bank_name });
    if (bankAccount.branch_address) bankLines.push({ label: 'Branch', value: bankAccount.branch_address });
    bankLines.push({ label: 'A/c No.', value: bankAccount.account_no });
    bankLines.push({ label: 'IFSC', value: bankAccount.ifsc });
    if (bankAccount.branch_code) bankLines.push({ label: 'Branch Code', value: bankAccount.branch_code });
    if (bankAccount.micr) bankLines.push({ label: 'MICR', value: bankAccount.micr });
    if (bankAccount.swift) bankLines.push({ label: 'SWIFT', value: bankAccount.swift });
  } else {
    const bName = settings?.bank_name || localStorage.getItem('mrt_bank_name') || 'ICICI BANK LTD.';
    const bAcc  = settings?.bank_acc  || localStorage.getItem('mrt_bank_acc')  || '0000000000';
    const bIfsc = settings?.bank_ifsc || localStorage.getItem('mrt_bank_ifsc') || 'ICIC0000000';
    const bSwift = settings?.bank_swift || localStorage.getItem('mrt_bank_swift') || '';
    bankLines.push({ label: 'Bank', value: bName });
    bankLines.push({ label: 'A/c No.', value: bAcc });
    bankLines.push({ label: 'IFSC', value: bIfsc });
    if (bSwift) bankLines.push({ label: 'SWIFT', value: bSwift });
  }

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(30, 30, 30);
  let yBank = headingY + 5;
  for (const ln of bankLines) {
    const wrapped = doc.splitTextToSize(ln.label + ': ' + ln.value, halfW) as string[];
    for (const part of wrapped) {
      doc.text(part, mx, yBank);
      yBank += 4.5;
    }
  }

  let yTerms = headingY + 5;
  const termsX = mx + halfW + 8;
  if (order.terms) {
    order.terms.split('\n').filter(Boolean).forEach((st) => {
      (doc.splitTextToSize('• ' + st.trim(), halfW) as string[]).forEach((l) => {
        doc.text(l, termsX, yTerms); yTerms += 4.5;
      });
    });
  } else {
    doc.text('• Payment: Balance before dispatch.', termsX, yTerms); yTerms += 4.5;
    doc.text('• Delivery as per schedule.', termsX, yTerms); yTerms += 4.5;
  }

  // Draw a visible bordered rectangle around each side so banking/terms read as a structured box
  const boxTop = headingY - 4;
  const boxBottom = Math.max(yBank, yTerms) + 2;
  doc.setDrawColor(80, 80, 80); doc.setLineWidth(0.35);
  doc.rect(mx - 1, boxTop, halfW + 2, boxBottom - boxTop);
  doc.rect(termsX - 1, boxTop, halfW + 2, boxBottom - boxTop);

  y = Math.max(yBank, yTerms) + 6;

  // ── Sign-off ─────────────────────────────────────────────────────────────
  if (y > ph - 35) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(0, 0, 0);
  doc.text('Thanks & Kind Regards,', mx, y);
  y += 7;

  if (sigImg) {
    try {
      const fmt = sigImg.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(sigImg, fmt, mx, y, 40, 15);
      y += 17;
    } catch (e) { console.warn('Signature image failed', e); }
  }

  const person: SigPerson = order.authorizedPerson?.name
    ? order.authorizedPerson
    : defaultSignatory || { name: 'Akash Gupta', designation: 'Rubber Technologist', phone: '' };

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
  const boldPart = 'Mangla Rubber Technologies';
  doc.text(boldPart, mx, y);
  const boldW = doc.getTextWidth(boldPart);
  doc.setFont('helvetica', 'normal');
  doc.text(' | ' + person.name + ' | ' + person.designation + (person.phone ? ' | Tel.: ' + person.phone : ''), mx + boldW, y);

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(100, 100, 100);
  doc.text('Page 1 of 1', rx, ph - 8, { align: 'right' });

  if (download !== false) doc.save(order.id + '_PI.pdf');
  return doc;
}