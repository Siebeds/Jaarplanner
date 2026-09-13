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

Een schrijfopdracht weigert als er elders een nieuwere versie van het ticket staat met een andere
status, houder of blokkering, en zegt welk git-commando dat oplost. Ze neemt nooit zelf een versie
over. Na de merge schrijf je op main, niet meer op de branch; een geblokkeerd ticket wordt niet
opgepakt en niet teruggegeven.

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
// - The Werklog only ever grows, so another copy is NEWER than this one exactly when it has Werklog
//   lines this one lacks. No clock and no text comparison is involved.
// - A newer copy that says something different about the ticket (its status, who holds it, whether it
//   is blocked) means this checkout is behind. The guard refuses and names the git command that brings
//   the newer copy in, so the merge is git's to do, never this tool's.
//
// It sees what this machine sees: local branches, worktrees, and remote branches as of the last fetch.

const worklogKey = (w) => `${w.at}|${w.by}|${w.text}`;
const hasLinesMissingFrom = (copy, mine) => {
  const have = new Set(mine.worklog.map(worklogKey));
  return copy.worklog.some((w) => !have.has(worklogKey(w)));
};

const stateKey = (f) => [f.status, f.status === 'in-uitvoering' ? f['opgepakt-door'] : '', f.geblokkeerd ?? ''].join('|');
function describe(f) {
  let s = f.status;
  if (f.status === 'in-uitvoering') s += ` door ${f['opgepakt-door']} op branch ${f.branch}`;
  if (f.geblokkeerd) s += `, geblokkeerd (${f.geblokkeerd})`;
  return s;
}
const isMainSource = (s) => s.type === 'main' || (s.type === 'worktree' && s.branch === 'main');

/** Refuses a write this checkout is not in a position to make; returns notices worth printing. */
async function checkCurrent(root, ticket) {
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
  // would sit on an unmerged branch that the board then shows as newer than main.
  const onMain = copies.find((c) => c.source.type === 'main');
  if (branch && branch !== 'main' && (f.status === 'te-testen' || f.status === 'klaar') && onMain?.parsed.fields.status === f.status) {
    throw new Fail(`Het werk van ${id} staat al op main (${f.status}). Wijzig het ticket op main, niet meer op ${branch}.`);
  }

  const newer = copies.filter((c) => normalise(c.text) !== normalise(ticket.text) && hasLinesMissingFrom(c.parsed, mine));

  // This branch's own upstream is ahead for this ticket: pull, so the next push does not conflict.
  const upstream = upstreamOf(root);
  const ahead = upstream && newer.find((c) => c.source.remote && c.source.name === upstream);
  if (ahead) throw new Fail(`Op ${upstream} staat een nieuwere versie van ${id}. Haal ze eerst binnen met git pull.`);

  const conflict = newer.find((c) => stateKey(c.parsed.fields) !== stateKey(f));
  if (conflict) {
    const where = sourceLabel(conflict.source);
    let remedy;
    if (isMainSource(conflict.source)) {
      remedy = 'Haal main binnen in je branch (git merge main) en probeer opnieuw.';
    } else {
      remedy =
        'Dat ticket wordt daar bewerkt: wacht op de merge, of vraag de eigenaar. Is die sessie gestopt, dan ruimt de eigenaar ' +
        'haar werk op (git worktree remove voor een worktree, anders git branch -D), en verliest daarmee wat daar niet gecommit is.';
    }
    if (conflict.source.remote) {
      remedy += ` Bestaat ${conflict.source.name} niet meer op de server, ruim de verwijzing dan op met git fetch --prune.`;
    }
    throw new Fail(`Op ${where} staat een nieuwere versie van ${id}: ${describe(conflict.parsed.fields)}. Deze checkout zegt: ${describe(f)}. ${remedy}`);
  }

  // Newer copies that agree on the state (a ticket given back on a branch that was never merged, for
  // instance) do not stop the write, but what they add is not here: say so, with their last line.
  return newer.map((c) => {
    const last = c.parsed.worklog.at(-1);
    return `Let op: op ${sourceLabel(c.source)} staat een nieuwere versie van ${id} met dezelfde status. Laatste werklogregel daar: "${last?.text ?? ''}".`;
  });
}

async function loadForWrite(id) {
  const root = await repoRoot();
  const ticket = await findTicket(root, id);
  requireValid(ticket);
  for (const notice of await checkCurrent(root, ticket)) console.log(notice);
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

// A number is reserved through the groepschat claim directory when this machine has one, so two
// sessions creating a ticket at the same moment cannot both take it. The claim (`ticketnr-<ID>`) lives
// only until the file exists: from then on every session's `next-id` sees the file itself. It is not
// logged as CLAIM/RELEASE; the INFO line announcing the new ticket is the record.
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

async function announce(by, id, text) {
  const chat = path.join(COORD, 'groepschat.md');
  if (!existsSync(chat)) return;
  await fs.appendFile(chat, `${timestamp()} | ${by} | ${id} | INFO | ${text}\n`);
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
    branch ||= currentBranch(root);
    if (!branch || branch === 'main') {
      throw new Fail('Werk aan een ticket gebeurt op een eigen branch. Maak die eerst aan, of geef --branch op.');
    }
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
      await announce(by, id, `created ${id} (${status}): ${title}`);
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
  throw new Fail('Geen vrij nummer gevonden na 50 pogingen. Kijk in de claims-map van de groepschat.');
}

async function cmdStatus(values, positionals) {
  const [id, to] = positionals;
  const by = requireBy(values);
  if (!STATUSES.includes(to)) throw new Fail(`Onbekende status "${to ?? ''}". Toegestaan: ${STATUSES.join(', ')}.`);
  const { root, ticket } = await loadForWrite(id);
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
  if (f.geblokkeerd && from === 'in-uitvoering' && to === 'klaar-voor-bouw') {
    throw new Fail(`${ticket.parsed.id} is geblokkeerd: ${f.geblokkeerd}. Houd het ticket tot de vraag beantwoord is; geef het daarna terug.`);
  }
  const fields = { status: to };
  if (to === 'in-uitvoering') {
    const branch = values.branch || f.branch || currentBranch(root);
    if (!branch || branch === 'main') {
      throw new Fail('Werk aan een ticket gebeurt op een eigen branch. Maak die eerst aan, of geef --branch op.');
    }
    Object.assign(fields, { 'opgepakt-door': by, branch });
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
  const { ticket } = await loadForWrite(id);
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
    default:
      throw new Fail(`Onbekende opdracht "${command}".\n\n${USAGE}`);
  }
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (e) {
  if (e instanceof Fail || e?.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') {
    console.error(e.message);
    process.exitCode = 1;
  } else {
    throw e;
  }
}
