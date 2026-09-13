// Turns the collected versions into the board: one card per ticket file, the winning version
// chosen, the column derived, and every structural problem kept visible.

import { COLUMNS, PRIORITIES } from './format.mjs';
import { parseTicket } from './parse.mjs';

const SOURCE_RANK = { worktree: 3, branch: 2, main: 1 };

function newer(a, b) {
  const at = a.parsed.fields.bijgewerkt ?? '';
  const bt = b.parsed.fields.bijgewerkt ?? '';
  if (at !== bt) return at > bt ? a : b;
  return SOURCE_RANK[a.source.type] >= SOURCE_RANK[b.source.type] ? a : b;
}

function sourceLabel(source) {
  if (source.type === 'main') return 'main';
  if (source.type === 'branch') return `branch ${source.name}`;
  return `worktree ${source.name}${source.branch ? ` (${source.branch})` : ''}, niet gecommit`;
}

/**
 * The newest valid version wins; `bijgewerkt` decides, and on a tie the version closest to the work
 * (worktree, then branch, then main). An agent's final status seen anywhere but main means "done,
 * waiting for the merge": that is the In review column.
 */
export function columnOf(status, sourceType) {
  if ((status === 'te-testen' || status === 'klaar') && sourceType !== 'main') return 'in-review';
  return status;
}

function sortCards(columnId, cards) {
  const byUpdatedDesc = (a, b) => (b.fields.bijgewerkt ?? '').localeCompare(a.fields.bijgewerkt ?? '');
  if (columnId === 'nieuw' || columnId === 'klaar-voor-bouw') {
    return cards.sort(
      (a, b) =>
        PRIORITIES.indexOf(a.fields.prioriteit) - PRIORITIES.indexOf(b.fields.prioriteit) ||
        a.id.localeCompare(b.id, 'nl', { numeric: true }),
    );
  }
  return cards.sort(byUpdatedDesc);
}

export function buildBoard(versions) {
  const groups = new Map();
  for (const v of versions) {
    const key = `${v.folder}/${v.file}`;
    const parsed = parseTicket(v.text ?? '', { file: v.file, folder: v.folder });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...v, parsed });
  }

  const tickets = [];
  for (const [key, entries] of groups) {
    const valid = entries.filter((e) => e.parsed.valid);
    const winner = valid.length
      ? valid.reduce(newer)
      : entries.reduce((a, b) => (SOURCE_RANK[a.source.type] >= SOURCE_RANK[b.source.type] ? a : b));
    const p = winner.parsed;
    const warnings = [...p.warnings];
    for (const other of entries) {
      if (other !== winner && !other.parsed.valid) {
        warnings.push(`De versie op ${sourceLabel(other.source)} volgt de structuur niet: ${other.parsed.errors[0]}`);
      }
    }
    tickets.push({
      key,
      id: p.id ?? key,
      prefix: p.prefix,
      file: winner.file,
      folder: winner.folder,
      valid: p.valid,
      errors: [...p.errors],
      warnings,
      column: p.valid ? columnOf(p.fields.status, winner.source.type) : null,
      fields: p.fields,
      criteria: p.criteria,
      sections: p.sections,
      worklog: p.worklog,
      source: { ...winner.source, label: sourceLabel(winner.source) },
      onMain: entries.some((e) => e.source.type === 'main'),
      versions: entries.map((e) => ({
        label: sourceLabel(e.source),
        type: e.source.type,
        status: e.parsed.fields.status ?? null,
        updated: e.parsed.fields.bijgewerkt ?? null,
        valid: e.parsed.valid,
        winner: e === winner,
      })),
    });
  }

  // Two different files claiming one id is a numbering collision; both cards say so.
  const byId = new Map();
  for (const t of tickets) {
    if (!t.id || t.id === t.key) continue;
    if (!byId.has(t.id)) byId.set(t.id, []);
    byId.get(t.id).push(t);
  }
  for (const [id, same] of byId) {
    if (same.length < 2) continue;
    for (const t of same) {
      t.errors.push(`Het nummer ${id} wordt door ${same.length} bestanden gebruikt: ${same.map((s) => s.file).join(', ')}.`);
      t.valid = false;
      t.column = null;
    }
  }

  const columns = COLUMNS.map((c) => ({
    ...c,
    cards: sortCards(
      c.id,
      tickets.filter((t) => t.column === c.id),
    ),
  }));
  const invalid = tickets.filter((t) => !t.valid).sort((a, b) => a.key.localeCompare(b.key));
  return { columns, invalid, total: tickets.length };
}
