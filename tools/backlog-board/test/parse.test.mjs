import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTicket } from '../lib/parse.mjs';
import { setFields } from '../lib/write.mjs';
import { filledTicket } from './helpers.mjs';

const FB = { file: 'FB-001-een-ticket.md', folder: 'backlog/functionele-backlog' };
const TB = { file: 'TB-001-een-ticket.md', folder: 'backlog/technische-backlog' };

test('a filled-in functional ticket is valid and exposes its fields, sections and criteria', () => {
  const p = parseTicket(filledTicket({ title: 'Thema dupliceren', priority: 'hoog' }), FB);
  assert.deepEqual(p.errors, []);
  assert.equal(p.valid, true);
  assert.equal(p.id, 'FB-001');
  assert.equal(p.fields.titel, 'Thema dupliceren');
  assert.equal(p.fields.prioriteit, 'hoog');
  assert.deepEqual(p.fields.fr, []);
  assert.deepEqual(
    p.sections.map((s) => s.title),
    ['Aanleiding', 'Gewenst gedrag', 'Acceptatiecriteria', "Testscenario's", 'Buiten scope', 'Open vragen', 'Werklog'],
  );
  assert.deepEqual(p.criteria, { total: 2, done: 1 });
  assert.equal(p.worklog.length, 1);
  assert.equal(p.worklog[0].by, 'tester');
});

test('CRLF line endings and a BOM parse the same as LF', () => {
  const text = '﻿' + filledTicket().replace(/\n/g, '\r\n');
  assert.deepEqual(parseTicket(text, FB).errors, []);
});

test('an unfilled section is an error even when its guidance comment is still there', () => {
  const text = filledTicket().replace(/(## Aanleiding\n\n)Ingevuld\./, '$1<!-- nog in te vullen -->');
  const p = parseTicket(text, FB);
  assert.equal(p.valid, false);
  assert.ok(p.errors.some((e) => e.includes('"## Aanleiding" is leeg')));
});

test('missing, unexpected and reordered sections are each reported', () => {
  const missing = parseTicket(filledTicket().replace(/## Buiten scope\n\nIngevuld\.\n\n/, ''), FB);
  assert.ok(missing.errors.some((e) => e.includes('Sectie ontbreekt: "## Buiten scope"')));

  const extra = parseTicket(filledTicket().replace('## Werklog', '## Notities\n\nx\n\n## Werklog'), FB);
  assert.ok(extra.errors.some((e) => e.includes('Onverwachte sectie "## Notities"')));

  const swapped = filledTicket().replace('## Aanleiding', '## TMP').replace('## Gewenst gedrag', '## Aanleiding').replace('## TMP', '## Gewenst gedrag');
  assert.ok(parseTicket(swapped, FB).errors.some((e) => e.includes('vaste volgorde')));
});

test('acceptance criteria need at least one checkbox line', () => {
  const text = filledTicket().replace(/- \[ \] Gegeven a.*\n- \[x\] Gegeven d.*/, 'Het werkt.');
  assert.ok(parseTicket(text, FB).errors.some((e) => e.includes('geen enkele "- [ ]"-regel')));
});

test('a heading inside a code fence is not a section', () => {
  const text = filledTicket().replace(/(## Gewenst gedrag\n\n)Ingevuld\./, '$1```\n## Niet een sectie\n```');
  assert.deepEqual(parseTicket(text, FB).errors, []);
});

test('frontmatter keys: unknown, missing and duplicate keys are errors', () => {
  const unknown = parseTicket(filledTicket().replace('fr: []', 'fr: []\neigenaar: iemand'), FB);
  assert.ok(unknown.errors.some((e) => e.includes('Onbekende sleutel in de frontmatter: eigenaar')));

  const missing = parseTicket(filledTicket().replace(/pr:\n/, ''), FB);
  assert.ok(missing.errors.some((e) => e.includes('Sleutel ontbreekt in de frontmatter: pr')));

  const twice = parseTicket(filledTicket().replace('pr:\n', 'pr:\npr: 3\n'), FB);
  assert.ok(twice.errors.some((e) => e.includes('twee keer')));
});

test('enumerations, dates and references are validated', () => {
  const bad = setFields(filledTicket(), {
    status: 'bezig',
    prioriteit: 'dringend',
    aangemaakt: '13-09-2026',
    bijgewerkt: '2026-09-13',
    pr: 'PR52',
    fr: ['FR-7.2', 'wens'],
  });
  const errors = parseTicket(bad, FB).errors.join('\n');
  for (const needle of ['Onbekende status "bezig"', 'Onbekende prioriteit "dringend"', 'aangemaakt moet', 'bijgewerkt moet', 'pr moet', '"wens" in fr']) {
    assert.ok(errors.includes(needle), `expected an error containing: ${needle}\n${errors}`);
  }
  assert.deepEqual(parseTicket(setFields(filledTicket(), { fr: ['FR-7.2', 'NFR-3'], pr: '#52' }), FB).errors, []);
});

test('a ticket in progress must name who has it and on which branch', () => {
  const p = parseTicket(setFields(filledTicket(), { status: 'in-uitvoering' }), FB);
  assert.ok(p.errors.includes('Een ticket in uitvoering moet opgepakt-door invullen.'));
  assert.ok(p.errors.includes('Een ticket in uitvoering moet branch invullen.'));
});

test('a technical ticket never sits in te-testen, and uses its own section list', () => {
  const tb = filledTicket({ prefix: 'TB' });
  assert.deepEqual(parseTicket(tb, TB).errors, []);
  assert.ok(parseTicket(setFields(tb, { status: 'te-testen' }), TB).errors.some((e) => e.includes('niet via te-testen')));
  assert.ok(parseTicket(filledTicket(), { ...FB, file: 'TB-001-een-ticket.md', folder: TB.folder }).errors.length > 0);
});

test('file name, folder, id and soort must agree', () => {
  assert.ok(parseTicket(filledTicket(), { file: 'FB-1-kort.md', folder: FB.folder }).errors[0].includes('bestandsnaam'));
  assert.ok(parseTicket(filledTicket(), { file: FB.file, folder: TB.folder }).errors.some((e) => e.includes('horen in backlog/functionele-backlog')));
  assert.ok(parseTicket(filledTicket({ number: 2 }), FB).errors.some((e) => e.includes('past niet bij de bestandsnaam')));
  assert.ok(parseTicket(setFields(filledTicket(), { soort: 'technisch' }), FB).errors.some((e) => e.includes('soort moet "functioneel"')));
});

test('a level-one heading or text before the first section is an error', () => {
  assert.ok(parseTicket(filledTicket().replace('## Aanleiding', '# Titel\n\n## Aanleiding'), FB).errors.some((e) => e.includes('niveau 1')));
  assert.ok(parseTicket(filledTicket().replace('## Aanleiding', 'Losse tekst\n\n## Aanleiding'), FB).errors.some((e) => e.includes('vóór de eerste sectie')));
});

test('a worklog line in the wrong shape is a warning, not an error', () => {
  const p = parseTicket(filledTicket().trimEnd() + '\n- gisteren iets gedaan\n', FB);
  assert.equal(p.valid, true);
  assert.ok(p.warnings.some((w) => w.includes('Werklogregel')));
});

test('garbage never throws', () => {
  for (const text of ['', '---', 'geen frontmatter', '---\nid: FB-001\n', '---\n---\n## Werklog\n']) {
    const p = parseTicket(text, FB);
    assert.equal(p.valid, false);
  }
});
