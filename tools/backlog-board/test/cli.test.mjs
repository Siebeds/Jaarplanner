import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseTicket } from '../lib/parse.mjs';
import { GIT_ENV, tempRepo, ticketPath } from './helpers.mjs';

const CLI = fileURLToPath(new URL('../tickets.mjs', import.meta.url));

const runIn = ({ coord }, cwd, ...args) =>
  spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', env: { ...process.env, JAARPLANNER_COORD: coord } });

function setup() {
  const r = tempRepo();
  r.write('README.md', 'repo\n');
  r.commit('base');
  const coord = path.join(r.dir, 'coordination');
  fs.mkdirSync(path.join(coord, 'claims'), { recursive: true });
  fs.writeFileSync(path.join(coord, 'groepschat.md'), '# Groepschat\n');
  const run = (...args) => runIn({ coord }, r.repo, ...args);
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

/** A functional ticket FB-001, filled in and committed on main as klaar-voor-bouw. */
function readyTicket({ r, run, fill }) {
  assert.equal(run('new', 'FB', '--title', 'Thema dupliceren', '--by', 'fa').status, 0);
  const rel = ticketPath('FB', 1, 'thema-dupliceren');
  fill(rel);
  assert.equal(run('status', 'FB-001', 'klaar-voor-bouw', '--by', 'fa').status, 0);
  r.commit('FB-001 ready');
  return rel;
}

test('a functional ticket from creation to te-testen, through the allowed transitions only', () => {
  const { r, coord, run, fill } = setup();
  try {
    let out = run('new', 'FB', '--title', 'Thema dupliceren', '--by', 'fa', '--fr', 'FR-7.2');
    assert.equal(out.status, 0, out.stderr);
    const rel = ticketPath('FB', 1, 'thema-dupliceren');
    assert.ok(out.stdout.includes(rel));
    assert.deepEqual(fs.readdirSync(path.join(coord, 'claims')), [], 'the number reservation is released');
    assert.match(fs.readFileSync(path.join(coord, 'groepschat.md'), 'utf8'), /\| fa \| FB-001 \| INFO \| created FB-001 \(nieuw\): Thema dupliceren/);

    assert.equal(run('check').status, 1, 'unfilled sections fail the check');
    fill(rel);
    out = run('check');
    assert.equal(out.status, 0, out.stdout);

    out = run('status', 'FB-001', 'in-uitvoering', '--by', 's1', '--branch', 'feature/x');
    assert.equal(out.status, 1, 'a functional ticket is refined before it is built');
    assert.equal(run('status', 'FB-001', 'klaar-voor-bouw', '--by', 'fa').status, 0);
    r.commit('FB-001 ready');

    r.git('switch', '-q', '-c', 'feature/x');
    out = run('status', 'FB-001', 'in-uitvoering', '--by', 's1', '--log', 'opgepakt');
    assert.equal(out.status, 0, out.stderr);
    let p = fieldsOf(r, rel);
    assert.equal(p.fields['opgepakt-door'], 's1');
    assert.equal(p.fields.branch, 'feature/x', 'the branch defaults to the current one');

    assert.equal(run('status', 'FB-001', 'klaar', '--by', 's1').status, 1, 'no skipping the tester');
    assert.equal(run('block', 'FB-001', '--by', 's1', 'wacht', 'op', 'de', 'eigenaar').status, 0);
    assert.equal(fieldsOf(r, rel).fields.geblokkeerd, 'wacht op de eigenaar');
    assert.equal(run('unblock', 'FB-001', '--by', 's1').status, 0);
    out = run('status', 'FB-001', 'te-testen', '--by', 's1', '--pr', '52');
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
    assert.equal(run('status', 'FB-001', 'klaar-voor-bouw', '--by', 'tester', '--log', 'Bevinding: knop ontbreekt').status, 0);
    p = fieldsOf(r, rel);
    assert.equal(p.fields['opgepakt-door'], '');
    assert.equal(p.fields.branch, '');
  } finally {
    r.cleanup();
  }
});

test('a write on a stale copy is refused, so an old status can never be stamped newer', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    const rel = readyTicket(ctx);
    r.git('switch', '-q', '-c', 'feature/a');
    assert.equal(run('status', 'FB-001', 'in-uitvoering', '--by', 's1').status, 0);
    r.commit('Start FB-001');

    // on main the copy is still klaar-voor-bouw: a Werklog line there would win and undo the pickup
    r.git('switch', '-q', 'main');
    const before = r.read(rel);
    const out = run('log', 'FB-001', '--by', 'lead', 'even kijken');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /in uitvoering door s1 op branch feature\/a/);
    assert.equal(r.read(rel), before, 'nothing was written');

    // and a second session cannot pick up a ticket another session already has
    r.git('switch', '-q', '-c', 'feature/b');
    assert.equal(run('status', 'FB-001', 'in-uitvoering', '--by', 's2').status, 1);
  } finally {
    r.cleanup();
  }
});

