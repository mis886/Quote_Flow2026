import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatINR = (value: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export const formatUSD = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export const calculateAgeHours = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  return Math.max(0, (now.getTime() - date.getTime()) / 3600000);
};

// Working hours: Mon–Sat 09:00–18:00
export function addWorkingHours(from: Date, hours: number): { date: string; time: string } {
  let d = new Date(from);
  let remaining = hours * 60;
  while (remaining > 0) {
    d = new Date(d.getTime() + 60_000);
    const day = d.getDay();
    const h = d.getHours();
    if (day !== 0 && h >= 9 && h < 18) remaining--;
  }
  return {
    date: d.toISOString().slice(0, 10),
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  };
}

// Convert a Quote's structured terms (JSON string from NewQuote) into
// human-readable numbered lines suitable for an Order's terms textarea.
// If the input isn't JSON, returns it unchanged.
const TNC_LABELS: { key: string; label: string }[] = [
  { key: 'delivery', label: 'Delivery' },
  { key: 'leadTime', label: 'Lead Time' },
  { key: 'pnf',      label: 'Packing & Fwd' },
  { key: 'freight',  label: 'Freight' },
  { key: 'payment',  label: 'Payment' },
  { key: 'validity', label: 'Validity' },
  { key: 'taxes',    label: 'Taxes' },
];

// Strip an existing "1." / "2)" / "- " / "• " prefix so we can renumber cleanly.
function stripLinePrefix(line: string): string {
  return line.replace(/^\s*(?:\d+\s*[.)\]:-]|[-•])\s+/, '').trim();
}

// Take any mix of (a) a JSON terms blob at the start, (b) free-text lines,
// (c) already-numbered lines, and return a clean newline-separated
// numbered list. Always safe to call repeatedly.
export function parseQuoteTerms(raw: string | undefined | null): string {
  if (!raw) return '';
  let body = raw.trim();
  const collectedLines: string[] = [];

  // If the string starts with a JSON object, extract it (find matching brace)
  // and expand it into key/value lines.
  if (body.startsWith('{')) {
    let depth = 0;
    let endIdx = -1;
    for (let i = 0; i < body.length; i++) {
      if (body[i] === '{') depth++;
      else if (body[i] === '}') {
        depth--;
        if (depth === 0) { endIdx = i; break; }
      }
    }
    if (endIdx > 0) {
      const jsonSlice = body.slice(0, endIdx + 1);
      try {
        const parsed = JSON.parse(jsonSlice) as Record<string, string>;
        TNC_LABELS.forEach(({ key, label }) => {
          const value = (parsed[key] || '').trim();
          if (value) collectedLines.push(`${label}: ${value}`);
        });
        body = body.slice(endIdx + 1).trim();
      } catch {
        /* fall through — treat whole thing as text */
      }
    }
  }

  // Append remaining text lines (each gets de-prefixed so renumbering is clean)
  body
    .split(/\r?\n/)
    .map(stripLinePrefix)
    .filter(line => line.length > 0)
    .forEach(line => collectedLines.push(line));

  // Renumber every line as "1. …", "2. …" etc.
  return collectedLines.map((s, i) => `${i + 1}. ${s}`).join('\n');
}

export const generateId = (prefix: string, existingIds: string[]) => {
  const yr = new Date().getFullYear();
  let maxNum = 0;
  for (const id of existingIds) {
    const match = id.match(new RegExp(`${prefix}-\\d+-(\\d+)`));
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return `${prefix}-${yr}-${String(maxNum + 1).padStart(3, '0')}`;
};
