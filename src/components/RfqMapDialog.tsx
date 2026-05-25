import React, { useState, useMemo } from 'react';
import { X, Check } from 'lucide-react';
import type { LineItem } from '../lib/types';

type FieldKey = 'seq' | 'desc' | 'mat' | 'qty' | 'uom' | 'drwg' | 'ignore';

const FIELD_OPTIONS: { key: FieldKey; label: string; required: boolean; color: string }[] = [
  { key: 'desc',   label: 'Description', required: true,  color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { key: 'qty',    label: 'Qty',         required: true,  color: 'bg-green-100 text-green-700 border-green-300' },
  { key: 'uom',    label: 'UOM',         required: false, color: 'bg-purple-100 text-purple-700 border-purple-300' },
  { key: 'seq',    label: 'S.No',        required: false, color: 'bg-gray-100 text-gray-600 border-gray-300' },
  { key: 'mat',    label: 'Mat Code',    required: false, color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { key: 'drwg',   label: 'Drawing No',  required: false, color: 'bg-pink-100 text-pink-700 border-pink-300' },
  { key: 'ignore', label: 'Ignore',      required: false, color: 'bg-g100 text-g400 border-g200' },
];

const UOM_SET = new Set([
  'nos','no','ea','each','kg','pcs','pc','set','sets','mtr','m',
  'ltr','l','sht','sheet','roll','pair','nos.','no.','pcs.',
]);

function guessField(header: string): FieldKey {
  const h = header.toLowerCase().trim();
  if (/s\.?no|sr\.?no|item\s*no|line\s*no|sl\.?no|^#$|^no\.$/.test(h)) return 'seq';
  if (/desc|particular|goods|detail|product|item\s*desc/.test(h)) return 'desc';
  if (/mat.*code|item\s*code|part\s*no|sap\s*code|material\s*no/.test(h)) return 'mat';
  if (/^qty|quantity|req.*qty|order.*qty/.test(h)) return 'qty';
  if (/^uom|^unit$|u\/m|base\s*unit/.test(h)) return 'uom';
  if (/draw|drwg|dwg/.test(h)) return 'drwg';
  if (/hsn|price|rate|amount|make|brand|remark/.test(h)) return 'ignore';
  return 'ignore';
}

function cleanNum(s: string): number | null {
  const m = s.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function normaliseUom(raw: string): string {
  const u = raw.trim().toUpperCase();
  const map: Record<string, string> = { 'NOS.': 'NOS', 'NO.': 'NOS', 'PCS.': 'PCS', 'KGS': 'KG' };
  return map[u] ?? u;
}

interface Props {
  headers: string[];
  rows: string[][];
  onApply: (items: LineItem[]) => void;
  onClose: () => void;
}

export function RfqMapDialog({ headers, rows, onApply, onClose }: Props) {
  // col index → field assignment
  const [mapping, setMapping] = useState<Record<number, FieldKey>>(() => {
    const m: Record<number, FieldKey> = {};
    // Single-column (free-text lines) — pre-assign whole line as desc
    if (headers.length === 1) { m[0] = 'desc'; return m; }
    headers.forEach((h, i) => { m[i] = guessField(h); });
    return m;
  });

  const isSingleCol = headers.length === 1;

  // Validate: desc + qty must be mapped (unless single-col where qty is inferred)
  const hasDesc = Object.values(mapping).includes('desc');
  const hasQty  = isSingleCol || Object.values(mapping).includes('qty');
  const canApply = hasDesc && hasQty;

  // Returns all column indices (sorted ascending) assigned to a given key
  const colsOf = (key: FieldKey): number[] =>
    Object.entries(mapping)
      .filter(([, v]) => v === key)
      .map(([k]) => +k)
      .sort((a, b) => a - b);

  // Preview first 5 rows mapped to LineItems
  const preview = useMemo<LineItem[]>(() => {
    const descCols = colsOf('desc');
    const qtyCols  = colsOf('qty');
    const uomCols  = colsOf('uom');
    const matCols  = colsOf('mat');
    const seqCols  = colsOf('seq');
    const drwgCols = colsOf('drwg');

    return rows.slice(0, 5).flatMap((row, ri) => {
      let desc = descCols.map(ci => (row[ci] ?? '').trim()).filter(Boolean).join(' ');
      let qty: number | null = null;
      let uom = 'NOS';

      if (isSingleCol) {
        const line = row[0] ?? '';
        const m = line.match(/(\d+(?:\.\d+)?)\s*(nos?|pcs?|ea|each|kg|mtr?s?|m|no|sets?)\s*$/i);
        if (m) {
          qty = parseFloat(m[1]);
          uom = normaliseUom(m[2]);
          desc = line.slice(0, line.lastIndexOf(m[0])).trim();
        } else {
          return [];
        }
      } else {
        const qtyRaw = qtyCols.map(ci => (row[ci] ?? '').trim()).filter(Boolean).join(' ');
        const uomRaw = uomCols.map(ci => (row[ci] ?? '').trim()).filter(Boolean).join(' ');
        qty = cleanNum(qtyRaw);
        uom = uomRaw ? normaliseUom(uomRaw) : 'NOS';
      }

      if (!desc || qty === null) return [];

      const seqRaw  = seqCols.map(ci => (row[ci] ?? '').trim()).filter(Boolean).join(' ');
      const matRaw  = matCols.map(ci => (row[ci] ?? '').trim()).filter(Boolean).join(' ');
      const drwgRaw = drwgCols.map(ci => (row[ci] ?? '').trim()).filter(Boolean).join(' ');

      return [{
        seq:  cleanNum(seqRaw) ?? ri + 1,
        desc: desc.replace(/\s+/g, ' '),
        mat:  matRaw.replace(/^0+/, '').trim(),
        qty,
        uom,
        drwg: drwgRaw.replace(/^[-–]$/, '').trim(),
      }] as LineItem[];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapping, rows, isSingleCol]);

  const handleApply = () => {
    const items: LineItem[] = [];
    rows.forEach((_row, ri) => {
      const row = _row;
      let desc = colsOf('desc').map(ci => (row[ci] ?? '').trim()).filter(Boolean).join(' ');
      let qty: number | null = null;
      let uom = 'NOS';

      if (isSingleCol) {
        const line = row[0] ?? '';
        const m = line.match(/(\d+(?:\.\d+)?)\s*(nos?|pcs?|ea|each|kg|mtr?s?|m|no|sets?)\s*$/i);
        if (m) {
          qty = parseFloat(m[1]);
          uom = normaliseUom(m[2]);
          desc = line.slice(0, line.lastIndexOf(m[0])).trim();
        }
      } else {
        const qtyRaw  = colsOf('qty').map(ci => (row[ci] ?? '').trim()).filter(Boolean).join(' ');
        const uomRaw  = colsOf('uom').map(ci => (row[ci] ?? '').trim()).filter(Boolean).join(' ');
        qty = cleanNum(qtyRaw);
        uom = uomRaw ? normaliseUom(uomRaw) : 'NOS';
      }

      if (!desc || qty === null) return;

      const seqRaw  = colsOf('seq').map(ci => (row[ci] ?? '').trim()).filter(Boolean).join(' ');
      const matRaw  = colsOf('mat').map(ci => (row[ci] ?? '').trim()).filter(Boolean).join(' ');
      const drwgRaw = colsOf('drwg').map(ci => (row[ci] ?? '').trim()).filter(Boolean).join(' ');

      items.push({
        seq:  cleanNum(seqRaw) ?? items.length + 1,
        desc: desc.replace(/\s+/g, ' '),
        mat:  matRaw.replace(/^0+/, '').trim(),
        qty,
        uom,
        drwg: drwgRaw.replace(/^[-–]$/, '').trim(),
      });
    });

    onApply(items.map((it, i) => ({ ...it, seq: i + 1 })));
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-[4px] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-g200">

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-g200 flex items-center justify-between shrink-0">
          <div>
            <div className="font-mono text-[8px] font-bold tracking-[2px] uppercase text-amber-600 mb-0.5">Beta — Manual Column Mapping</div>
            <div className="text-[14px] font-semibold text-blk">Map PDF Columns to Item Fields</div>
          </div>
          <button type="button" title="Close" onClick={onClose} className="p-1.5 text-g400 hover:text-blk bg-g100 hover:bg-g200 rounded transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Column assignment */}
          {!isSingleCol && (
            <div>
              <div className="text-[10px] font-bold text-g500 uppercase tracking-wider mb-3">
                Assign each column to a field — <span className="text-red-mrt">Description</span> and <span className="text-green-700">Qty</span> are required
              </div>
              <div className="flex flex-wrap gap-2">
                {headers.map((h, ci) => (
                  <div key={ci} className="flex flex-col gap-1 min-w-[100px]">
                    <div className="text-[9px] font-mono text-g500 truncate max-w-[120px]" title={h}>{h || `Col ${ci + 1}`}</div>
                    <select
                      value={mapping[ci] ?? 'ignore'}
                      onChange={e => setMapping(prev => ({ ...prev, [ci]: e.target.value as FieldKey }))}
                      title={`Map column: ${h || `Col ${ci + 1}`}`}
                      className={`text-[11px] font-semibold border rounded-[3px] px-2 py-1 outline-none cursor-pointer ${
                        FIELD_OPTIONS.find(f => f.key === (mapping[ci] ?? 'ignore'))?.color ?? 'bg-g100 text-g500'
                      }`}
                    >
                      {FIELD_OPTIONS.map(f => (
                        <option key={f.key} value={f.key}>{f.label}</option>
                      ))}
                    </select>
                    {/* Sample value from first data row */}
                    {rows[0]?.[ci] && (
                      <div className="text-[9px] text-g400 truncate max-w-[120px]" title={rows[0][ci]}>{rows[0][ci]}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isSingleCol && (
            <div className="bg-amber-50 border border-amber-200 rounded-[3px] px-4 py-3 text-[11px] text-amber-800">
              Free-text format detected — qty and UOM will be extracted from the end of each line automatically.
            </div>
          )}

          {/* Raw data preview */}
          <div>
            <div className="text-[10px] font-bold text-g500 uppercase tracking-wider mb-2">Raw Data (first 10 rows)</div>
            <div className="overflow-x-auto border border-g200 rounded-[3px]">
              <table className="w-full text-left">
                <thead className="bg-g50 border-b border-g200">
                  <tr>
                    {headers.map((h, ci) => (
                      <th key={ci} className="px-3 py-2 text-[9px] font-bold uppercase text-g400 tracking-wider whitespace-nowrap">
                        <div>{h || `Col ${ci + 1}`}</div>
                        {!isSingleCol && (
                          <div className={`mt-1 inline-block px-1.5 py-0.5 rounded text-[8px] font-bold border ${
                            FIELD_OPTIONS.find(f => f.key === (mapping[ci] ?? 'ignore'))?.color ?? ''
                          }`}>
                            {FIELD_OPTIONS.find(f => f.key === (mapping[ci] ?? 'ignore'))?.label}
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-g100">
                  {rows.slice(0, 10).map((row, ri) => (
                    <tr key={ri} className="hover:bg-g50">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3 py-2 text-[11px] text-blk max-w-[200px] truncate" title={cell}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mapped preview */}
          {preview.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-g500 uppercase tracking-wider mb-2">
                Preview — {preview.length} item{preview.length !== 1 ? 's' : ''} from first 5 rows
              </div>
              <div className="border border-g200 rounded-[3px] divide-y divide-g100">
                {preview.map((it, i) => (
                  <div key={i} className="px-3 py-2 flex items-start gap-3 text-[11px]">
                    <span className="font-mono text-g400 shrink-0 w-5">{it.seq}.</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-blk">{it.desc}</span>
                      {it.mat && <span className="ml-2 text-g400 font-mono text-[9px]">[{it.mat}]</span>}
                    </div>
                    <span className="shrink-0 font-mono text-g600">{it.qty} {it.uom}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!canApply && (
            <p className="text-[10.5px] text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {!hasDesc ? 'Assign at least one column as Description. ' : ''}
              {!hasQty && !isSingleCol ? 'Assign at least one column as Qty.' : ''}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-g200 flex items-center justify-between shrink-0 bg-g50">
          <span className="text-[10px] text-g400">{rows.length} rows in document</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-g300 text-[11px] text-g600 font-semibold rounded-[3px] hover:bg-g100 transition-colors">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!canApply}
              className="px-4 py-2 bg-blk text-white text-[11px] font-bold rounded-[3px] hover:bg-g700 disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              <Check size={12} strokeWidth={3} /> Apply {preview.length > 0 ? `(${rows.filter(r => r.some(c => c.trim())).length} items)` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
