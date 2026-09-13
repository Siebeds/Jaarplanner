#!/usr/bin/env node
// Command line for the ticket backlog. Every write a session makes to a ticket should go through
// here, so the frontmatter, `bijgewerkt` and the Werklog stay in the one shape the board reads.
// It edits files in the current checkout only and never runs a git command that changes anything:
// committing stays with whoever called it.

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { COLUMNS, FINAL_STATUS, FOLDERS, PRIORITIES, STATUSES, transitionAllowed } from './lib/format.mjs';
import { parseTicket } from './lib/parse.mjs';
import { appendWorklog, formatNumber, renderNewTicket, setFields, slugify, timestamp, worklogLine } from './lib/write.mjs';
import { allTicketIds, collectVersions, mainRoot, readWorkingFiles, repoRoot } from './lib/sources.mjs';
import { buildBoard } from './lib/board.mjs';

const COORD = process.env.JAARPLANNER_COORD ?? 'C:/source/Jaarplanner/.claude/coordination';

const USAGE = `Gebruik: node tools/backlog-board/tickets.mjs <opdracht> ...

  lijst [--status <kolom>] [--soort FB|TB]
      Alle tickets zoals het board ze ziet (main, branches en worktrees).
  check [bestand ...] [--alle]
      Controleert de structuur van de tickets in deze checkout, of van het hele board met --alle.
  nummer FB|TB
      Het volgende vrije nummer.
  nieuw FB|TB --titel "<titel>" --door <wie> [--prioriteit hoog|middel|laag]
              [--status <status>] [--branch <branch>] [--fr FR-7.2,FR-7.3]
      Maakt een nieuw ticket aan met de vaste structuur. Vul daarna de secties in.
  status <id> <status> --door <wie> [--branch <branch>] [--pr <nummer>] [--log "<tekst>"]
      Zet de status, werkt "bijgewerkt" bij en schrijft een regel in het werklog.
  log <id> --door <wie> "<tekst>"
  blokkeer <id> --door <wie> "<reden>"
  deblokkeer <id> --door <wie>
  pr <id> <nummer> --door <wie>

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
  if (!values.door) throw new Fail('Geef met --door aan wie dit doet (je sessie-id of je naam).');
  return values.door;
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

async function cmdList(values) {
  const root = await mainRoot();
  const { versions } = await collectVersions(root);
  const board = buildBoard(versions);
  const soort = values.soort ? parsePrefix(values.soort) : null;
  const rows = [];
  for (const column of board.columns) {
    if (values.status && column.id !== values.status) continue;
    for (const t of column.cards) {
      if (soort && t.prefix !== soort) continue;
      rows.push([t.id, column.title, t.fields.prioriteit, t.fields['opgepakt-door'] || '-', t.fields.titel, t.source.label]);
    }
  }
  if (!values.status) {
    for (const t of board.invalid) {
      if (soort && t.prefix !== soort) continue;
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
  if (values.alle) {
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
      const p = parseTicket(text, { file: path.basename(full), folder });
      tickets.push({ ...p, file: p.file, folder });
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

async function cmdNumber(positionals) {
  const prefix = parsePrefix(positionals[0]);
  const { next } = await nextNumber(prefix);
  console.log(`${prefix}-${formatNumber(next)}`);
  return 0;
}

// A number is reserved through the groepschat claim directory when this machine has one, so two
// sessions creating a ticket at the same moment cannot both take it. The claim lives only until the
// file exists: from then on every session's `nummer` sees the file itself.
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
  const title = (values.titel ?? '').trim();
  if (!title) throw new Fail('Geef een titel op met --titel "...".');
  const priority = values.prioriteit ?? 'middel';
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
  const root = await repoRoot();
  const ticket = await findTicket(root, id);
  requireValid(ticket);
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

async function cmdLog(values, positionals, kind) {
  const [id, ...rest] = positionals;
  const by = requireBy(values);
  const root = await repoRoot();
  const ticket = await findTicket(root, id);
  requireValid(ticket);
  const text = rest.join(' ').trim();
  let fields = {};
  let message = text;
  if (kind === 'blokkeer') {
    if (!text) throw new Fail('Geef de reden op waarom het ticket geblokkeerd is.');
    fields = { geblokkeerd: text };
    message = `geblokkeerd: ${text}`;
  } else if (kind === 'deblokkeer') {
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
      titel: { type: 'string' },
      door: { type: 'string' },
      prioriteit: { type: 'string' },
      status: { type: 'string' },
      soort: { type: 'string' },
      branch: { type: 'string' },
      pr: { type: 'string' },
      fr: { type: 'string' },
      log: { type: 'string' },
      alle: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [command, ...rest] = positionals;
  if (!command || values.help) {
    console.log(USAGE);
    return command ? 0 : 1;
  }
  if (values.status && command === 'lijst' && !COLUMNS.some((c) => c.id === values.status)) {
    throw new Fail(`Onbekende kolom "${values.status}". Toegestaan: ${COLUMNS.map((c) => c.id).join(', ')}.`);
  }
  switch (command) {
    case 'lijst':
      return cmdList(values);
    case 'check':
      return cmdCheck(values, rest);
    case 'nummer':
      return cmdNumber(rest);
    case 'nieuw':
      return cmdNew(values, rest);
    case 'status':
      return cmdStatus(values, rest);
    case 'log':
    case 'blokkeer':
    case 'deblokkeer':
    case 'pr':
      return cmdLog(values, rest, command);
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