test('after a post-merge commit on the branch, the tester can still close the ticket on main', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    r.git('switch', '-q', '-c', 'feature/a');
    assert.equal(run('status', 'FB-001', 'in-uitvoering', '--by', 's1').status, 0);
    assert.equal(run('status', 'FB-001', 'te-testen', '--by', 's1').status, 0);
    r.commit('FB-001 done');
    r.git('switch', '-q', 'main');
    r.git('merge', '-q', '--no-ff', '-m', 'merge a', 'feature/a');

    r.git('switch', '-q', 'feature/a');
    assert.equal(run('pr', 'FB-001', '52', '--by', 's1').status, 0);
    r.commit('FB-001 PR number, after the merge');
    r.git('switch', '-q', 'main');

    const out = run('status', 'FB-001', 'klaar', '--by', 'tester', '--log', 'getest');
    assert.equal(out.status, 0, out.stderr);
    assert.equal(fieldsOf(r, ticketPath('FB', 1, 'thema-dupliceren')).fields.pr, '52', 'the PR number recorded after the merge is kept');
  } finally {
    r.cleanup();
  }
});

test('a ticket given back on an unmerged branch can be picked up by the next session', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    r.git('switch', '-q', '-c', 'feature/a');
    assert.equal(run('status', 'FB-001', 'in-uitvoering', '--by', 's1').status, 0);
    r.commit('Start FB-001');
    assert.equal(run('status', 'FB-001', 'klaar-voor-bouw', '--by', 's1', '--log', 'teruggegeven').status, 0);
    r.commit('Give FB-001 back');

    r.git('switch', '-q', 'main');
    r.git('switch', '-q', '-c', 'feature/b');
    const out = run('status', 'FB-001', 'in-uitvoering', '--by', 's2');
    assert.equal(out.status, 0, out.stderr);
    const log = fieldsOf(r, ticketPath('FB', 1, 'thema-dupliceren')).worklog.map((w) => w.text);
    assert.ok(log.includes('in-uitvoering → klaar-voor-bouw: teruggegeven'), 'the give-back note travels to the next session');
  } finally {
    r.cleanup();
  }
});

test('in a second clone, the guard sees a fetched branch that holds the ticket', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    const origin = path.join(r.dir, 'origin.git');
    execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin], { env: GIT_ENV });
    r.git('remote', 'add', 'origin', origin);
    r.git('push', '-q', 'origin', 'main');
    r.git('switch', '-q', '-c', 'feature/a');
    assert.equal(run('status', 'FB-001', 'in-uitvoering', '--by', 's1').status, 0);
    r.commit('Start FB-001');
    r.git('push', '-q', 'origin', 'feature/a');

    // the functional architect's own clone, on main, after a fetch
    const clone = path.join(r.dir, 'architect');
    execFileSync('git', ['clone', '-q', origin, clone], { env: GIT_ENV });
    const out = runIn(ctx, clone, 'log', 'FB-001', '--by', 'fa', 'een aanvulling');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /in uitvoering door s1 op branch feature\/a \(gezien op remote branch origin\/feature\/a\)/);
  } finally {
    r.cleanup();
  }
});

function addOrigin(r) {
  const origin = path.join(r.dir, 'origin.git');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin], { env: GIT_ENV });
  r.git('remote', 'add', 'origin', origin);
  r.git('push', '-q', '-u', 'origin', 'main');
  return origin;
}

test('a ticket given back while blocked stays blocked for the next session', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    const rel = readyTicket(ctx);
    r.git('switch', '-q', '-c', 'feature/a');
    assert.equal(run('status', 'FB-001', 'in-uitvoering', '--by', 's1').status, 0);
    assert.equal(run('block', 'FB-001', '--by', 's1', 'open', 'vraag', 'Art.', 'XIV').status, 0);
    assert.equal(run('status', 'FB-001', 'klaar-voor-bouw', '--by', 's1', '--log', 'teruggegeven: wacht op besluit').status, 0);
    r.commit('Give FB-001 back, blocked');

    r.git('switch', '-q', 'main');
    r.git('switch', '-q', '-c', 'feature/b');
    let out = run('status', 'FB-001', 'in-uitvoering', '--by', 's2');
    assert.equal(out.status, 1, 'a blocked ticket is not picked up');
    assert.match(out.stderr, /geblokkeerd: open vraag Art\. XIV/);

    assert.equal(run('unblock', 'FB-001', '--by', 'eigenaar', 'beslist').status, 0);
    out = run('status', 'FB-001', 'in-uitvoering', '--by', 's2');
    assert.equal(out.status, 0, out.stderr);
    assert.ok(fieldsOf(r, rel).worklog.some((w) => w.text.includes('teruggegeven: wacht op besluit')));
  } finally {
    r.cleanup();
  }
});

test("the owner's block on main stops a pickup from a branch that forked before it", () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    r.git('branch', 'feature/c');
    assert.equal(run('block', 'FB-001', '--by', 'eigenaar', 'welke', 'disciplines?').status, 0);
    r.commit('Block FB-001');
    assert.match(run('list', '--status', 'klaar-voor-bouw').stdout, /FB-001\s+Klaar voor bouw\s+middel\s+ja/);

    r.git('switch', '-q', 'feature/c');
    const out = run('status', 'FB-001', 'in-uitvoering', '--by', 's3');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /geblokkeerd: welke disciplines\?/);
  } finally {
    r.cleanup();
  }
});

