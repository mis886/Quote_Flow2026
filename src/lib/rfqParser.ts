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

// Lines that signal end of item table — stop parsing when matched
const STOP_RE = /^\s*(terms\s*(and|&)\s*conditions?|general\s*terms|special\s*terms|notes?\s*:|note\s*:|remarks?\s*:|payment\s*terms?|delivery\s*terms?|warranty|guarantee|validity|commercial\s*terms?|kindly\s*(send|quote|submit)|please\s*(send|quote|submit|note|confirm|mention)|thanking\s*you|yours?\s*(faithfully|truly|sincerely)|regards|with\s*regards|for\s*and\s*on\s*behalf|authoris[e|z]d\s*signatory|signature|total\s*amount|grand\s*total|sub[\s-]?total|gst\s*amount|tax\s*amount|amount\s*in\s*words|rupees|end\s*of\s*(order|enquiry|rfq)|page\s*\d+\s*of\s*\d+)\b/i;

// ── Text item with position ───────────────────────────────────────────────────
interface TextItem {
  str: string;
  x: number;   // left edge
  y: number;   // baseline (higher = higher on page in PDF coords)
  w: number;   // width
}

// ── Extract positioned text items from all pages ──────────────────────────────
async function extractItems(file: File): Promise<TextItem[]> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allItems: TextItem[] = [];
  let yOffset = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    for (const item of content.items as any[]) {
      if (!item.str?.trim()) continue;
      allItems.push({
        str: item.str,
        x: Math.round(item.transform[4]),
        // Flip Y: pdfjs Y=0 is bottom; we want Y=0 at top, increasing downward
        y: Math.round(yOffset + (vp.height - item.transform[5])),
        w: Math.round(item.width ?? 0),
      });
    }
    yOffset += vp.height + 20; // gap between pages
  }
  return allItems;
}

// ── Group items into lines by Y proximity ─────────────────────────────────────
function groupIntoLines(items: TextItem[], yTolerance = 4): TextItem[][] {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: TextItem[][] = [];
  let currentLine: TextItem[] = [sorted[0]];
  let lineY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - lineY) <= yTolerance) {
      currentLine.push(sorted[i]);
    } else {
      lines.push(currentLine.sort((a, b) => a.x - b.x));
      currentLine = [sorted[i]];
      lineY = sorted[i].y;
    }
  }
  lines.push(currentLine.sort((a, b) => a.x - b.x));
  return lines;
}

// ── Reconstruct plain text (for regex strategies) ────────────────────────────
function linesToPlainText(lines: TextItem[][]): string {
  return lines
    .map(line => line.map(it => it.str).join(' '))
    .join('\n');
}

// ── Detect column X boundaries from a header line ─────────────────────────────
// Each header cell gives us a column's approximate X range.
interface ColBoundary { canon: string; xMin: number; xMax: number }

