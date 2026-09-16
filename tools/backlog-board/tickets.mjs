#!/usr/bin/env node
// Command line for the ticket backlog. Every write a session makes to a ticket goes through here, so
// the frontmatter, `bijgewerkt` and the Werklog stay in the one shape the board reads. It edits files
// in the current checkout only and never runs a git command that changes anything: committing, and
// bringing another branch's copy in, stay with whoever called it.
//
// Command and option names are English (Art. II.2: tooling identifiers); the values it writes and the
// messages it prints are Dutch, because they are ticket content and their readers are the owner and
// the functional architect (Art. II.6).

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { COLUMNS, FINAL_STATUS, FOLDERS, PRIORITIES, STATUSES, transitionAllowed } from './lib/format.mjs';
import { normalise, parseTicket } from './lib/parse.mjs';
import { appendWorklog, formatNumber, renderNewTicket, setFields, slugify, timestamp, worklogLine } from './lib/write.mjs';
import { allTicketIds, collectVersions, mainRoot, readWorkingFiles, repoRoot } from './lib/sources.mjs';
import { buildBoard, sourceLabel } from './lib/board.mjs';

const COORD = process.env.JAARPLANNER_COORD ?? 'C:/source/Jaarplanner/.claude/coordination';

const USAGE = `Gebruik: node tools/backlog-board/tickets.mjs <opdracht> ...

  list [--status <kolom>] [--kind FB|TB]
      Alle tickets: main, branches, worktrees en opgehaalde remote branches, met wie ze vasthoudt
      en of ze geblokkeerd zijn.
  check [bestand ...] [--all]
      Controleert de structuur van de tickets in deze checkout, of van het hele board met --all.
  next-id FB|TB
      Het volgende vrije nummer.
  new FB|TB --title "<titel>" --by <wie> [--priority hoog|middel|laag]
            [--status <status>] [--branch <branch>] [--fr FR-7.2,FR-7.3]
      Maakt een nieuw ticket aan met de vaste structuur. Vul daarna de secties in.
  status <id> <status> --by <wie> [--branch <branch>] [--pr <nummer>] [--log "<tekst>"]
      Zet de status, werkt "bijgewerkt" bij en schrijft een regel in het werklog.
  log <id> --by <wie> "<tekst>"
  block <id> --by <wie> "<reden>"
  unblock <id> --by <wie>
  pr <id> <nummer> --by <wie>
  release <id> --by <wie> --log "<reden>"
      Alleen de eigenaar: een ticket vrijgeven waarvan de sessie gestopt is, in een checkout van haar branch.

Een schrijfopdracht weigert als er elders een nieuwere versie van het ticket staat met een andere
status, houder of blokkering, en zegt welk git-commando dat oplost. Ze neemt nooit zelf een versie
over. Na de merge schrijf je op main, niet meer op de branch; een geblokkeerd ticket wordt niet
opgepakt en niet teruggegeven (alleen release door de eigenaar geeft het vrij, en dan blijft de
blokkering staan).

Statussen: ${STATUSES.join(', ')}.`;

class Fail extends Error {}

// stderr is captured, so git's own English "fatal: ..." never reaches a Dutch reader.
function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function currentBranch(root) {
  try {
    return git(root, ['branch', '--show-current']);
  } catch {
    return '';
  }
}

