// RFQ PDF parser — runs entirely in the browser using pdfjs-dist (already in deps).
// No server, no API. Handles 5 real-world formats seen in rubber/gasket industry RFQs.
//
// Strategy waterfall (tried in order, first non-empty result wins):
//   1. camelotStyle  — detects table structure from text position clusters
//   2. numberedList  — "1. ITEM DESC   QTY : 30 NOS"
//   3. sapNative     — SAP line format: item_no + mat_code + desc + qty + uom
//   4. spaceAligned  — free text with whitespace-separated qty + uom far right

import type { LineItem } from './types';

export interface ParseResult {
  items: LineItem[];
  method: string;
  confidence: number;
  warnings: string[];
}

// ── UOM normalisation ─────────────────────────────────────────────────────────
const UOM_SET = new Set([
  'nos','no','ea','each','kg','pcs','pc','set','sets','mtr','m',
  'ltr','l','sht','sheet','roll','pair','pairs','box','boxes',
  'lot','lots','unit','units','length','lengths','rmt','rm',
]);

function normaliseUom(raw: string): string {
  const u = raw.trim().toUpperCase();
  if (UOM_SET.has(u.toLowerCase())) return u;
  // Common OCR/SAP variants
  const map: Record<string,string> = {
    'NOS.':'NOS','NO.':'NOS','PCS.':'PCS','KGS':'KG',
    'MTR':'MTR','MTRS':'MTR','LTRS':'LTR','SHT':'SHT',
  };
  return map[u] ?? u;
}

function cleanNum(s: string): number | null {
  const m = s.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function cleanDesc(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

// ── Extract raw text from PDF using pdfjs ────────────────────────────────────
async function extractText(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Preserve line breaks by grouping items with similar Y positions
    const byY = new Map<number, string[]>();
    for (const item of content.items as any[]) {
      const y = Math.round(item.transform[5]);
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y)!.push(item.str);
    }
    const lines = [...byY.entries()]
      .sort((a, b) => b[0] - a[0])           // top-to-bottom
      .map(([, words]) => words.join(' '));
    pages.push(lines.join('\n'));
  }
  return pages.join('\n');
}

// ── Strategy 1: Table structure from text (camelot-style) ────────────────────
// Looks for a header row containing known column keywords,
// then reads rows that follow it.

const COL_PATTERNS: Record<string, RegExp> = {
  seq:  /^(s\.?no\.?|sr\.?no\.?|item\s*no\.?|line\s*no\.?|sl\.?no\.?|#|no\.)$/i,
  mat:  /^(mat\.?\s*code|material\s*(code|no\.?|number)|item\s*code|part\s*no\.?|sap\s*code|pr\s*no\.?)$/i,
  desc: /^(description|material\s*desc(ription)?|item\s*desc(ription)?|particulars|goods\s*desc(ription)?|name\s*of\s*item)$/i,
  qty:  /^(qty\.?|quantity|req(uired)?\s*qty|order\s*qty)$/i,
  uom:  /^(uom|unit|u\/m|base\s*unit|unit\s*of\s*measure)$/i,
  drwg: /^(dr(a?w(ing)?)?\.?\s*no\.?|dwg\.?\s*no\.?)$/i,
};

function detectHeaderRow(lines: string[]): { rowIdx: number; colMap: Record<string, number> } | null {
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const cells = lines[i].split(/\s{2,}|\t/).map(c => c.trim()).filter(Boolean);
    if (cells.length < 3) continue;
    const colMap: Record<string, number> = {};
    for (let ci = 0; ci < cells.length; ci++) {
      for (const [canon, re] of Object.entries(COL_PATTERNS)) {
        if (re.test(cells[ci]) && !(canon in colMap)) {
          colMap[canon] = ci;
          break;
        }
      }
    }
    if ('desc' in colMap && ('qty' in colMap || 'uom' in colMap)) {
      return { rowIdx: i, colMap };
    }
  }
  return null;
}

function parseTableRows(
  lines: string[],
  startIdx: number,
  colMap: Record<string, number>,
): LineItem[] {
  const items: LineItem[] = [];
  let seq = 1;

  for (let i = startIdx; i < lines.length; i++) {
    const cells = lines[i].split(/\s{2,}|\t/).map(c => c.trim());
    // Pad cells to at least max col index
    const maxIdx = Math.max(...Object.values(colMap));
    while (cells.length <= maxIdx) cells.push('');

    const desc = colMap.desc !== undefined ? cells[colMap.desc] ?? '' : '';
    const qtyRaw = colMap.qty !== undefined ? cells[colMap.qty] ?? '' : '';
    const uomRaw = colMap.uom !== undefined ? cells[colMap.uom] ?? '' : '';
    const mat = colMap.mat !== undefined ? cells[colMap.mat] ?? '' : '';
    const drwg = colMap.drwg !== undefined ? cells[colMap.drwg] ?? '' : '';
    const seqRaw = colMap.seq !== undefined ? cells[colMap.seq] ?? '' : '';

    const qty = cleanNum(qtyRaw);

    // Row continuation: has desc but no qty → append to previous item
    if (desc && qty === null && items.length > 0) {
      items[items.length - 1].desc = cleanDesc(items[items.length - 1].desc + ' ' + desc);
      continue;
    }

    if (!desc || qty === null) continue;

    const seqNum = cleanNum(seqRaw) ?? seq;
    items.push({
      seq: seqNum,
      desc: cleanDesc(desc),
      mat: mat.replace(/^0+/, '').trim(),
      qty,
      uom: normaliseUom(uomRaw || 'NOS'),
      drwg: drwg.trim(),
    });
    seq = seqNum + 1;
  }
  return items;
}

