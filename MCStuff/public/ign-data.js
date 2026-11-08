import { normalizeUuid, validUsername } from './checker-data.js';

export const IGN_LIMIT = 10;

export function parseIgnNames(value, bulk = false) {
  const tokens = bulk ? value.trim().split(/[\s,;]+/).filter(Boolean) : [value.trim()].filter(Boolean);
  const seen = new Set();
  const names = tokens.filter(name => {
    const key = name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  let error = '';
  if (names.length > IGN_LIMIT) error = `Use up to ${IGN_LIMIT} names per check.`;
  else if (names.some(name => !/^[A-Za-z0-9_]+$/.test(name))) error = 'Use only letters, numbers and underscores.';
  else if (names.some(name => !validUsername(name, 3))) error = 'Each name must be 3–16 characters.';
  return { names, error, duplicates: tokens.length - names.length };
}

export function validateIgnResult(data, name) {
  const official = data?.source === 'Mojang' && data.verification === 'official' && typeof data.registered === 'boolean';
  const cached = data?.source === 'PlayerDB' && data.verification === 'cached' && data.registered === true;
  const unconfirmed = data?.source === 'PlayerDB' && data.verification === 'unconfirmed' && data.registered === null;
  if (!(official || cached || unconfirmed) || !validUsername(data.name, 3) || data.name.toLowerCase() !== name.toLowerCase() || !Number.isFinite(Date.parse(data.checkedAt))) return false;
  if (data.registered) return Boolean(normalizeUuid(data.profile?.id) && validUsername(data.profile?.name) && data.profile.name.toLowerCase() === name.toLowerCase() && (!data.cachedAt || Number.isFinite(Date.parse(data.cachedAt))));
  return data.profile === null;
}

export function ignStatus(data) {
  if (data.verification === 'cached') return { label: 'Registered (cached)', tone: 'cached', note: 'Live registration could not be confirmed.' };
  if (data.registered === null) return { label: 'Unconfirmed', tone: 'unknown', note: 'No cached profile. Mojang could not confirm availability.' };
  if (data.registered) return { label: 'Taken', tone: 'taken', note: '' };
  return { label: 'Not registered', tone: 'unregistered', note: 'Mojang may still reserve this name or hold it in a cooldown.' };
}

// Keep the queue small. A rate limit stops new requests; it never means a free name.
export async function runIgnBatch(names, lookup, { signal, onChange = () => {} } = {}) {
  const rows = names.map(name => ({ name, phase: 'queued' }));
  let next = 0;
  let limited = false;
  const publish = () => onChange(rows.map(row => ({ ...row })));
  publish();
  async function worker() {
    while (next < rows.length && !signal?.aborted && !limited) {
      const row = rows[next++];
      row.phase = 'checking';
      publish();
      try {
        const data = await lookup(row.name, signal);
        if (signal?.aborted) { row.phase = 'cancelled'; continue; }
        row.data = data;
        row.phase = 'complete';
      } catch (error) {
        if (signal?.aborted || error.name === 'AbortError') row.phase = 'cancelled';
        else {
          row.phase = 'error';
          row.message = error.message || 'Lookup failed. Try again.';
          if (error.status === 429) limited = true;
        }
      } finally { publish(); }
    }
  }
  await Promise.all([worker(), worker()]);
  for (const row of rows) if (row.phase === 'queued') {
    row.phase = 'cancelled';
    row.message = limited ? 'Skipped after rate limit.' : 'Not checked.';
  }
  publish();
  return rows;
}

export function ignResultsText(rows) {
  return ['Name\tStatus\tSource\tUUID\tCached at\tChecked at', ...rows.map(row => [row.name, row.phase === 'complete' ? ignStatus(row.data).label : row.phase === 'error' ? 'Error' : 'Not checked', row.data?.source || '', row.data?.profile?.id || '', row.data?.cachedAt || '', row.data?.checkedAt || ''].join('\t'))].join('\n');
}