const COL_PATTERNS: Record<string, RegExp> = {
  seq:  /^(s\.?no\.?|sr\.?no\.?|item\s*no\.?|line\s*no\.?|sl\.?no\.?|#|no\.)$/i,
  mat:  /^(mat\.?\s*code|material\s*(code|no\.?|number)|item\s*code|part\s*no\.?|sap\s*code|pr\s*no\.?|mat\.\s*code)$/i,
  hsn:  /^(hsn\s*(code)?|hsn\/sac)$/i,
  desc: /^(description|material\s*desc(ription)?|item\s*desc(ription)?|particulars|goods\s*desc(ription)?|name\s*of\s*item)$/i,
  make: /^(make|brand|manufacturer)$/i,
  qty:  /^(qty\.?|quantity|req(uired)?\s*qty|order\s*qty)$/i,
  uom:  /^(uom|unit|u\/m|base\s*unit|unit\s*of\s*measure)$/i,
  drwg: /^(dr(a?w(ing)?)?\.?\s*no\.?|dwg\.?\s*no\.?)$/i,
};

function detectXColumns(headerLine: TextItem[]): ColBoundary[] | null {
  const cols: ColBoundary[] = [];
  // Sometimes header spans 2 lines (MAT. / CODE on separate rows) — we work per-item
  for (const item of headerLine) {
    const text = item.str.trim();
    for (const [canon, re] of Object.entries(COL_PATTERNS)) {
      if (re.test(text) && !cols.find(c => c.canon === canon)) {
        cols.push({ canon, xMin: item.x - 4, xMax: item.x + Math.max(item.w, 30) + 4 });
        break;
      }
    }
  }
  return cols.length >= 3 ? cols : null;
}

// Assign a text item to the best matching column boundary by X overlap
function assignToCol(item: TextItem, cols: ColBoundary[]): string | null {
  const xMid = item.x + item.w / 2;
  // First try mid-point containment
  for (const col of cols) {
    if (xMid >= col.xMin && xMid <= col.xMax) return col.canon;
  }
  // Fallback: nearest column
  let best: ColBoundary | null = null;
  let bestDist = Infinity;
  for (const col of cols) {
    const colMid = (col.xMin + col.xMax) / 2;
    const dist = Math.abs(xMid - colMid);
    if (dist < bestDist) { bestDist = dist; best = col; }
  }
  return bestDist < 60 ? best!.canon : null;
}

// ── X-position aware table parser ─────────────────────────────────────────────
function tryXColumnTable(lines: TextItem[][]): LineItem[] | null {
  // Find header line(s) — look in first 30 lines
  let headerLineIdx = -1;
  let cols: ColBoundary[] | null = null;

  // Sometimes "MAT." and "CODE" are on separate Y lines — merge nearby lines for header detection
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    // Try merging this line + next line (for 2-row headers)
    const combined = i + 1 < lines.length ? [...lines[i], ...lines[i + 1]] : lines[i];
    cols = detectXColumns(combined);
    if (cols && cols.find(c => c.canon === 'desc') && cols.find(c => c.canon === 'qty' || c.canon === 'uom')) {
      headerLineIdx = i;
      // If 2-row header detected, skip both rows
      if (i + 1 < lines.length) {
        const nextCols = detectXColumns(lines[i + 1]);
        if (nextCols && nextCols.length > 0) headerLineIdx = i + 1;
      }
      break;
    }
  }

  if (headerLineIdx < 0 || !cols) return null;

  // Widen column boundaries: give desc column full width to next column
  cols.sort((a, b) => a.xMin - b.xMin);
  for (let i = 0; i < cols.length - 1; i++) {
    cols[i].xMax = cols[i + 1].xMin - 1;
  }
  cols[cols.length - 1].xMax = 9999;

  const items: LineItem[] = [];
  let seq = 1;

  // Group subsequent lines into logical rows: a new row starts when seq/mat column has a value
  const seqCol = cols.find(c => c.canon === 'seq');
  const dataLines = lines.slice(headerLineIdx + 1);

  // Accumulate cells per logical row
  type RowCells = Record<string, string[]>;
  const rows: RowCells[] = [];
  let currentRow: RowCells = {};

  for (const line of dataLines) {
    const lineText = line.map(it => it.str).join(' ');
    if (STOP_RE.test(lineText)) break;
    // Check if this line starts a new data row: has a value in seq column OR mat column
    const seqItems = seqCol ? line.filter(it => {
      const xMid = it.x + it.w / 2;
      return xMid >= seqCol.xMin && xMid <= seqCol.xMax;
    }) : [];
    const hasSeq = seqItems.some(it => /^\d+$/.test(it.str.trim()));
    const matCol = cols.find(c => c.canon === 'mat');
    const matItems = matCol ? line.filter(it => {
      const xMid = it.x + it.w / 2;
      return xMid >= matCol.xMin && xMid <= matCol.xMax;
    }) : [];
    const hasMat = matItems.some(it => /^\d{4,}$/.test(it.str.trim()));

    if ((hasSeq || hasMat) && Object.keys(currentRow).length > 0) {
      rows.push(currentRow);
      currentRow = {};
    }

    // Assign each item in this line to a column
    for (const item of line) {
      const canon = assignToCol(item, cols);
      if (!canon) continue;
      if (!currentRow[canon]) currentRow[canon] = [];
      currentRow[canon].push(item.str.trim());
    }
  }
  if (Object.keys(currentRow).length > 0) rows.push(currentRow);

  for (const row of rows) {
    const desc = (row.desc ?? []).join(' ').trim();
    const qtyRaw = (row.qty ?? []).join(' ').trim();
    const uomRaw = (row.uom ?? []).join(' ').trim();
    const mat = (row.mat ?? []).join(' ').replace(/^0+/, '').trim();
    const drwg = (row.drwg ?? []).join(' ').trim();
    const seqRaw = (row.seq ?? []).join(' ').trim();

    if (!desc) continue;
    const qty = cleanNum(qtyRaw);
    if (qty === null) continue;

    const seqNum = cleanNum(seqRaw) ?? seq;
    items.push({
      seq: seqNum,
      desc: cleanDesc(desc),
      mat,
      qty,
      uom: normaliseUom(uomRaw || 'NOS'),
      drwg: drwg.replace(/^[-–]$/, '').trim(),
    });
    seq = seqNum + 1;
  }

  return items.length > 0 ? items : null;
}

// ── Kept for regex strategies ─────────────────────────────────────────────────
async function extractText(file: File): Promise<{ plain: string; lines: TextItem[][] }> {
  const items = await extractItems(file);
  const lines = groupIntoLines(items);
  return { plain: linesToPlainText(lines), lines };
}

// ── Strategy 1b: Text-based table (fallback when X-column fails) ─────────────
// Splits lines on 2+ spaces and matches header keywords using shared COL_PATTERNS.

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
    if (STOP_RE.test(lines[i])) break;
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
    if (STOP_RE.test(line)) break;
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
    if (STOP_RE.test(line)) break;
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
    if (STOP_RE.test(line)) break;
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
  let plain: string;
  let posLines: TextItem[][];

  try {
    const extracted = await extractText(file);
    plain = extracted.plain;
    posLines = extracted.lines;
  } catch (err: any) {
    throw new Error('Could not read PDF: ' + (err?.message ?? 'unknown error'));
  }

  if (!plain.trim()) {
    throw new Error('PDF appears to be a scanned image — text extraction returned nothing. Browser-based parsing requires digitally-generated PDFs.');
  }

  // 1. X-position aware table parser (handles wrapped cells, multi-row headers)
  const xItems = tryXColumnTable(posLines);
  if (xItems && xItems.length > 0) {
    return { items: xItems.map((it, i) => ({ ...it, seq: i + 1 })), method: 'x_column_table', confidence: 0.92, warnings };
  }

  // 2-5. Text / regex strategies on plain text
  const textStrategies: [string, (t: string) => LineItem[] | null, number][] = [
    ['table_structure', tryTableStrategy, 0.85],
    ['numbered_list',   tryNumberedList,  0.82],
    ['sap_native',      trySapNative,     0.72],
    ['space_aligned',   trySpaceAligned,  0.70],
  ];

  for (const [method, fn, baseConfidence] of textStrategies) {
    const items = fn(plain);
    if (items && items.length > 0) {
      return { items: items.map((it, i) => ({ ...it, seq: i + 1 })), method, confidence: baseConfidence, warnings };
    }
  }

  throw new Error(
    'Could not detect item structure in this PDF. ' +
    'Supported formats: grid table, numbered list, SAP native, space-aligned text.'
  );
}
