#!/usr/bin/env node
// Command line for the ticket backlog. Every write a session makes to a ticket goes through here, so
// the frontmatter, `bijgewerkt` and the Werklog stay in the one shape the board reads. It edits files
// in the current checkout only and never runs a git command that changes anything: committing stays
// with whoever called it.
//
// Command and option names are English (Art. II.2: tooling identifiers); the values it writes and the
// messages it prints are Dutch, because they are ticket content and their readers are the owner and
// the functional architect.

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { COLUMNS, FINAL_STATUS, FOLDERS, PRIORITIES, STATUSES, transitionAllowed } from './lib/format.mjs';
import { normalise, parseTicket } from './lib/parse.mjs';
import { appendWorklog, formatNumber, renderNewTicket, setFields, slugify, timestamp, worklogLine } from './lib/write.mjs';
import { allTicketIds, collectVersions, mainRoot, readWorkingFiles, repoRoot } from './lib/sources.mjs';
import { buildBoard, sourceLabel, winnerOf } from './lib/board.mjs';

const COORD = process.env.JAARPLANNER_COORD ?? 'C:/source/Jaarplanner/.claude/coordination';

const USAGE = `Gebruik: node tools/backlog-board/tickets.mjs <opdracht> ...

  list [--status <kolom>] [--kind FB|TB]
      Alle tickets zoals het bord ze ziet (main, branches en worktrees).
  check [bestand ...] [--all]
      Controleert de structuur van de tickets in deze checkout, of van het hele bord met --all.
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

Elke schrijfopdracht weigert als er elders (op een andere branch of in een andere worktree) een
nieuwere versie van het ticket bestaat: pas het ticket aan waar het werk gebeurt.

Statussen: ${STATUSES.join(', ')}.`;

class Fail extends Error {}

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true }).trim();
}

function currentBranch(root) {
  try {
    return git(root, ['branch', '--show-current']);
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
      `${prefix}-${m[2]} bestaat niet in deze checkout (${folder}). Staat het ticket op main? Haal main dan eerst binnen in je branch.`,
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

// What a write must not overrule: the status, and for work in progress also who holds it. Other fields
// (a PR number, Werklog lines) may differ between copies without either copy being wrong about the
// ticket's state.
const stateOf = (f) => (f.status === 'in-uitvoering' ? `in-uitvoering door ${f['opgepakt-door']}` : f.status);

/**
 * Refuses a write when a newer copy elsewhere says the ticket is in a different state. Without this,
 * a write on a stale copy (a Werklog line on main while a branch has the ticket in progress, say)
 * stamps the old status with a newer `bijgewerkt`, the board shows the old status as the truth, and a
 * second session can pick the ticket up again.
 *
 * It compares state, not text: a branch that gained a PR number after its merge, or a ticket given
 * back on a branch that was never merged, must not freeze the ticket for the tester or the next
 * session. And it sees what this machine sees: local branches, worktrees, and remote-tracking
 * branches as of the last fetch. A branch that exists only on another PC is invisible to it; the
 * skills carry the rule for that case.
 */
async function requireCurrent(ticket) {
  const { versions } = await collectVersions(await mainRoot(), undefined, { remotes: true });
  const same = versions.filter((v) => v.folder === ticket.folder && v.file === ticket.file);
  const winner = winnerOf(same);
  if (!winner || normalise(winner.text) === normalise(ticket.text)) return;
  const w = winner.parsed.fields;
  const mine = ticket.parsed.fields;
  if (stateOf(w) === stateOf(mine)) return;
  throw new Fail(
    `${ticket.parsed.id} heeft elders een nieuwere versie: ${sourceLabel(winner.source)} (${stateOf(w)}, bijgewerkt ${w.bijgewerkt}). ` +
      `Deze checkout zegt: ${stateOf(mine)}, bijgewerkt ${mine.bijgewerkt}. ` +
      'Pas het ticket aan waar het werk gebeurt, of vraag de eigenaar wie het vasthoudt.',
  );
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

async function loadForWrite(id) {
  const root = await repoRoot();
  const ticket = await findTicket(root, id);
  requireValid(ticket);
  await requireCurrent(ticket);
  return { root, ticket };
}

// ---- commands ---------------------------------------------------------------------------------

async function cmdList(values) {
  const { versions } = await collectVersions(await mainRoot());
  const board = buildBoard(versions);
  const kind = values.kind ? parsePrefix(values.kind) : null;
  const rows = [];
  for (const column of board.columns) {
    if (values.status && column.id !== values.status) continue;
    for (const t of column.cards) {
      if (kind && t.prefix !== kind) continue;
      rows.push([t.id, column.title, t.fields.prioriteit, t.fields['opgepakt-door'] || '-', t.fields.titel, t.source.label]);
    }
  }
  if (!values.status) {
    for (const t of board.invalid) {
      if (kind && t.prefix !== kind) continue;
      rows.push([t.id, 'ONGELDIG', '-', '-', t.errors[0], t.source.label]);
    }
  }
  if (rows.length === 0) {
    console.log('Geen tickets gevonden.');
    return 0;
  }
  const header = ['id', 'kolom', 'prioriteit', 'opgepakt door', 'titel', 'bron'];
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
  const allowed = prefix === 'TB' ? ['nieuw', 'klaar-voor-bouw', 'in-uitvoering'] : ['nieuw', 'klaar-voor-bouw'];
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
  const from = ticket.parsed.fields.status;
  if (from === to) throw new Fail(`${ticket.parsed.id} staat al op ${to}.`);
  if (!transitionAllowed(ticket.prefix, from, to)) {
    const hint = to === 'klaar' && ticket.prefix === 'FB' ? ' Een functioneel ticket gaat eerst naar te-testen.' : '';
    throw new Fail(`Van ${from} naar ${to} mag niet voor een ${ticket.prefix}-ticket.${hint}`);
  }
  const fields = { status: to };
  if (to === 'in-uitvoering') {
    const branch = values.branch || ticket.parsed.fields.branch || currentBranch(root);
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
