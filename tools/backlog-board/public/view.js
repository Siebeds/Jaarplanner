// Filtering and sorting of the tickets the server sends. Pure functions, no DOM, so the tests can
// import them; app.js only draws what these return.

export const PRIORITIES = ['hoog', 'middel', 'laag'];

export const CREATED = {
  alles: 'Alles',
  vandaag: 'Vandaag',
  week: 'Deze week',
  '7': 'Laatste 7 dagen',
  '30': 'Laatste 30 dagen',
};

export const SORTS = {
  standaard: 'Standaard',
  prioriteit: 'Prioriteit',
  nummer: 'Nummer',
  bijgewerkt: 'Laatst bijgewerkt',
  aangemaakt: 'Aangemaakt',
};

// The direction a sort starts in when it is chosen: most urgent, lowest number, newest first.
export const DEFAULT_DIR = { standaard: 'asc', prioriteit: 'asc', nummer: 'asc', bijgewerkt: 'desc', aangemaakt: 'desc' };

const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The first day (YYYY-MM-DD) a creation date may have for the range, or null for no bound. */
export function createdFrom(range, today = new Date()) {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  switch (range) {
    case 'vandaag':
      return isoDate(d);
    case 'week':
      // A week starts on Monday; getDay() is 0 on Sunday.
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return isoDate(d);
    case '7':
    case '30':
      d.setDate(d.getDate() - (Number(range) - 1));
      return isoDate(d);
    default:
      return null;
  }
}

/** Whether a ticket passes the kind, search, priority and creation-date filters. */
export function matchesFilters(t, filters, today = new Date()) {
  const { kind = 'alle', q = '', prio = 'alle', created = 'alles' } = filters;
  if (kind !== 'alle' && t.prefix !== kind) return false;
  if (prio !== 'alle' && t.fields.prioriteit !== prio) return false;
  const from = createdFrom(created, today);
  if (from && !((t.fields.aangemaakt ?? '') >= from)) return false;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [t.id, t.file, t.fields.titel, t.fields['opgepakt-door'], t.fields.branch].some((v) =>
    (v ?? '').toLowerCase().includes(needle),
  );
}

const byNumber = (a, b) => (a.id ?? '').localeCompare(b.id ?? '', 'nl', { numeric: true });
const rank = (p) => {
  const i = PRIORITIES.indexOf(p);
  return i < 0 ? PRIORITIES.length : i;
};

const ASCENDING = {
  prioriteit: (a, b) => rank(a.fields.prioriteit) - rank(b.fields.prioriteit) || byNumber(a, b),
  nummer: byNumber,
  bijgewerkt: (a, b) => (a.fields.bijgewerkt ?? '').localeCompare(b.fields.bijgewerkt ?? '') || byNumber(a, b),
  aangemaakt: (a, b) => (a.fields.aangemaakt ?? '').localeCompare(b.fields.aangemaakt ?? '') || byNumber(a, b),
};

/**
 * A sorted copy. 'standaard' keeps the order the tickets come in (the server's order per column),
 * reversed for 'desc'.
 */
export function sortTickets(tickets, sort = 'standaard', dir = DEFAULT_DIR[sort] ?? 'asc') {
  const list = [...tickets];
  const cmp = ASCENDING[sort];
  if (cmp) list.sort(cmp);
  return dir === 'desc' ? list.reverse() : list;
}

/** The next sort after a click on a sortable table header: the same key flips, another key starts in its default. */
export function nextSort(current, key) {
  if (current.sort === key) return { sort: key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  return { sort: key, dir: DEFAULT_DIR[key] ?? 'asc' };
}
