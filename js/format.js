// Duration formatting, clock display, dates, ids. PLAN.md §1.1, §8.

export const MINUS = '−'; // U+2212, matches the design's glyph

export const DIVISOR = { schoolwork: 4, personal: 6 };

export function creditSecFor(category, workedSec) {
  return Math.round(workedSec / DIVISOR[category]);
}

// Signed floor to whole minutes. Positive rounds down (never claim time you
// don't have); negative rounds away from zero (never understate a debt).
// 9000 -> "2H 30M", 450 -> "7M", -330 -> "-6M", 0 -> "0M"
export function fmtHM(sec) {
  const m = Math.floor(sec / 60);
  const a = Math.abs(m);
  const body = a >= 60
    ? `${Math.floor(a / 60)}H ${String(a % 60).padStart(2, '0')}M`
    : `${a}M`;
  return (m < 0 ? MINUS : '') + body;
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// Same signed-floor rule as fmtHM, but spelled out — for the one spot
// (Home's hero balance) with room to say "Minutes" instead of "M".
// 9000 -> "2 Hours 30 Minutes", 60 -> "1 Minute", -330 -> "-6 Minutes"
export function fmtLongMinutes(sec) {
  const m = Math.floor(sec / 60);
  const a = Math.abs(m);
  const h = Math.floor(a / 60);
  const mm = a % 60;
  let body;
  if (h > 0 && mm > 0) body = `${plural(h, 'Hour')} ${plural(mm, 'Minute')}`;
  else if (h > 0) body = plural(h, 'Hour');
  else body = plural(mm, 'Minute');
  return (m < 0 ? MINUS : '') + body;
}

// HH:MM:SS clock, always non-negative.
export function clock(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor(sec / 60) % 60;
  const s = sec % 60;
  const p = n => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)}`;
}

// HH:MM from a minute count (manual entry readout).
export function hhmm(min) {
  min = Math.max(0, Math.floor(min));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function timeLabel(ts) {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

const DOW = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const MON = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

export function startOfDayMs(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function isSameDay(a, b) {
  return startOfDayMs(a) === startOfDayMs(b);
}

export function dayLabel(ts) {
  const now = Date.now();
  const dayMs = 86400000;
  const diff = Math.round((startOfDayMs(now) - startOfDayMs(ts)) / dayMs);
  if (diff === 0) return 'TODAY';
  if (diff === 1) return 'YESTERDAY';
  const d = new Date(ts);
  return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