function tryTableStrategy(text: string): LineItem[] | null {
  const lines = text.split('\n').filter(l => l.trim());
  const header = detectHeaderRow(lines);
  if (!header) return null;
  const items = parseTableRows(lines, header.rowIdx + 1, header.colMap);
  return items.length > 0 ? items : null;
}

// ── Strategy 2: Numbered list ─────────────────────────────────────────────────
// Matches:  1. RUBBER O RING SIZE 28.5MM ID X 3.53 MM THICK   QTY : 30 NOS
//           2.. ITEM DESC   30 EA
//           1) ITEM   30 NOS
const NUMBERED_RE = /^(\d{1,3})[.)]\s{1,3}(.+?)\s{2,}(?:QTY\s*[:\-]?\s*)?(\d+(?:\.\d+)?)\s+([A-Z]{1,6})\s*$/im;
const NUMBERED_INLINE_QTY = /^(\d{1,3})[.)]\s{1,3}(.+?)\s+QTY\s*[:\-]?\s*(\d+(?:\.\d+)?)\s+([A-Z]{1,6})/im;

function tryNumberedList(text: string): LineItem[] | null {
  const lines = text.split('\n');
  const items: LineItem[] = [];

  for (const line of lines) {
    let m = NUMBERED_RE.exec(line) || NUMBERED_INLINE_QTY.exec(line);
    if (!m) continue;
    const qty = cleanNum(m[3]);
    if (qty === null) continue;
    items.push({
      seq: parseInt(m[1]),
      desc: cleanDesc(m[2]),
      mat: '',
      qty,
      uom: normaliseUom(m[4]),
      drwg: '',
    });
  }
  return items.length > 0 ? items : null;
}

// ── Strategy 3: SAP native format ────────────────────────────────────────────
// "20   00000000002603008  NEOPRENE RUBBER BUSH 62X30X65  100.000  each"
const SAP_LINE_RE = /^(\d{1,4})\s{1,6}(?:0{4,}\d+)?\s*([A-Z][A-Z0-9 ,.\-/"'()&*]+?)\s{2,}(\d+(?:[.,]\d+)?)\s+(each|ea|nos|no|kg|pcs|pc|set|mtr|m|ltr|sht|rmt|rm)\b/im;

function trySapNative(text: string): LineItem[] | null {
  const lines = text.split('\n');
  const items: LineItem[] = [];
  const seen = new Set<number>();

  for (const line of lines) {
    const m = SAP_LINE_RE.exec(line);
    if (!m) continue;
    const seq = parseInt(m[1]);
    if (seen.has(seq)) continue;
    seen.add(seq);
    // Extract material code if present (long zero-padded number after seq)
    const matMatch = line.match(/^\d{1,4}\s{1,6}(0{4,}\d+)/);
    const mat = matMatch ? matMatch[1].replace(/^0+/, '') : '';
    const qty = parseFloat(m[3].replace(',', '.'));
    items.push({
      seq,
      desc: cleanDesc(m[2]),
      mat,
      qty,
      uom: normaliseUom(m[4]),
      drwg: '',
    });
  }
  return items.length > 0 ? items : null;
}

// ── Strategy 4: Space-aligned free text ──────────────────────────────────────
// "CHANNEL PLATE GSKT,PTHE,NT-50X,KELVION              30        EA"
const SPACE_ALIGNED_RE = /^([A-Z][A-Z0-9 ,.\-/"'()&+*]{5,}?)\s{3,}(\d+(?:\.\d+)?)\s{1,8}([A-Z]{1,6})\s*$/im;

function trySpaceAligned(text: string): LineItem[] | null {
  const lines = text.split('\n');
  const items: LineItem[] = [];

  for (const line of lines) {
    const m = SPACE_ALIGNED_RE.exec(line);
    if (!m) continue;
    const qty = cleanNum(m[2]);
    if (qty === null) continue;
    if (!UOM_SET.has(m[3].toLowerCase())) continue; // must be a real UOM token
    items.push({
      seq: items.length + 1,
      desc: cleanDesc(m[1]),
      mat: '',
      qty,
      uom: normaliseUom(m[3]),
      drwg: '',
    });
  }
  return items.length > 0 ? items : null;
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function parseRfqPdf(file: File): Promise<ParseResult> {
  const warnings: string[] = [];
  let text: string;

  try {
    text = await extractText(file);
  } catch (err: any) {
    throw new Error('Could not read PDF: ' + (err?.message ?? 'unknown error'));
  }

  if (!text.trim()) {
    throw new Error('PDF appears to be a scanned image — text extraction returned nothing. Browser-based parsing requires digitally-generated PDFs.');
  }

  // Strategy waterfall
  const strategies: [string, (t: string) => LineItem[] | null, number][] = [
    ['table_structure',    tryTableStrategy,  0.88],
    ['numbered_list',      tryNumberedList,   0.82],
    ['sap_native',         trySapNative,      0.72],
    ['space_aligned',      trySpaceAligned,   0.70],
  ];

  for (const [method, fn, baseConfidence] of strategies) {
    const items = fn(text);
    if (items && items.length > 0) {
      // Re-sequence to ensure seq is 1-based and continuous
      const resequenced = items.map((it, i) => ({ ...it, seq: i + 1 }));
      return { items: resequenced, method, confidence: baseConfidence, warnings };
    }
  }

  throw new Error(
    'Could not detect item structure in this PDF. ' +
    'Supported formats: grid table, numbered list, SAP native, space-aligned text.'
  );
}
