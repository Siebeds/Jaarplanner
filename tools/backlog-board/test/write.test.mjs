import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEYS, SECTIONS } from '../lib/format.mjs';
import { parseTicket } from '../lib/parse.mjs';
import { appendWorklog, renderNewTicket, setFields, slugify, timestamp, worklogLine } from '../lib/write.mjs';
import { filledTicket } from './helpers.mjs';

const FB = { file: 'FB-007-thema-dupliceren.md', folder: 'backlog/functionele-backlog' };

test('a fresh ticket has every key and section, and is rejected until the sections are filled', () => {
  const text = renderNewTicket({ prefix: 'FB', number: 7, title: 'Thema dupliceren', status: 'nieuw', priority: 'hoog', by: 'fa' });
  for (const key of KEYS) assert.match(text, new RegExp(`^${key}:`, 'm'));
  for (const section of SECTIONS.FB) assert.ok(text.includes(`## ${section}\n`), section);
  const p = parseTicket(text, FB);
  assert.equal(p.valid, false);
  const empty = p.errors.filter((e) => e.endsWith('is leeg.'));
  assert.equal(empty.length, SECTIONS.FB.length - 1, p.errors.join('\n'));
  assert.equal(p.fields.id, 'FB-007');
  assert.equal(p.worklog[0].text, 'aangemaakt (status nieuw)');
});

test('a technical ticket started in progress records who and where', () => {
  const text = renderNewTicket({ prefix: 'TB', number: 1, title: 'x', status: 'in-uitvoering', priority: 'middel', by: 'sessie-1', branch: 'feature/x' });
  const p = parseTicket(text, { file: 'TB-001-x.md', folder: 'backlog/technische-backlog' });
  assert.equal(p.fields['opgepakt-door'], 'sessie-1');
  assert.equal(p.fields.branch, 'feature/x');
});

test('setFields changes only the named lines and keeps the rest byte for byte', () => {
  const before = filledTicket();
  const after = setFields(before, { status: 'klaar-voor-bouw', fr: ['FR-7.2'] });
  assert.match(after, /^status: klaar-voor-bouw$/m);
  assert.match(after, /^fr: \[FR-7\.2\]$/m);
  assert.equal(after.split('\n').length, before.split('\n').length);
  assert.equal(setFields(after, { status: 'nieuw', fr: [] }), before);
  assert.throws(() => setFields(before, { eigenaar: 'x' }), /ontbreekt/);
});

test('appendWorklog adds a line at the end, and refuses when Werklog is not the last section', () => {
  const line = worklogLine('2026-09-13 14:20', 'sessie-1', 'klaar-voor-bouw → in-uitvoering');
  const after = appendWorklog(filledTicket(), line);
  assert.ok(after.endsWith(`${line}\n`));
  const p = parseTicket(after, { file: 'FB-001-een-ticket.md', folder: FB.folder });
  assert.equal(p.worklog.at(-1).text, 'klaar-voor-bouw → in-uitvoering');
  assert.throws(() => appendWorklog(filledTicket().replace('## Werklog', '## Werklog\n\nx\n\n## Na'), line), /laatste sectie/);
});

test('worklogLine keeps the separator out of the name, so the line stays parseable', () => {
  assert.equal(worklogLine('2026-09-13 14:20', 'a · b', 'x\ny'), '- 2026-09-13 14:20 · a - b · x y');
});

test('slugify strips accents and punctuation and cuts on a word boundary', () => {
  assert.equal(slugify("Leerkracht kan een thema's dupliceren!"), 'leerkracht-kan-een-thema-s-dupliceren');
  assert.equal(slugify('Één café, twee ideeën'), 'een-cafe-twee-ideeen');
  assert.equal(slugify('a'.repeat(30) + ' ' + 'b'.repeat(30)), 'a'.repeat(30));
  assert.equal(slugify('!!!'), 'ticket');
});

test('timestamp is local time in the format the parser expects', () => {
  assert.equal(timestamp(new Date(2026, 0, 2, 3, 4)), '2026-01-02 03:04');
});
