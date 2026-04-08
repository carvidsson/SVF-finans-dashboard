export const DARK = '#1a1a2e';
export const BLUE = '#0f3460';
export const ACCENT = '#e94560';
export const TEAL = '#2b6777';
export const PURPLE = '#533483';

export const COLORS = [
  DARK, '#16213e', BLUE, ACCENT, PURPLE, TEAL,
  '#c44536', '#f0a500', '#5c8a8b', '#8b5cf6', '#06b6d4', '#84cc16',
];

export function fmtNum(v) {
  return v || v === 0 ? Math.round(v).toLocaleString('sv-SE') : '-';
}

export function fmtDate(d) {
  return d && !isNaN(d) ? d.toISOString().slice(0, 10) : '-';
}

export function mkr(v) {
  return (v / 1e6).toFixed(1) + ' Mkr';
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function countBy(arr, field) {
  const m = {};
  arr.forEach((r) => {
    const v = r[field] || 'Okänd';
    m[v] = (m[v] || 0) + 1;
  });
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
}

export function monthsUntil(date, now = new Date()) {
  if (!date || isNaN(date)) return null;
  return (date - now) / (1000 * 60 * 60 * 24 * 30.44);
}

export function getSortableCellValue(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text || text === '-') return -Infinity;
  const medalMap = { '🥇': 1, '🥈': 2, '🥉': 3 };
  if (medalMap[text]) return medalMap[text];
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return new Date(text).getTime();
  const normalized = text
    .replace(/\u00a0/g, ' ')
    .replace(/kr|mån|%/gi, '')
    .replace(/[><]/g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '.');
  if (/^-?\d+(\.\d+)?$/.test(normalized)) return parseFloat(normalized);
  return text;
}
