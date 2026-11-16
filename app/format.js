// Small helpers for showing API values. Every string that reaches the page goes through esc().

// Text made safe to put inside HTML.
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// A dollar amount ('607.50', 500 or 0.5) as '$608', '$500' or '$0.50'.
export function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

// A whole number with thousands separators ('9646' -> '9,646').
export function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US') : '—';
}

// A deadline as a date in UTC.
export function date(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

// The time until a deadline: '2d 4h left', '35m left', '42s left', or 'ended'.
export function timeLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'ended';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (minutes > 0) return `${minutes}m ${seconds}s left`;
  return `${seconds}s left`;
}

// True while a bounty still takes entries: the API's status can stay 'open' past the deadline,
// so the deadline is what decides.
export function takesEntries(bounty) {
  if (!bounty) return false;
  if (bounty.acceptingSubmissions === false) return false;
  return new Date(bounty.deadline).getTime() > Date.now();
}

// '1 entry' / '4 entries'.
export function entriesLabel(count) {
  const n = Number(count) || 0;
  return `${num(n)} ${n === 1 ? 'entry' : 'entries'}`;
}

// A short date, '15 Nov 2026'.
export function shortDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