test('two copies that have diverged are refused, not silently overwritten', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    const rel = readyTicket(ctx);
    r.git('switch', '-q', '-c', 'feature/x');
    assert.equal(run('log', 'FB-001', '--by', 's1', 'op de branch').status, 0);
    r.commit('log on the branch');
    r.git('switch', '-q', 'main');
    r.write(rel, `${r.read(rel).trimEnd()}\n- 2026-09-13 09:00 · fa · met de hand op main\n`);
    r.commit('hand edit on main');

    const out = run('log', 'FB-001', '--by', 'fa', 'nog iets');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /uit elkaar gelopen/);
  } finally {
    r.cleanup();
  }
});

test('a branch deleted on the server is named as stale, and git fetch --prune frees the ticket', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    const origin = addOrigin(r);
    r.git('switch', '-q', '-c', 'feature/d');
    assert.equal(run('status', 'FB-001', 'in-uitvoering', '--by', 's4').status, 0);
    r.commit('Start FB-001');
    r.git('push', '-q', 'origin', 'feature/d');
    r.git('switch', '-q', 'main');
    r.git('branch', '-D', 'feature/d');
    execFileSync('git', ['-C', origin, 'branch', '-D', 'feature/d'], { env: GIT_ENV }); // a PR closed on the server

    r.git('switch', '-q', '-c', 'feature/e');
    let out = run('status', 'FB-001', 'in-uitvoering', '--by', 's5');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /git fetch --prune/);
    r.git('fetch', '-q', '--prune');
    out = run('status', 'FB-001', 'in-uitvoering', '--by', 's5');
    assert.equal(out.status, 0, out.stderr);
  } finally {
    r.cleanup();
  }
});

test('a newer copy on your own upstream asks for a pull instead of being adopted', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    const origin = addOrigin(r);
    const clone = path.join(r.dir, 'tester');
    execFileSync('git', ['clone', '-q', origin, clone], { env: GIT_ENV });
    assert.equal(run('block', 'FB-001', '--by', 'eigenaar', 'even', 'wachten').status, 0);
    r.commit('Block FB-001');
    r.git('push', '-q', 'origin', 'main');

    execFileSync('git', ['-C', clone, 'fetch', '-q'], { env: GIT_ENV });
    const out = runIn(ctx, clone, 'log', 'FB-001', '--by', 'tester', 'x');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /remote branch origin\/main.*git pull/);
  } finally {
    r.cleanup();
  }
});

test('a technical ticket starts in progress on the current branch and ends at klaar', () => {
  const { r, run, fill } = setup();
  try {
    assert.equal(run('new', 'TB', '--title', 'Iets', '--by', 's1').status, 1, 'not on main');
    r.git('switch', '-q', '-c', 'feature/t');
    const out = run('new', 'TB', '--title', 'Build sneller maken', '--by', 's1');
    assert.equal(out.status, 0, out.stderr);
    const rel = ticketPath('TB', 1, 'build-sneller-maken');
    fill(rel);
    let p = fieldsOf(r, rel);
    assert.equal(p.valid, true, p.errors.join('\n'));
    assert.equal(p.fields.status, 'in-uitvoering');
    assert.equal(p.fields.branch, 'feature/t');
    assert.equal(run('status', 'TB-001', 'te-testen', '--by', 's1').status, 1);
    assert.equal(run('status', 'TB-001', 'klaar', '--by', 's1').status, 0);
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
    assert.equal(run('next-id', 'TB').stdout.trim(), 'TB-008');

    fs.writeFileSync(path.join(coord, 'claims', 'ticketnr-TB-008.md'), 'owner: someone\n');
    r.git('switch', '-q', '-c', 'feature/n');
    const out = run('new', 'TB', '--title', 'Volgende', '--by', 's2');
    assert.equal(out.status, 0, out.stderr);
    assert.ok(out.stdout.includes('TB-009-volgende.md'));
    assert.ok(fs.existsSync(path.join(coord, 'claims', 'ticketnr-TB-008.md')), "another session's reservation is left alone");
  } finally {
    r.cleanup();
  }
});

test('commands refuse to touch an invalid ticket and explain unknown input', () => {
  const { r, run } = setup();
  try {
    assert.equal(run('new', 'FB', '--title', 'Half', '--by', 'fa').status, 0);
    const out = run('status', 'FB-001', 'klaar-voor-bouw', '--by', 'fa');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /volgt de structuur niet/);
    assert.match(run('status', 'FB-999', 'klaar', '--by', 'x').stderr, /bestaat niet in deze checkout/);
    assert.match(run('status', 'FB-001', 'klaar-voor-bouw').stderr, /--by/);
    assert.match(run('verzin').stderr, /Onbekende opdracht/);
    assert.match(run('new', 'FB', '--title', 'Al verfijnd', '--by', 'fa', '--status', 'klaar-voor-bouw').stderr, /start als nieuw/);
  } finally {
    r.cleanup();
  }
});