function upstreamOf(root) {
  try {
    return git(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
  } catch {
    return '';
  }
}

function requireBy(values) {
  if (!values.by) throw new Fail('Geef met --by aan wie dit doet (je sessie-id of je naam).');
  return values.by;
}

function parsePrefix(value) {
  const prefix = (value ?? '').toUpperCase();
  if (!(prefix in FOLDERS)) throw new Fail('Geef FB (functioneel) of TB (technisch) op.');
  return prefix;
}

async function findTicket(root, id) {
  const m = /^(FB|TB)-(\d{3,})$/i.exec(id ?? '');
  if (!m) throw new Fail(`"${id ?? ''}" is geen ticket-id zoals FB-012 of TB-003.`);
  const prefix = m[1].toUpperCase();
  const folder = FOLDERS[prefix];
  const wanted = `${prefix}-${m[2]}-`;
  let names = [];
  try {
    names = await fs.readdir(path.join(root, folder));
  } catch {
    // folder missing: handled below
  }
  const hits = names.filter((n) => n.startsWith(wanted) && n.endsWith('.md'));
  if (hits.length === 0) {
    const { versions } = await collectVersions(await mainRoot(), undefined, { remotes: true });
    const found = versions.filter((v) => v.folder === folder && v.file.startsWith(wanted));
    if (found.some((v) => onMainLine(v.source))) {
      const localMain = found.some((v) => isMainSource(v.source));
      throw new Fail(
        `${prefix}-${m[2]} staat nog niet in deze checkout maar wel op main. ` +
          (localMain ? 'Haal main binnen in je branch (git merge main).' : ORIGIN_MAIN_REMEDY),
      );
    }
    const elsewhere = [...new Set(found.map((v) => sourceLabel(v.source)))];
    if (elsewhere.length) {
      // A TB ticket lives on the branch of its work until it is merged, also after it was given back.
      throw new Fail(
        `${prefix}-${m[2]} staat niet in deze checkout maar wel op ${elsewhere.join(', ')}. Werk verder op die branch ` +
          '(git switch, of een worktree erop), of wacht tot ze gemerged is.',
      );
    }
    throw new Fail(
      `${prefix}-${m[2]} bestaat niet in deze checkout (${folder}). Staat het ticket op main? Haal main dan eerst binnen in je branch (git merge main).`,
    );
  }
  if (hits.length > 1) throw new Fail(`Meerdere bestanden gebruiken ${prefix}-${m[2]}: ${hits.join(', ')}. Los dat eerst op.`);
  const file = hits[0];
  const full = path.join(root, folder, file);
  const text = await fs.readFile(full, 'utf8');
  return { prefix, file, folder, full, text, parsed: parseTicket(text, { file, folder }) };
}

function requireValid(ticket) {
  if (ticket.parsed.valid) return;
  throw new Fail(
    `${ticket.file} volgt de structuur niet, dus ik pas het niet aan. Los eerst op:\n` +
      ticket.parsed.errors.map((e) => `  - ${e}`).join('\n'),
  );
}

// ---- the guard against writing on a stale copy --------------------------------------------------
//
// Four earlier designs failed an audit each: letting the newest `bijgewerkt` win let a stale copy undo
// a pickup; refusing on any text difference froze tickets; comparing status only dropped blocks; and
// adopting the newest copy's text into this checkout made git merges conflict, because git merges on
// history and not on text. What is left is what git itself guarantees, used two ways:
//
// - The Werklog only ever grows, so another copy is NEWER than this one exactly when it has every
//   Werklog line this one has, and more. No clock and no text comparison is involved. A copy that has
//   lines this one lacks AND lacks lines this one has is diverged, not newer (see `relation`).
// - A newer copy that says something different about the ticket (its status, who holds it, whether it
//   is blocked) means this checkout is behind. The guard refuses and names the git command that brings
//   the newer copy in, so the merge is git's to do, never this tool's.
//
// It sees what this machine sees: local branches, worktrees, and remote branches as of the last fetch.

const worklogKey = (w) => `${w.at}|${w.by}|${w.text}`;

const stateKey = (f) => [f.status, f.status === 'in-uitvoering' ? f['opgepakt-door'] : '', f.geblokkeerd ?? ''].join('|');
function describe(f) {
  let s = f.status;
  if (f.status === 'in-uitvoering') s += ` door ${f['opgepakt-door']} op branch ${f.branch}`;
  if (f.geblokkeerd) s += `, geblokkeerd (${f.geblokkeerd})`;
  return s;
}
const isMainSource = (s) => s.type === 'main' || (s.type === 'worktree' && s.branch === 'main');

/**
 * How another copy relates to this checkout's copy, by their Werklogs: `older` (it has nothing this one
 * lacks), `newer` (it has everything this one has, and more: this copy is behind it), or `diverged`
 * (each has lines the other lacks: a ticket given back on a branch that was never merged, a branch that
 * only logged a line, a commit left on a work branch after its merge). A diverged copy is not ahead of
 * anyone: treating it as newer froze the ticket for every later writer (audit round 5).
 */
function relation(copy, mine) {
  const theirs = new Set(copy.worklog.map(worklogKey));
  const ours = new Set(mine.worklog.map(worklogKey));
  const theyHaveMore = [...theirs].some((k) => !ours.has(k));
  if (!theyHaveMore) return 'older';
  return [...ours].some((k) => !theirs.has(k)) ? 'diverged' : 'newer';
}

// A copy that sits on main: main itself, a checkout of main, or the fetched main of a remote.
const onMainLine = (s) => isMainSource(s) || (s.remote && /\/main$/.test(s.name));

// How to resolve a conflict in the ticket file after `git merge main`. Which frontmatter wins depends on
// what THIS checkout's copy says, not on who runs the command: a copy that holds the ticket (whoever
// holds it) or blocks it keeps its own state fields and takes main's text; any other copy takes main's
// frontmatter. Audit rounds 8, 9 and 10 each broke the rule by keying it on something else: one rule for
// all, then the caller (which sent the owner's `release` down the wrong branch and lost a block).
const CONFLICT_HINT =
  ' Geeft dat een conflict in het ticketbestand, houd dan de frontmatter van main en alle werklogregels van beide kanten, in volgorde van tijd.';
const HOLD_HINT =
  ' Geeft dat een conflict in het ticketbestand: deze versie houdt het ticket vast of blokkeert het, dus houd status, ' +
  'opgepakt-door, branch, geblokkeerd en pr van deze branch, neem de rest van de tekst van main, en alle werklogregels van ' +
  'beide kanten, in volgorde van tijd.';
const mainRemedy = (remote, holds) =>
  (remote
    ? 'Haal main eerst binnen (git pull op main) en daarna in je branch (git merge main).'
    : 'Haal main binnen in je branch (git merge main) en probeer opnieuw.') + (holds ? HOLD_HINT : CONFLICT_HINT);
const MAIN_REMEDY = mainRemedy(false, false);
const ORIGIN_MAIN_REMEDY = mainRemedy(true, false);

function remedyFor(conflict, holds = false) {
  const s = conflict.source;
  const g = conflict.parsed.fields;
  if (s.type === 'worktree') {
    return isMainSource(s)
      ? `Die versie staat nog niet gecommit in ${s.name}: ze moet eerst op main gecommit worden, en daarna haal je main binnen in je branch (git merge main).`
      : `Die versie staat nog niet gecommit in ${s.name}: laat die sessie haar werk afmaken, of vraag de eigenaar.`;
  }
  if (onMainLine(s)) return mainRemedy(Boolean(s.remote), holds);
  let remedy;
  if (g.status === 'in-uitvoering') {
    remedy =
      `${g['opgepakt-door']} houdt het ticket vast: laat het aan die sessie, en vraag haar in haar eigen venster om het te blokkeren of terug te geven. ` +
      'Is die sessie gestopt, dan geeft de eigenaar het vrij met release, in een checkout van die branch.';
  } else if (g.geblokkeerd) {
    remedy =
      'Die blokkering moet eerst op die branch opgelost worden (unblock). Ruimt de eigenaar die branch op terwijl de vraag nog ' +
      'open is, dan zet hij de blokkering meteen daarna op main (block), anders gaat ze verloren.';
  } else {
    remedy =
      'Dat werk wacht op de merge van die branch; wijzig het ticket daarna. Wordt die PR niet gemerged, dan zet de eigenaar het ' +
      'ticket in een checkout van die branch terug naar klaar-voor-bouw en commit dat daar, of verwijdert hij de branch.';
  }
  if (s.remote) {
    remedy +=
      ` Werd het ticket op ${s.name} ooit teruggegeven of vrijgegeven zonder dat dat gepusht werd, doe het dan opnieuw in een ` +
      `checkout van die branch en push, of verwijder de remote branch. Bestaat ${s.name} niet meer op de server, ruim de ` +
      'verwijzing op met git fetch --prune.';
  }
  return remedy;
}

/**
 * Refuses a write this checkout is not in a position to make; returns notices worth printing.
 *
 * Which other copies count:
 * - a copy strictly ahead of this one (`newer`) counts whenever it says a different state;
 * - a copy on main (or the fetched origin/main) is never "split off": if it has lines this one lacks,
 *   this checkout is behind main for this ticket, and a pickup must start from main's latest copy;
 * - a split-off copy elsewhere still counts while it HOLDS the ticket or carries a block this copy
 *   lacks (audit round 6: ignoring it let two sessions hold one ticket), and stops counting once it is
 *   handed back and unblocked (audit round 5: counting it froze the ticket after a give-back).
 */
async function checkCurrent(root, ticket, by, { pickup = false, release = false } = {}) {
  const { versions } = await collectVersions(await mainRoot(), undefined, { remotes: true });
  const id = ticket.parsed.id;
  const mine = ticket.parsed;
  const f = mine.fields;
  const copies = versions
    .filter((v) => v.folder === ticket.folder && v.file === ticket.file)
    .map((v) => ({ ...v, parsed: parseTicket(v.text ?? '', { file: v.file, folder: v.folder }) }))
    .filter((v) => v.parsed.valid);
  const branch = currentBranch(root);

  // After the merge, the ticket lives on main. A write left on the work branch (a PR number, say)
  // would sit on an unmerged branch beside main. "Merged" also counts when it is only on the fetched
  // main of the remote, which is how a merge on the server first shows up.
  const final = f.status === 'te-testen' || f.status === 'klaar';
  if (branch && branch !== 'main' && final && copies.some((c) => onMainLine(c.source) && c.parsed.fields.status === f.status)) {
    throw new Fail(`Het werk van ${id} staat al op main (${f.status}). Wijzig het ticket op main, niet meer op ${branch}.`);
  }

  // A copy that another visible copy fully contains is superseded: a branch pushed while the ticket was
  // held and then given back or released locally leaves its old copy on origin/... (audit round 7). A
  // copy on main keeps counting: main is where a pickup starts.
  const keysOf = (p) => new Set(p.worklog.map(worklogKey));
  const differing = copies.filter((c) => normalise(c.text) !== normalise(ticket.text)).map((c) => ({ c, keys: keysOf(c.parsed) }));
  // Only committed copies (and this checkout's own) may supersede: an uncommitted give-back in another
  // session's worktree can still be discarded, so it must not free the ticket for anyone else yet.
  const pool = [...differing.filter((x) => x.c.source.type !== 'worktree'), { c: null, keys: keysOf(mine) }];
  const superseded = (x) => pool.some((y) => y.c !== x.c && y.keys.size > x.keys.size && [...x.keys].every((k) => y.keys.has(k)));
  const others = differing.filter((x) => onMainLine(x.c.source) || !superseded(x)).map((x) => x.c);

  // Worklog lines that are on main, so a split-off copy's finished work can be recognised as merged.
  const mainKeys = new Set(copies.filter((c) => onMainLine(c.source)).flatMap((c) => c.parsed.worklog.map(worklogKey)));
  if (branch === 'main') for (const k of keysOf(mine)) mainKeys.add(k);
  const handedBack = (g) => (g.status === 'klaar-voor-bouw' || g.status === 'nieuw') && !g.geblokkeerd;
  const mergedFinal = (c) => {
    const g = c.parsed.fields;
    if (g.status !== 'te-testen' && g.status !== 'klaar') return false;
    const line = [...c.parsed.worklog].reverse().find((w) => /→ (te-testen|klaar)(:|$)/.test(w.text));
    return Boolean(line && mainKeys.has(worklogKey(line)));
  };

  const kind = (c) => {
    const r = relation(c.parsed, mine);
    return r === 'diverged' && onMainLine(c.source) ? 'newer' : r;
  };
  const newer = others.filter((c) => kind(c) === 'newer');
  const diverged = others.filter((c) => kind(c) === 'diverged');

  // This branch's own upstream has something for this ticket that this checkout lacks: pull first, so
  // the next push does not conflict.
  const upstream = upstreamOf(root);
  if (upstream && [...newer, ...diverged].some((c) => c.source.remote && c.source.name === upstream)) {
    throw new Fail(`Op ${upstream} staat een nieuwere versie van ${id}. Haal ze eerst binnen met git pull.`);
  }

  const copyHolds = f.status === 'in-uitvoering' || Boolean(f.geblokkeerd);
  const conflict = newer.find((c) => stateKey(c.parsed.fields) !== stateKey(f));
  if (conflict) {
    throw new Fail(
      `Op ${sourceLabel(conflict.source)} staat een nieuwere versie van ${id}: ${describe(conflict.parsed.fields)}. ` +
        `Deze checkout zegt: ${describe(f)}. ${remedyFor(conflict, copyHolds)}`,
    );
  }

  // A pickup starts from main's latest copy of the ticket, so the branch never diverges from main on it.
  const mainAhead = pickup && newer.find((c) => onMainLine(c.source));
  if (mainAhead) {
    throw new Fail(
      `Op ${sourceLabel(mainAhead.source)} staat een nieuwere versie van ${id}, en een ticket pak je op vanaf de laatste ` +
        `versie op main. ${remedyFor(mainAhead)}`,
    );
  }

  // A split-off copy stops counting only when it is really handed back (klaar-voor-bouw or nieuw, not
  // blocked) or its finished work is already on main. Anything else (held, blocked, or finished and
  // waiting for its merge) still claims the ticket (audit rounds 6 and 7).
  const holding = diverged.find((c) => {
    const g = c.parsed.fields;
    if (handedBack(g) || mergedFinal(c)) return false;
    return !(g.status === 'in-uitvoering' && g['opgepakt-door'] === by);
  });
  if (holding) {
    throw new Fail(`Op ${sourceLabel(holding.source)} staat een versie van ${id} die nog meetelt: ${describe(holding.parsed.fields)}. ${remedyFor(holding)}`);
  }

  // A ticket in progress is changed only by the session that holds it; `release` is the owner's way
  // to free a ticket whose session has stopped, and it logs who did it.
  if (!release && f.status === 'in-uitvoering' && f['opgepakt-door'] !== by) {
    throw new Fail(
      `${id} is in uitvoering door ${f['opgepakt-door']} op branch ${f.branch}: alleen die sessie wijzigt het ticket. ` +
        'Is die sessie gestopt, dan geeft de eigenaar het hier vrij met release.',
    );
  }

  const notices = newer.map(
    (c) =>
      `Let op: op ${sourceLabel(c.source)} staat een nieuwere versie van ${id} met dezelfde status. Laatste werklogregel daar: "${c.parsed.worklog.at(-1)?.text ?? ''}".`,
  );
  for (const c of diverged) {
    if (!handedBack(c.parsed.fields) || stateKey(c.parsed.fields) === stateKey(f)) continue;
    notices.push(
      `Let op: op ${sourceLabel(c.source)} staat een afgesplitste versie van ${id} (${describe(c.parsed.fields)}), teruggegeven en niet geblokkeerd. ` +
        'Ze telt niet mee; is die branch verlaten, dan kan de eigenaar ze opruimen.',
    );
  }
  return notices;
}

async function loadForWrite(id, by, options = {}) {
  const root = await repoRoot();
  const ticket = await findTicket(root, id);
  requireValid(ticket);
  for (const notice of await checkCurrent(root, ticket, by, options)) console.log(notice);
  return { root, ticket };
}

async function save(ticket, text) {
  const reparsed = parseTicket(text, { file: ticket.file, folder: ticket.folder });
  if (!reparsed.valid) {
    throw new Fail(`De wijziging zou het ticket ongeldig maken:\n${reparsed.errors.map((e) => `  - ${e}`).join('\n')}`);
  }
  await fs.writeFile(ticket.full, text, 'utf8');
  return reparsed;
}

function edit(ticket, fields, by, message) {
  const at = timestamp();
  return appendWorklog(setFields(ticket.text, { ...fields, bijgewerkt: at }), worklogLine(at, by, message));
}

// ---- commands ---------------------------------------------------------------------------------

// `list` reads the same sources as the write guard, fetched remote branches included, so what it
// calls available is what a pickup will accept. The board reads local sources only (ADR-0033 §4).
async function cmdList(values) {
  const { versions } = await collectVersions(await mainRoot(), undefined, { remotes: true });
  const board = buildBoard(versions);
  const kind = values.kind ? parsePrefix(values.kind) : null;
  const rows = [];
  for (const column of board.columns) {
    if (values.status && column.id !== values.status) continue;
    for (const t of column.cards) {
      if (kind && t.prefix !== kind) continue;
      const blocked = t.fields.geblokkeerd ? 'ja' : '-';
      rows.push([t.id, column.title, t.fields.prioriteit, blocked, t.fields['opgepakt-door'] || '-', t.fields.titel, t.source.label]);
    }
  }
  if (!values.status) {
    for (const t of board.invalid) {
      if (kind && t.prefix !== kind) continue;
      rows.push([t.id, 'ONGELDIG', '-', '-', '-', t.errors[0], t.source.label]);
    }
  }
  if (rows.length === 0) {
    console.log('Geen tickets gevonden.');
    return 0;
  }
  const header = ['id', 'kolom', 'prioriteit', 'geblokkeerd', 'opgepakt door', 'titel', 'bron'];
  const widths = header.map((h, i) => Math.min(60, Math.max(h.length, ...rows.map((r) => String(r[i]).length))));
  const line = (r) => r.map((c, i) => String(c).slice(0, widths[i]).padEnd(widths[i])).join('  ');
  console.log(line(header));
  for (const r of rows) console.log(line(r));
  return 0;
}

function report(tickets) {
  let failed = 0;
  for (const t of tickets) {
    const name = `${t.folder}/${t.file}`;
    if (t.errors.length) failed++;
    console.log(`${t.errors.length ? 'FOUT  ' : 'OK    '}${name}${t.source?.type === 'branch' ? `  (${t.source.label})` : ''}`);
    for (const e of t.errors) console.log(`        - ${e}`);
    for (const w of t.warnings) console.log(`        let op: ${w}`);
  }
  console.log(`\n${tickets.length} ticket(s) gecontroleerd, ${failed} met fouten.`);
  return failed ? 1 : 0;
}

async function cmdCheck(values, files) {
  if (values.all) {
    const { versions } = await collectVersions(await mainRoot());
    const board = buildBoard(versions);
    return report([...board.columns.flatMap((c) => c.cards), ...board.invalid]);
  }
  const root = await repoRoot();
  if (files.length) {
    const tickets = [];
    for (const f of files) {
      const full = path.resolve(f);
      const folder = path.relative(root, path.dirname(full)).split(path.sep).join('/');
      const text = await fs.readFile(full, 'utf8');
      tickets.push(parseTicket(text, { file: path.basename(full), folder }));
    }
    return report(tickets);
  }
  const versions = (await readWorkingFiles(root)).map((f) => ({ source: { type: 'worktree', name: '.' }, ...f }));
  const board = buildBoard(versions);
  return report([...board.columns.flatMap((c) => c.cards), ...board.invalid]);
}

async function nextNumber(prefix) {
  const ids = await allTicketIds(await mainRoot());
  let max = 0;
  for (const id of ids) if (id.startsWith(`${prefix}-`)) max = Math.max(max, Number(id.slice(3)));
  return { next: max + 1, ids };
}

async function cmdNextId(positionals) {
  const prefix = parsePrefix(positionals[0]);
  const { next } = await nextNumber(prefix);
  console.log(`${prefix}-${formatNumber(next)}`);
  return 0;
}

// A number is reserved through the claim directory under COORD when this machine has one, so two
// sessions creating a ticket at the same moment cannot both take it. The claim (`ticketnr-<ID>`) lives
// only until the file exists: from then on every session's `next-id` sees the file itself.
async function reserve(id, by) {
  const dir = path.join(COORD, 'claims');
  if (!existsSync(dir)) return { release: async () => {} };
  const file = path.join(dir, `ticketnr-${id}.md`);
  try {
    await fs.writeFile(file, `owner: ${by}\ntaken: ${timestamp()}\nwhy: creating ticket ${id}\n`, { flag: 'wx' });
  } catch (e) {
    if (e.code === 'EEXIST') return null;
    throw e;
  }
  return { release: () => fs.rm(file, { force: true }) };
}

async function cmdNew(values, positionals) {
  const prefix = parsePrefix(positionals[0]);
  const by = requireBy(values);
  const title = (values.title ?? '').trim();
  if (!title) throw new Fail('Geef een titel op met --title "...".');
  const priority = values.priority ?? 'middel';
  if (!PRIORITIES.includes(priority)) throw new Fail(`Prioriteit moet ${PRIORITIES.join(', ')} zijn.`);
  const status = values.status ?? (prefix === 'TB' ? 'in-uitvoering' : 'nieuw');
  // A functional ticket always starts as nieuw: the architect only creates (owner ruling 2026-09-13).
  const allowed = prefix === 'TB' ? ['nieuw', 'klaar-voor-bouw', 'in-uitvoering'] : ['nieuw'];
  if (!allowed.includes(status)) throw new Fail(`Een nieuw ${prefix}-ticket start als ${allowed.join(' of ')}.`);
  const root = await repoRoot();
  let branch = values.branch ?? '';
  if (status === 'in-uitvoering') {
    const here = currentBranch(root);
    if (!here || here === 'main') {
      throw new Fail('Werk aan een ticket gebeurt op een eigen branch. Maak die eerst aan en werk daar.');
    }
    if (branch && branch !== here) throw new Fail(`--branch moet de branch van deze checkout zijn (${here}), niet ${branch}.`);
    branch = here;
  }
  const fr = (values.fr ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  let { next, ids } = await nextNumber(prefix);
  for (let attempt = 0; attempt < 50; attempt++, next++) {
    const id = `${prefix}-${formatNumber(next)}`;
    if (ids.has(id)) continue;
    const hold = await reserve(id, by);
    if (!hold) continue;
    try {
      ({ ids } = await nextNumber(prefix)); // re-read now that the number is ours
      if (ids.has(id)) continue;
      const file = `${id}-${slugify(title)}.md`;
      const dir = path.join(root, FOLDERS[prefix]);
      await fs.mkdir(dir, { recursive: true });
      const text = renderNewTicket({ prefix, number: next, title, status, priority, by, branch, fr });
      await fs.writeFile(path.join(dir, file), text, { encoding: 'utf8', flag: 'wx' });
      const rel = `${FOLDERS[prefix]}/${file}`;
      console.log(`Aangemaakt: ${rel}`);
      console.log(
        `Vul nu elke sectie in (de <!-- -->-hulptekst mag weg) en controleer met:\n  node tools/backlog-board/tickets.mjs check ${rel}`,
      );
      return 0;
    } finally {
      await hold.release();
    }
  }
  throw new Fail('Geen vrij nummer gevonden na 50 pogingen. Kijk in .claude/coordination/claims.');
}

async function cmdStatus(values, positionals) {
  const [id, to] = positionals;
  const by = requireBy(values);
  if (!STATUSES.includes(to)) throw new Fail(`Onbekende status "${to ?? ''}". Toegestaan: ${STATUSES.join(', ')}.`);
  const { root, ticket } = await loadForWrite(id, by, { pickup: to === 'in-uitvoering' });
  const f = ticket.parsed.fields;
  const from = f.status;
  if (from === to) throw new Fail(`${ticket.parsed.id} staat al op ${to}.`);
  if (!transitionAllowed(ticket.prefix, from, to)) {
    const hint = to === 'klaar' && ticket.prefix === 'FB' ? ' Een functioneel ticket gaat eerst naar te-testen.' : '';
    throw new Fail(`Van ${from} naar ${to} mag niet voor een ${ticket.prefix}-ticket.${hint}`);
  }
  // A block is how a ticket waits for the owner on an open decision (Art. XIV). Nobody starts a blocked
  // ticket, and the session that holds one keeps it until the question is answered: given back on an
  // unmerged branch, the block would be invisible to whoever picks it up next from main.
  if (f.geblokkeerd && to === 'in-uitvoering') {
    throw new Fail(`${ticket.parsed.id} is geblokkeerd: ${f.geblokkeerd}. Pak het pas op als die vraag beantwoord is (unblock).`);
  }
  // A nieuw ticket is started only when the owner says so in the session; the log records that go-ahead.
  if (from === 'nieuw' && to === 'in-uitvoering' && !values.log?.trim()) {
    throw new Fail(`${ticket.parsed.id} staat op nieuw. Pak het alleen op als de eigenaar zegt dat hij wil starten, en noteer dat met --log "...".`);
  }
  if (f.geblokkeerd && from === 'in-uitvoering' && to === 'klaar-voor-bouw') {
    throw new Fail(`${ticket.parsed.id} is geblokkeerd: ${f.geblokkeerd}. Houd het ticket tot de vraag beantwoord is; geef het daarna terug.`);
  }
  const fields = { status: to };
  if (to === 'in-uitvoering') {
    // The pickup names the branch of the checkout it is written in: never main, and never another branch.
    const here = currentBranch(root);
    if (!here || here === 'main') {
      throw new Fail('Een ticket pak je op in de checkout van zijn eigen branch, niet op main. Maak die branch eerst aan en werk daar.');
    }
    if (values.branch && values.branch !== here) {
      throw new Fail(`--branch moet de branch van deze checkout zijn (${here}), niet ${values.branch}.`);
    }
    Object.assign(fields, { 'opgepakt-door': by, branch: here });
  }
  if (to === 'klaar-voor-bouw' || to === 'nieuw') Object.assign(fields, { 'opgepakt-door': '', branch: '', pr: '' });
  if (values.pr) fields.pr = values.pr;
  const message = `${from} → ${to}${values.log ? `: ${values.log}` : ''}`;
  const saved = await save(ticket, edit(ticket, fields, by, message));
  console.log(`${saved.id}: ${from} → ${to} (${ticket.folder}/${ticket.file})`);
  if (to === FINAL_STATUS[ticket.prefix] || to === 'klaar') {
    const { done, total } = saved.criteria;
    if (done < total) console.log(`Let op: ${done} van ${total} acceptatiecriteria zijn afgevinkt.`);
  }
  return 0;
}

async function cmdAnnotate(values, positionals, kind) {
  const [id, ...rest] = positionals;
  const by = requireBy(values);
  const { ticket } = await loadForWrite(id, by);
  const text = rest.join(' ').trim();
  let fields = {};
  let message = text;
  if (kind === 'block') {
    if (!text) throw new Fail('Geef de reden op waarom het ticket geblokkeerd is.');
    fields = { geblokkeerd: text };
    message = `geblokkeerd: ${text}`;
  } else if (kind === 'unblock') {
    if (!ticket.parsed.fields.geblokkeerd) throw new Fail(`${ticket.parsed.id} is niet geblokkeerd.`);
    fields = { geblokkeerd: '' };
    message = `niet langer geblokkeerd${text ? `: ${text}` : ''}`;
  } else if (kind === 'pr') {
    const pr = rest[0];
    if (!pr) throw new Fail('Geef het PR-nummer op.');
    fields = { pr };
    message = `PR ${/^\d+$/.test(pr) ? `#${pr}` : pr}`;
  } else if (!text) {
    throw new Fail('Geef de tekst voor het werklog op.');
  }
  const saved = await save(ticket, edit(ticket, fields, by, message));
  console.log(`${saved.id}: ${message}`);
  return 0;
}

// The owner's way to free a ticket whose session stopped: back to klaar-voor-bouw, in a checkout of
// the branch that holds it, with the reason and the former holder in the Werklog. It is the one way a
// blocked ticket leaves its holder: the block stays on that copy, which keeps counting (a blocked copy
// is never "handed back") until the owner answers the question and unblocks it there.
async function cmdRelease(values, positionals) {
  const [id] = positionals;
  const by = requireBy(values);
  const reason = (values.log ?? '').trim();
  if (!reason) throw new Fail('Geef met --log de reden op, bijvoorbeeld --log "sessie gestopt".');
  const { ticket } = await loadForWrite(id, by, { release: true });
  const f = ticket.parsed.fields;
  if (f.status !== 'in-uitvoering') throw new Fail(`${ticket.parsed.id} is niet in uitvoering (${f.status}); er is niets vrij te geven.`);
  const fields = { status: 'klaar-voor-bouw', 'opgepakt-door': '', branch: '', pr: '' };
  const message = `vrijgegeven: ${reason} (was in uitvoering door ${f['opgepakt-door']})`;
  const saved = await save(ticket, edit(ticket, fields, by, message));
  console.log(`${saved.id}: ${message}`);
  return 0;
}

// ---- entry ------------------------------------------------------------------------------------

async function main(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      title: { type: 'string' },
      by: { type: 'string' },
      priority: { type: 'string' },
      status: { type: 'string' },
      kind: { type: 'string' },
      branch: { type: 'string' },
      pr: { type: 'string' },
      fr: { type: 'string' },
      log: { type: 'string' },
      all: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [command, ...rest] = positionals;
  if (!command || values.help) {
    console.log(USAGE);
    return command ? 0 : 1;
  }
  if (values.status && command === 'list' && !COLUMNS.some((c) => c.id === values.status)) {
    throw new Fail(`Onbekende kolom "${values.status}". Toegestaan: ${COLUMNS.map((c) => c.id).join(', ')}.`);
  }
  switch (command) {
    case 'list':
      return cmdList(values);
    case 'check':
      return cmdCheck(values, rest);
    case 'next-id':
      return cmdNextId(rest);
    case 'new':
      return cmdNew(values, rest);
    case 'status':
      return cmdStatus(values, rest);
    case 'log':
    case 'block':
    case 'unblock':
    case 'pr':
      return cmdAnnotate(values, rest, command);
    case 'release':
      return cmdRelease(values, rest);
    default:
      throw new Fail(`Onbekende opdracht "${command}".\n\n${USAGE}`);
  }
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (e) {
  if (e instanceof Fail || e?.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION' || e?.code === 'NO_MAIN') {
    console.error(e.message);
  } else if (/not a git repository/i.test(String(e?.message))) {
    console.error('Deze map hoort niet bij een git-repository. Draai de opdracht vanuit de Jaarplanner-repo.');
  } else {
    // Only a developer can act on this one, so it stays in their language (Art. II.3), without a stack trace.
    console.error(`Unexpected error: ${String(e?.message ?? e).split('\n')[0]}`);
  }
  process.exitCode = 1;
}
