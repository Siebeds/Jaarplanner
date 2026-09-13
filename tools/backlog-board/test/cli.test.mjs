import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseTicket } from '../lib/parse.mjs';
import { tempRepo, ticketPath } from './helpers.mjs';

const CLI = fileURLToPath(new URL('../tickets.mjs', import.meta.url));

function setup() {
  const r = tempRepo();
  r.write('README.md', 'repo\n');
  r.commit('base');
  const coord = path.join(r.dir, 'coordination');
  fs.mkdirSync(path.join(coord, 'claims'), { recursive: true });
  fs.writeFileSync(path.join(coord, 'groepschat.md'), '# Groepschat\n');
  const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { cwd: r.repo, encoding: 'utf8', env: { ...process.env, JAARPLANNER_COORD: coord } });
  const fill = (rel) =>
    r.write(
      rel,
      r
        .read(rel)
        .replace(/(## Acceptatiecriteria\n\n)<!--[\s\S]*?-->/, '$1- [x] Gegeven a, wanneer b, dan c\n- [ ] Gegeven d, wanneer e, dan f')
        .replace(/<!--[\s\S]*?-->/g, 'Ingevuld.'),
    );
  return { r, coord, run, fill };
}

const fieldsOf = (r, rel) => {
  const [, folder, file] = /^(.*)\/([^/]+)$/.exec(rel);
  return parseTicket(r.read(rel), { file, folder });
};

test('a functional ticket from creation to te-testen, through the allowed transitions only', () => {
  const { r, coord, run, fill } = setup();
  try {
    let out = run('nieuw', 'FB', '--titel', 'Thema dupliceren', '--door', 'fa', '--fr', 'FR-7.2');
    assert.equal(out.status, 0, out.stderr);
    const rel = ticketPath('FB', 1, 'thema-dupliceren');
    assert.ok(out.stdout.includes(rel));
    assert.deepEqual(fs.readdirSync(path.join(coord, 'claims')), [], 'the number reservation is released');
    assert.match(fs.readFileSync(path.join(coord, 'groepschat.md'), 'utf8'), /\| fa \| FB-001 \| INFO \| created FB-001 \(nieuw\): Thema dupliceren/);

    assert.equal(run('check').status, 1, 'unfilled sections fail the check');
    fill(rel);
    out = run('check');
    assert.equal(out.status, 0, out.stdout);

    out = run('status', 'FB-001', 'in-uitvoering', '--door', 's1', '--branch', 'feature/x');
    assert.equal(out.status, 1, 'a functional ticket is refined before it is built');
    assert.equal(run('status', 'FB-001', 'klaar-voor-bouw', '--door', 'fa').status, 0);
    r.commit('FB-001 ready');

    r.git('switch', '-q', '-c', 'feature/x');
    out = run('status', 'FB-001', 'in-uitvoering', '--door', 's1', '--log', 'opgepakt');
    assert.equal(out.status, 0, out.stderr);
    let p = fieldsOf(r, rel);
    assert.equal(p.fields['opgepakt-door'], 's1');
    assert.equal(p.fields.branch, 'feature/x', 'the branch defaults to the current one');

    assert.equal(run('status', 'FB-001', 'klaar', '--door', 's1').status, 1, 'no skipping the tester');
    assert.equal(run('blokkeer', 'FB-001', '--door', 's1', 'wacht', 'op', 'de', 'eigenaar').status, 0);
    assert.equal(fieldsOf(r, rel).fields.geblokkeerd, 'wacht op de eigenaar');
    assert.equal(run('deblokkeer', 'FB-001', '--door', 's1').status, 0);
    out = run('status', 'FB-001', 'te-testen', '--door', 's1', '--pr', '52');
    assert.equal(out.status, 0, out.stderr);
    assert.match(out.stdout, /1 van 2 acceptatiecriteria/);

    p = fieldsOf(r, rel);
    assert.equal(p.valid, true, p.errors.join('\n'));
    assert.equal(p.fields.status, 'te-testen');
    assert.equal(p.fields.pr, '52');
    assert.deepEqual(
      p.worklog.map((w) => w.text),
      [
        'aangemaakt (status nieuw)',
        'nieuw → klaar-voor-bouw',
        'klaar-voor-bouw → in-uitvoering: opgepakt',
        'geblokkeerd: wacht op de eigenaar',
        'niet langer geblokkeerd',
        'in-uitvoering → te-testen',
      ],
    );

    // the tester sends it back: the build fields are cleared for the next round
    assert.equal(run('status', 'FB-001', 'klaar-voor-bouw', '--door', 'tester', '--log', 'Bevinding: knop ontbreekt').status, 0);
    p = fieldsOf(r, rel);
    assert.equal(p.fields['opgepakt-door'], '');
    assert.equal(p.fields.branch, '');
  } finally {
    r.cleanup();
  }
});

test('a technical ticket starts in progress on the current branch and ends at klaar', () => {
  const { r, run, fill } = setup();
  try {
    assert.equal(run('nieuw', 'TB', '--titel', 'Iets', '--door', 's1').status, 1, 'not on main');
    r.git('switch', '-q', '-c', 'feature/t');
    const out = run('nieuw', 'TB', '--titel', 'Build sneller maken', '--door', 's1');
    assert.equal(out.status, 0, out.stderr);
    const rel = ticketPath('TB', 1, 'build-sneller-maken');
    fill(rel);
    let p = fieldsOf(r, rel);
    assert.equal(p.fields.status, 'in-uitvoering');
    assert.equal(p.fields.branch, 'feature/t');
    assert.equal(run('status', 'TB-001', 'te-testen', '--door', 's1').status, 1);
    assert.equal(run('status', 'TB-001', 'klaar', '--door', 's1').status, 0);
    p = fieldsOf(r, rel);
    assert.equal(p.fields.status, 'klaar');
  } finally {
    r.cleanup();
  }
});

test('numbering skips ids held on other branches and by a live reservation', () => {
  const { r, coord, run } = setup();
  try {
    r.git('switch', '-q', '-c', 'other');
    r.write(ticketPath('TB', 7), 'placeholder');
    r.commit('TB-007 elsewhere');
    r.git('switch', '-q', 'main');
    assert.equal(run('nummer', 'TB').stdout.trim(), 'TB-008');

    fs.writeFileSync(path.join(coord, 'claims', 'ticketnr-TB-008.md'), 'owner: someone\n');
    r.git('switch', '-q', '-c', 'feature/n');
    const out = run('nieuw', 'TB', '--titel', 'Volgende', '--door', 's2');
    assert.equal(out.status, 0, out.stderr);
    assert.ok(out.stdout.includes('TB-009-volgende.md'));
    assert.ok(fs.existsSync(path.join(coord, 'claims', 'ticketnr-TB-008.md')), 'another session\'s reservation is left alone');
  } finally {
    r.cleanup();
  }
});

test('commands refuse to touch an invalid ticket and explain unknown input', () => {
  const { r, run } = setup();
  try {
    assert.equal(run('nieuw', 'FB', '--titel', 'Half', '--door', 'fa').status, 0);
    const out = run('status', 'FB-001', 'klaar-voor-bouw', '--door', 'fa');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /volgt de structuur niet/);
    assert.match(run('status', 'FB-999', 'klaar', '--door', 'x').stderr, /bestaat niet in deze checkout/);
    assert.match(run('status', 'FB-001', 'klaar-voor-bouw').stderr, /--door/);
    assert.match(run('verzin').stderr, /Onbekende opdracht/);
  } finally {
    r.cleanup();
  }
});
