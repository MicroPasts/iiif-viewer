function parseTime(value) {
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value);
  const match = /^(\d+):([0-5]\d):([0-5]\d(?:\.\d+)?)$/.exec(value);
  return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : null;
}

export function parseTemporalFragment(value) {
  if (typeof value !== 'string') return null;
  const fragment = value.includes('#') ? value.slice(value.indexOf('#') + 1) : value;
  const parts = fragment.split('&').filter((part) => part.startsWith('t='));
  if (parts.length !== 1) return null;
  const times = parts[0].slice(2).replace(/^npt:/, '').split(',');
  if (times.length > 2 || !times[0] || (times.length === 2 && !times[1])) return null;
  const start = parseTime(times[0]);
  const end = times.length === 2 ? parseTime(times[1]) : null;
  if (start === null || !Number.isFinite(start) || (times.length === 2 && (end === null || !Number.isFinite(end) || end <= start))) return null;
  return { start, end };
}

export function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const remainder = Math.floor(seconds % 60);
  return `${hours ? `${hours}:` : ''}${hours ? String(minutes).padStart(2, '0') : minutes}:${String(remainder).padStart(2, '0')}`;
}
