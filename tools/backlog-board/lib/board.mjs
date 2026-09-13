// Turns the collected versions into the board: one card per ticket file, the winning version
// chosen, the column derived, and every structural problem kept visible.

import { COLUMNS, PRIORITIES } from './format.mjs';
import { parseTicket } from './parse.mjs';

const SOURCE_RANK = { worktree: 3, branch: 2, main: 1 };

// A worktree checked out on main is main with uncommitted edits, not work waiting for a merge.
const isMain = (source) => source.type === 'main' || (source.type === 'worktree' && source.branch === 'main');

function newer(a, b) {
  const at = a.parsed.fields.bijgewerkt ?? '';
  const bt = b.parsed.fields.bijgewerkt ?? '';
  if (at !== bt) return at > bt ? a : b;
  return SOURCE_RANK[a.source.type] >= SOURCE_RANK[b.source.type] ? a : b;
}

export function sourceLabel(source) {
  if (source.type === 'main') return 'main';
  if (source.type === 'branch') return `${source.remote ? 'remote branch' : 'branch'} ${source.name}`;
  return `worktree ${source.name}${source.branch ? ` (${source.branch})` : ''}, niet gecommit`;
}

/**
 * The version that counts, among the versions of ONE ticket file: the newest valid `bijgewerkt`,
 * and on a tie the one closest to the work (worktree, then branch, then main). Null when none is
 * valid. Each entry is `{ source, text, parsed? }`; `parsed` is filled in when missing.
 */
export function winnerOf(entries) {
  for (const e of entries) e.parsed ??= parseTicket(e.text ?? '', { file: e.file, folder: e.folder });
  const valid = entries.filter((e) => e.parsed.valid);
  return valid.length ? valid.reduce(newer) : null;
}

/**
 * An agent's final status (te-testen / klaar) is "In review" only while main does not have it yet.
 * Deciding on main's status, rather than on where the winning copy lives, keeps a card in Te testen
 * when a branch gains a commit after its merge (a PR number, say): that copy is newer, but the work
 * is already on main.
 */
export function columnOf(status, source, mainStatus) {
  const final = status === 'te-testen' || status === 'klaar';
  if (final && !isMain(source) && mainStatus !== status) return 'in-review';
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
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...v });
  }

  const tickets = [];
  for (const [key, entries] of groups) {
    const best = winnerOf(entries);
    const winner = best ?? entries.reduce((a, b) => (SOURCE_RANK[a.source.type] >= SOURCE_RANK[b.source.type] ? a : b));
    const p = winner.parsed;
    const mainEntry = entries.find((e) => e.source.type === 'main' && e.parsed.valid);
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
      column: p.valid ? columnOf(p.fields.status, winner.source, mainEntry?.parsed.fields.status) : null,
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
