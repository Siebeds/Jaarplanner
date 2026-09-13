import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseTicket } from '../lib/parse.mjs';
import { setFields } from '../lib/write.mjs';
import { GIT_ENV, tempRepo, ticketPath } from './helpers.mjs';

const CLI = fileURLToPath(new URL('../tickets.mjs', import.meta.url));
const REL = ticketPath('FB', 1, 'thema-dupliceren');

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

const fieldsOf = (r, rel = REL, base) => {
  const [, folder, file] = /^(.*)\/([^/]+)$/.exec(rel);
  return parseTicket(r.read(rel, base), { file, folder });
};

/** A functional ticket FB-001, filled in and committed on main as klaar-voor-bouw. */
function readyTicket({ r, run, fill }) {
  assert.equal(run('new', 'FB', '--title', 'Thema dupliceren', '--by', 'fa').status, 0);
  fill(REL);
  assert.equal(run('status', 'FB-001', 'klaar-voor-bouw', '--by', 'eigenaar').status, 0);
  r.commit('FB-001 ready');
  return REL;
}

/** FB-001 picked up on feature/a by s1 and committed there. */
function pickedUp(ctx, branch = 'feature/a', by = 's1') {
  ctx.r.git('switch', '-q', '-c', branch);
  const out = ctx.run('status', 'FB-001', 'in-uitvoering', '--by', by);
  assert.equal(out.status, 0, out.stderr);
  ctx.r.commit(`Start FB-001 on ${branch}`);
}

function addOrigin(r) {
  const origin = path.join(r.dir, 'origin.git');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin], { env: GIT_ENV });
  r.git('remote', 'add', 'origin', origin);
  r.git('push', '-q', '-u', 'origin', 'main');
  return origin;
}

test('a functional ticket from creation to te-testen, through the allowed transitions only', () => {
  const { r, coord, run, fill } = setup();
  try {
    let out = run('new', 'FB', '--title', 'Thema dupliceren', '--by', 'fa', '--fr', 'FR-7.2');
    assert.equal(out.status, 0, out.stderr);
    assert.ok(out.stdout.includes(REL));
    assert.deepEqual(fs.readdirSync(path.join(coord, 'claims')), [], 'the number reservation is released');
    assert.match(fs.readFileSync(path.join(coord, 'groepschat.md'), 'utf8'), /\| fa \| FB-001 \| INFO \| created FB-001 \(nieuw\): Thema dupliceren/);

    assert.equal(run('check').status, 1, 'unfilled sections fail the check');
    fill(REL);
    out = run('check');
    assert.equal(out.status, 0, out.stdout);

    out = run('status', 'FB-001', 'in-uitvoering', '--by', 's1', '--branch', 'feature/x');
    assert.equal(out.status, 1, 'a functional ticket is refined before it is built');
    assert.equal(run('status', 'FB-001', 'klaar-voor-bouw', '--by', 'eigenaar').status, 0);
    r.commit('FB-001 ready');

    r.git('switch', '-q', '-c', 'feature/x');
    out = run('status', 'FB-001', 'in-uitvoering', '--by', 's1', '--log', 'opgepakt');
    assert.equal(out.status, 0, out.stderr);
    assert.equal(out.stderr, '', 'no git noise on a branch without an upstream');
    let p = fieldsOf(r);
    assert.equal(p.fields['opgepakt-door'], 's1');
    assert.equal(p.fields.branch, 'feature/x', 'the branch defaults to the current one');

    assert.equal(run('status', 'FB-001', 'klaar', '--by', 's1').status, 1, 'no skipping the test');
    assert.equal(run('block', 'FB-001', '--by', 's1', 'wacht', 'op', 'de', 'eigenaar').status, 0);
    assert.equal(fieldsOf(r).fields.geblokkeerd, 'wacht op de eigenaar');
    assert.equal(run('unblock', 'FB-001', '--by', 's1').status, 0);
    out = run('status', 'FB-001', 'te-testen', '--by', 's1', '--pr', '52');
    assert.equal(out.status, 0, out.stderr);
    assert.match(out.stdout, /1 van 2 acceptatiecriteria/);

    p = fieldsOf(r);
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

    // sent back after a failed test: the build fields are cleared for the next round
    assert.equal(run('status', 'FB-001', 'klaar-voor-bouw', '--by', 'eigenaar', '--log', 'Bevinding: knop ontbreekt').status, 0);
    p = fieldsOf(r);
    assert.equal(p.fields['opgepakt-door'], '');
    assert.equal(p.fields.branch, '');
  } finally {
    r.cleanup();
  }
});

test('a write on a stale copy is refused: a Werklog line on main cannot undo a pickup', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    pickedUp(ctx);
    r.git('switch', '-q', 'main');
    const before = r.read(REL);
    const out = run('log', 'FB-001', '--by', 'lead', 'even kijken');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /Op branch feature\/a staat een nieuwere versie van FB-001: in-uitvoering door s1 op branch feature\/a/);
    assert.match(out.stderr, /laat het aan die sessie/);
    assert.equal(r.read(REL), before, 'nothing was written');

    // and a second session cannot pick up a ticket another session already has
    r.git('switch', '-q', '-c', 'feature/b');
    assert.equal(run('status', 'FB-001', 'in-uitvoering', '--by', 's2').status, 1);
  } finally {
    r.cleanup();
  }
});

test("an owner's write on main cannot run ahead of an unmerged final status", () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    pickedUp(ctx);
    assert.equal(run('status', 'FB-001', 'te-testen', '--by', 's1').status, 0);
    r.commit('FB-001 done, PR open');
    r.git('switch', '-q', 'main');
    const out = run('block', 'FB-001', '--by', 'eigenaar', 'wacht');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /te-testen/);
    assert.match(out.stderr, /wacht op de merge/);
  } finally {
    r.cleanup();
  }
});

test('after the merge the ticket is written on main, and the tester closes it with the PR number kept', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    pickedUp(ctx);
    assert.equal(run('status', 'FB-001', 'te-testen', '--by', 's1').status, 0);
    assert.equal(run('pr', 'FB-001', '52', '--by', 's1').status, 0, 'the PR number goes in before the merge');
    r.commit('FB-001 done');
    r.git('switch', '-q', 'main');
    r.git('merge', '-q', '--no-ff', '-m', 'merge a', 'feature/a');

    r.git('switch', '-q', 'feature/a');
    let out = run('log', 'FB-001', '--by', 's1', 'nog iets');
    assert.equal(out.status, 1, 'no writes on the work branch after the merge');
    assert.match(out.stderr, /staat al op main/);

    r.git('switch', '-q', 'main');
    out = run('status', 'FB-001', 'klaar', '--by', 'eigenaar', '--log', 'getest');
    assert.equal(out.status, 0, out.stderr);
    assert.equal(fieldsOf(r).fields.pr, '52');
  } finally {
    r.cleanup();
  }
});

test('a ticket given back on an unmerged branch can be picked up, and its note is shown', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    pickedUp(ctx);
    assert.equal(run('status', 'FB-001', 'klaar-voor-bouw', '--by', 's1', '--log', 'teruggegeven: datamodel staat er al').status, 0);
    r.commit('Give FB-001 back');

    r.git('switch', '-q', 'main');
    r.git('switch', '-q', '-c', 'feature/b');
    const out = run('status', 'FB-001', 'in-uitvoering', '--by', 's2');
    assert.equal(out.status, 0, out.stderr);
    assert.match(out.stdout, /Let op: op branch feature\/a staat een nieuwere versie van FB-001 met dezelfde status/);
    assert.match(out.stdout, /teruggegeven: datamodel staat er al/);
  } finally {
    r.cleanup();
  }
});

test('a blocked ticket is neither given back nor picked up', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    pickedUp(ctx);
    assert.equal(run('block', 'FB-001', '--by', 's1', 'open', 'vraag', 'Art.', 'XIV').status, 0);
    let out = run('status', 'FB-001', 'klaar-voor-bouw', '--by', 's1');
    assert.equal(out.status, 1, 'the session keeps a blocked ticket');
    assert.match(out.stderr, /Houd het ticket tot de vraag beantwoord is/);
    assert.equal(run('unblock', 'FB-001', '--by', 's1', 'beslist').status, 0);
    out = run('status', 'FB-001', 'klaar-voor-bouw', '--by', 's1');
    assert.equal(out.status, 0, out.stderr);
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
    assert.match(out.stderr, /geblokkeerd \(welke disciplines\?\)/);
    assert.match(out.stderr, /git merge main/);
    r.git('merge', '-q', 'main');
    assert.match(run('status', 'FB-001', 'in-uitvoering', '--by', 's3').stderr, /is geblokkeerd: welke disciplines\?/);
  } finally {
    r.cleanup();
  }
});

test('a newer copy with the same state does not stop a write, and is named', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    r.git('switch', '-q', '-c', 'feature/x');
    assert.equal(run('log', 'FB-001', '--by', 's1', 'op de branch').status, 0);
    r.commit('log on the branch');
    r.git('switch', '-q', 'main');
    const out = run('log', 'FB-001', '--by', 'eigenaar', 'op main');
    assert.equal(out.status, 0, out.stderr);
    assert.match(out.stdout, /Let op: op branch feature\/x/);
  } finally {
    r.cleanup();
  }
});

test('in a second clone, the guard sees a fetched branch that holds the ticket', () => {
  const ctx = setup();
  const { r } = ctx;
  try {
    readyTicket(ctx);
    const origin = addOrigin(r);
    pickedUp(ctx);
    r.git('push', '-q', 'origin', 'feature/a');

    const clone = path.join(r.dir, 'architect');
    execFileSync('git', ['clone', '-q', origin, clone], { env: GIT_ENV });
    const out = runIn(ctx, clone, 'log', 'FB-001', '--by', 'fa', 'een aanvulling');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /Op remote branch origin\/feature\/a staat een nieuwere versie van FB-001: in-uitvoering door s1/);
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
    pickedUp(ctx, 'feature/d', 's4');
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

test('a newer copy on your own upstream asks for a pull', () => {
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
    assert.match(out.stderr, /Op origin\/main staat een nieuwere versie van FB-001\. Haal ze eerst binnen met git pull/);
  } finally {
    r.cleanup();
  }
});

test('a PR merged on the server and fetched but not pulled asks for a pull, even with the work branch still local', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    const origin = addOrigin(r);
    pickedUp(ctx);
    assert.equal(run('status', 'FB-001', 'te-testen', '--by', 's1', '--pr', '7').status, 0);
    r.commit('FB-001 done');
    r.git('push', '-q', 'origin', 'feature/a');
    r.git('switch', '-q', 'main');

    // the merge happens on the server (here: from a second clone)
    const server = path.join(r.dir, 'server-merge');
    execFileSync('git', ['clone', '-q', origin, server], { env: GIT_ENV });
    execFileSync('git', ['-C', server, 'merge', '-q', '--no-ff', '-m', 'Merge PR 7', 'origin/feature/a'], { env: GIT_ENV });
    execFileSync('git', ['-C', server, 'push', '-q', 'origin', 'main'], { env: GIT_ENV });

    r.git('fetch', '-q');
    const out = run('status', 'FB-001', 'klaar', '--by', 'eigenaar');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /git pull/);
  } finally {
    r.cleanup();
  }
});

test('after a give-back, the next holder writes all the way to te-testen, and the owner closes after the merge', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    pickedUp(ctx);
    assert.equal(run('status', 'FB-001', 'klaar-voor-bouw', '--by', 's1', '--log', 'teruggegeven: datamodel staat er al').status, 0);
    r.commit('Give FB-001 back');
    r.git('switch', '-q', 'main');
    pickedUp(ctx, 'feature/b', 's2');
    for (const args of [
      ['log', 'FB-001', '--by', 's2', 'bezig'],
      ['block', 'FB-001', '--by', 's2', 'een', 'vraag'],
      ['unblock', 'FB-001', '--by', 's2'],
      ['status', 'FB-001', 'te-testen', '--by', 's2'],
    ]) {
      const out = run(...args);
      assert.equal(out.status, 0, `${args.join(' ')}: ${out.stderr}`);
    }
    r.commit('FB-001 done by s2');
    r.git('switch', '-q', 'main');
    r.git('merge', '-q', '--no-ff', '-m', 'merge b', 'feature/b');
    const out = run('status', 'FB-001', 'klaar', '--by', 'eigenaar');
    assert.equal(out.status, 0, out.stderr);
  } finally {
    r.cleanup();
  }
});

test('a branch that only logged a line does not stop the next holder', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    r.git('switch', '-q', '-c', 'feature/x');
    assert.equal(run('log', 'FB-001', '--by', 's1', 'alleen een regel').status, 0);
    r.commit('a log line');
    r.git('switch', '-q', 'main');
    pickedUp(ctx, 'feature/y', 's2');
    const out = run('status', 'FB-001', 'te-testen', '--by', 's2');
    assert.equal(out.status, 0, out.stderr);
  } finally {
    r.cleanup();
  }
});

test('a commit left on a merged work branch does not freeze main', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    pickedUp(ctx);
    assert.equal(run('status', 'FB-001', 'te-testen', '--by', 's1').status, 0);
    r.commit('FB-001 done');
    r.git('switch', '-q', 'main');
    r.git('merge', '-q', '--no-ff', '-m', 'merge a', 'feature/a');
    r.git('switch', '-q', 'feature/a');
    r.write(REL, `${r.read(REL).trimEnd()}\n- 2026-09-13 23:59 · s1 · achtergebleven regel\n`);
    r.commit('left behind after the merge');
    r.git('switch', '-q', 'main');
    for (const args of [
      ['status', 'FB-001', 'klaar', '--by', 'eigenaar'],
      ['log', 'FB-001', '--by', 'eigenaar', 'nog een opmerking'],
      ['status', 'FB-001', 'klaar-voor-bouw', '--by', 'eigenaar', '--log', 'heropend'],
    ]) {
      const out = run(...args);
      assert.equal(out.status, 0, `${args.join(' ')}: ${out.stderr}`);
    }
  } finally {
    r.cleanup();
  }
});

test("the owner's uncommitted edit on main asks to be committed, not merged", () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    const wt = path.join(r.dir, 'wt');
    r.git('worktree', 'add', '-q', '-b', 'feature/s', wt, 'main');
    assert.equal(run('block', 'FB-001', '--by', 'eigenaar', 'even', 'wachten').status, 0); // not committed
    const out = runIn(ctx, wt, 'status', 'FB-001', 'in-uitvoering', '--by', 's1');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /nog niet gecommit/);
    assert.match(out.stderr, /eerst op main gecommit/);
  } finally {
    r.cleanup();
  }
});

test('a TB ticket that lives on another branch says where it is', () => {
  const ctx = setup();
  const { r, run, fill } = ctx;
  try {
    r.git('switch', '-q', '-c', 'feature/t');
    assert.equal(run('new', 'TB', '--title', 'Iets technisch', '--by', 's1').status, 0);
    fill(ticketPath('TB', 1, 'iets-technisch'));
    r.commit('Add TB-001');
    assert.equal(run('status', 'TB-001', 'klaar-voor-bouw', '--by', 's1', '--log', 'teruggegeven').status, 0);
    r.commit('Give TB-001 back');
    r.git('switch', '-q', 'main');
    r.git('switch', '-q', '-c', 'feature/u');
    const out = run('status', 'TB-001', 'in-uitvoering', '--by', 's2');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /staat niet in deze checkout maar wel op branch feature\/t/);
  } finally {
    r.cleanup();
  }
});

test('a merge seen only on the fetched origin/main already stops writes on the work branch', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    const origin = addOrigin(r);
    pickedUp(ctx);
    assert.equal(run('status', 'FB-001', 'te-testen', '--by', 's1').status, 0);
    r.commit('FB-001 done');
    r.git('push', '-q', 'origin', 'feature/a');
    const server = path.join(r.dir, 'server-merge');
    execFileSync('git', ['clone', '-q', origin, server], { env: GIT_ENV });
    execFileSync('git', ['-C', server, 'merge', '-q', '--no-ff', '-m', 'Merge PR 7', 'origin/feature/a'], { env: GIT_ENV });
    execFileSync('git', ['-C', server, 'push', '-q', 'origin', 'main'], { env: GIT_ENV });
    r.git('fetch', '-q');

    const out = run('pr', 'FB-001', '7', '--by', 's1');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /staat al op main/);
  } finally {
    r.cleanup();
  }
});

test('a pickup is never written on main, and only the holder changes a ticket in progress', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    const out = run('status', 'FB-001', 'in-uitvoering', '--by', 's1', '--branch', 'feature/x');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /niet op main/);
    pickedUp(ctx);
    const other = run('log', 'FB-001', '--by', 's9', 'even tussendoor');
    assert.equal(other.status, 1);
    assert.match(other.stderr, /alleen die sessie wijzigt het ticket/);
  } finally {
    r.cleanup();
  }
});

test('a session cannot take a ticket back while another session holds it on a split-off copy', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    pickedUp(ctx);
    assert.equal(run('status', 'FB-001', 'klaar-voor-bouw', '--by', 's1', '--log', 'teruggegeven').status, 0);
    r.commit('Give FB-001 back');
    r.git('switch', '-q', 'main');
    pickedUp(ctx, 'feature/b', 's2');
    r.git('switch', '-q', 'feature/a');
    const out = run('status', 'FB-001', 'in-uitvoering', '--by', 's1');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /s2 houdt het ticket vast/);
  } finally {
    r.cleanup();
  }
});

test('a branch that only logged a line cannot pick up a ticket another session holds', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    r.git('switch', '-q', '-c', 'feature/x');
    assert.equal(run('log', 'FB-001', '--by', 's1', 'een regel').status, 0);
    r.commit('a log line');
    r.git('switch', '-q', 'main');
    pickedUp(ctx, 'feature/b', 's2');
    r.git('switch', '-q', 'feature/x');
    const out = run('status', 'FB-001', 'in-uitvoering', '--by', 's3');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /s2 houdt het ticket vast/);
  } finally {
    r.cleanup();
  }
});

test('a pickup starts from main, and the owner then cannot write over the holder', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    r.git('branch', 'feature/c');
    assert.equal(run('log', 'FB-001', '--by', 'eigenaar', 'een notitie').status, 0);
    r.commit('owner note');
    r.git('switch', '-q', 'feature/c');
    let out = run('status', 'FB-001', 'in-uitvoering', '--by', 's1');
    assert.equal(out.status, 1, 'main moved on for this ticket');
    assert.match(out.stderr, /git merge main/);
    r.git('merge', '-q', 'main');
    out = run('status', 'FB-001', 'in-uitvoering', '--by', 's1');
    assert.equal(out.status, 0, out.stderr);
    r.commit('Start FB-001');

    r.git('switch', '-q', 'main');
    out = run('block', 'FB-001', '--by', 'eigenaar', 'stop');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /s1 houdt het ticket vast: laat het aan die sessie/);
  } finally {
    r.cleanup();
  }
});

test('after the owner closed a ticket on main, a write on its old work branch is refused', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    pickedUp(ctx);
    assert.equal(run('status', 'FB-001', 'te-testen', '--by', 's1').status, 0);
    r.commit('FB-001 done');
    r.git('switch', '-q', 'main');
    r.git('merge', '-q', '--no-ff', '-m', 'merge a', 'feature/a');
    r.git('switch', '-q', 'feature/a');
    r.write(REL, `${r.read(REL).trimEnd()}\n- 2026-09-13 23:59 · s1 · achtergebleven regel\n`);
    r.commit('left behind after the merge');
    r.git('switch', '-q', 'main');
    assert.equal(run('status', 'FB-001', 'klaar', '--by', 'eigenaar').status, 0);
    r.commit('FB-001 closed');

    r.git('switch', '-q', 'feature/a');
    const out = run('log', 'FB-001', '--by', 's1', 'nog iets');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /Op main staat een nieuwere versie van FB-001: klaar/);
    assert.match(out.stderr, /git merge main/);
  } finally {
    r.cleanup();
  }
});

test('a ticket that exists on main but not yet in this branch asks for git merge main', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    r.git('branch', 'feature/old');
    readyTicket(ctx);
    r.git('switch', '-q', 'feature/old');
    const out = run('status', 'FB-001', 'in-uitvoering', '--by', 's1');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /staat nog niet in deze checkout maar wel op main\. Haal main binnen in je branch \(git merge main\)/);
  } finally {
    r.cleanup();
  }
});

test('a newer copy on the fetched origin/main names git pull on main, then git merge main', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    const origin = addOrigin(r);
    const other = path.join(r.dir, 'other-clone');
    execFileSync('git', ['clone', '-q', origin, other], { env: GIT_ENV });
    assert.equal(runIn(ctx, other, 'block', 'FB-001', '--by', 'eigenaar', 'wacht', 'even').status, 0);
    execFileSync('git', ['-C', other, 'commit', '-q', '-am', 'Block FB-001'], { env: GIT_ENV });
    execFileSync('git', ['-C', other, 'push', '-q', 'origin', 'main'], { env: GIT_ENV });

    r.git('fetch', '-q');
    r.git('switch', '-q', '-c', 'feature/z');
    const out = run('status', 'FB-001', 'in-uitvoering', '--by', 's1');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /git pull op main/);
  } finally {
    r.cleanup();
  }
});

test('the owner frees a ticket whose session stopped with release, and the next session takes it', () => {
  const { r, run, fill } = setup();
  try {
    r.git('switch', '-q', '-c', 'feature/t');
    assert.equal(run('new', 'TB', '--title', 'Werk dat bleef liggen', '--by', 's1').status, 0);
    const rel = ticketPath('TB', 1, 'werk-dat-bleef-liggen');
    fill(rel);
    r.commit('Add TB-001');

    let out = run('status', 'TB-001', 'klaar-voor-bouw', '--by', 'eigenaar');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /release/);
    assert.equal(run('release', 'TB-001', '--by', 'eigenaar').status, 1, 'a reason is required');
    out = run('release', 'TB-001', '--by', 'eigenaar', '--log', 'sessie gestopt');
    assert.equal(out.status, 0, out.stderr);
    r.commit('Release TB-001');

    out = run('status', 'TB-001', 'in-uitvoering', '--by', 's2');
    assert.equal(out.status, 0, out.stderr);
    assert.ok(fieldsOf(r, rel).worklog.some((w) => w.text === 'vrijgegeven: sessie gestopt (was in uitvoering door s1)'));
  } finally {
    r.cleanup();
  }
});

test('a pickup cannot name a branch other than its own checkout', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    r.git('switch', '-q', '-c', 'feature/x');
    const out = run('status', 'FB-001', 'in-uitvoering', '--by', 's1', '--branch', 'feature/y');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /--branch moet de branch van deze checkout zijn \(feature\/x\)/);
  } finally {
    r.cleanup();
  }
});

test('finished work waiting for its merge still claims the ticket against a re-pickup elsewhere', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    pickedUp(ctx);
    assert.equal(run('status', 'FB-001', 'klaar-voor-bouw', '--by', 's1', '--log', 'teruggegeven').status, 0);
    r.commit('Give FB-001 back');
    r.git('switch', '-q', 'main');
    pickedUp(ctx, 'feature/b', 's2');
    assert.equal(run('status', 'FB-001', 'te-testen', '--by', 's2').status, 0);
    r.commit('FB-001 done by s2, PR open');

    r.git('switch', '-q', 'feature/a');
    const out = run('status', 'FB-001', 'in-uitvoering', '--by', 's3');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /te-testen/);
    assert.match(out.stderr, /wacht op de merge van die branch/);
  } finally {
    r.cleanup();
  }
});

test('a pushed copy that a local give-back or release replaced no longer holds the ticket', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    addOrigin(r);
    pickedUp(ctx);
    r.git('push', '-q', 'origin', 'feature/a'); // pushed while held
    assert.equal(run('release', 'FB-001', '--by', 'eigenaar', '--log', 'sessie gestopt').status, 0);
    r.commit('Release FB-001'); // not pushed

    r.git('switch', '-q', 'main');
    r.git('switch', '-q', '-c', 'feature/b');
    let out = run('status', 'FB-001', 'in-uitvoering', '--by', 's2');
    assert.equal(out.status, 0, out.stderr);

    // with the local branch gone, only the stale pushed copy is left, and the message names git push
    r.git('checkout', '-q', '--', '.');
    r.git('switch', '-q', 'main');
    r.git('branch', '-D', 'feature/a', 'feature/b');
    r.git('switch', '-q', '-c', 'feature/c');
    out = run('status', 'FB-001', 'in-uitvoering', '--by', 's3');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /doe het dan opnieuw in een checkout van die branch en push, of verwijder de remote branch/);
    assert.match(out.stderr, /git fetch --prune/);
  } finally {
    r.cleanup();
  }
});

test('a blocked ticket released by the owner keeps its block until he answers it', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    pickedUp(ctx);
    assert.equal(run('block', 'FB-001', '--by', 's1', 'welke', 'discipline?').status, 0);
    r.commit('Block FB-001');
    assert.equal(run('release', 'FB-001', '--by', 'eigenaar', '--log', 'sessie gestopt').status, 0);
    r.commit('Release FB-001');

    r.git('switch', '-q', 'main');
    r.git('switch', '-q', '-c', 'feature/b');
    let out = run('status', 'FB-001', 'in-uitvoering', '--by', 's2');
    assert.equal(out.status, 1, 'the block on the released copy still counts');
    assert.match(out.stderr, /geblokkeerd \(welke discipline\?\)/);

    r.git('switch', '-q', 'feature/a');
    assert.equal(run('unblock', 'FB-001', '--by', 'eigenaar', 'beantwoord').status, 0);
    r.commit('Unblock FB-001');
    r.git('switch', '-q', 'feature/b');
    out = run('status', 'FB-001', 'in-uitvoering', '--by', 's2');
    assert.equal(out.status, 0, out.stderr);
  } finally {
    r.cleanup();
  }
});

/** Resolves a conflicted ticket file the documented way: main's frontmatter, every Werklog line of both sides. */
function resolveKeepingMain(r, rel) {
  const [, folder, file] = /^(.*)\/([^/]+)$/.exec(rel);
  const mainText = r.git('show', `main:${rel}`);
  const ours = parseTicket(r.git('show', `HEAD:${rel}`), { file, folder }).worklog;
  const theirs = parseTicket(mainText, { file, folder }).worklog;
  const lines = new Map();
  for (const w of [...ours, ...theirs]) lines.set(`${w.at}|${w.by}|${w.text}`, w);
  const worklog = [...lines.values()].sort((a, b) => a.at.localeCompare(b.at)).map((w) => `- ${w.at} · ${w.by} · ${w.text}`);
  r.write(rel, `${mainText.replace(/## Werklog[\s\S]*$/, '## Werklog\n\n')}${worklog.join('\n')}\n`);
}

test('after a conflicting git merge main, keeping main\'s frontmatter lets the next round start', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    pickedUp(ctx);
    assert.equal(run('status', 'FB-001', 'te-testen', '--by', 's1').status, 0);
    r.commit('FB-001 done');
    const doneCommit = r.git('rev-parse', 'HEAD');
    assert.equal(run('pr', 'FB-001', '52', '--by', 's1').status, 0);
    r.commit('FB-001 PR number');

    // the PR was merged at the te-testen commit, before the PR-number commit landed
    r.git('switch', '-q', 'main');
    r.git('merge', '-q', '--no-ff', '-m', 'merge PR', doneCommit);
    let out = run('status', 'FB-001', 'klaar-voor-bouw', '--by', 'eigenaar', '--log', 'Bevinding: knop ontbreekt');
    assert.equal(out.status, 0, out.stderr);
    r.commit('FB-001 back after the test');

    r.git('switch', '-q', 'feature/a');
    out = run('status', 'FB-001', 'in-uitvoering', '--by', 's1');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /houd dan de frontmatter van main/);
    assert.throws(() => r.git('merge', '-q', 'main'), 'the merge conflicts on the ticket file');
    resolveKeepingMain(r, REL);
    r.git('add', REL);
    r.git('commit', '-q', '--no-edit');

    out = run('status', 'FB-001', 'in-uitvoering', '--by', 's1', '--log', 'tweede ronde');
    assert.equal(out.status, 0, out.stderr);
  } finally {
    r.cleanup();
  }
});

test('the session holding a ticket keeps its hold when main moved on: the refusal says so, and the resolution works', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    pickedUp(ctx);

    // on main, the architect's sharpened text arrives with the Werklog line a hand edit requires
    r.git('switch', '-q', 'main');
    const sharpened = r
      .read(REL)
      .replace(/(## Aanleiding\n\n)Ingevuld\./, '$1Scherper verwoord door de architect.')
      .trimEnd();
    r.write(REL, `${sharpened}\n- 2026-09-13 23:58 · architect · tekst aangescherpt\n`);
    r.commit('Architect sharpens FB-001');

    r.git('switch', '-q', 'feature/a');
    let out = run('log', 'FB-001', '--by', 's1', 'bezig');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /jij houdt het ticket vast, dus houd status, opgepakt-door, branch en geblokkeerd van je branch/);

    // resolve as the refusal says: the branch's state fields, main's text, every Werklog line
    assert.throws(() => r.git('merge', '-q', 'main'), 'the merge conflicts on the ticket file');
    // the branch's own copy, from its commit: the working file holds conflict markers right now
    const own = parseTicket(r.git('show', `HEAD:${REL}`), { file: REL.slice(REL.lastIndexOf('/') + 1), folder: REL.slice(0, REL.lastIndexOf('/')) });
    resolveKeepingMain(r, REL);
    const f = own.fields;
    r.write(REL, setFields(r.read(REL), { status: f.status, 'opgepakt-door': f['opgepakt-door'], branch: f.branch, geblokkeerd: f.geblokkeerd }));
    r.git('add', REL);
    r.git('commit', '-q', '--no-edit');

    const p = fieldsOf(r);
    assert.equal(p.fields.status, 'in-uitvoering');
    assert.equal(p.fields['opgepakt-door'], 's1');
    assert.match(p.sections.find((s) => s.title === 'Aanleiding').body, /Scherper verwoord/);
    out = run('status', 'FB-001', 'te-testen', '--by', 's1');
    assert.equal(out.status, 0, out.stderr);
  } finally {
    r.cleanup();
  }
});

test('an uncommitted give-back in another worktree does not free the ticket yet', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    const wt = path.join(r.dir, 'wt-s1');
    r.git('worktree', 'add', '-q', '-b', 'feature/a', wt, 'main');
    assert.equal(runIn(ctx, wt, 'status', 'FB-001', 'in-uitvoering', '--by', 's1').status, 0);
    r.commit('Start FB-001', wt);
    assert.equal(runIn(ctx, wt, 'status', 'FB-001', 'klaar-voor-bouw', '--by', 's1', '--log', 'teruggegeven').status, 0); // not committed

    r.git('switch', '-q', '-c', 'feature/b');
    let out = run('status', 'FB-001', 'in-uitvoering', '--by', 's2');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /s1 houdt het ticket vast/);
    r.git('switch', '-q', 'main');
    r.commit('Give FB-001 back', wt);
    r.git('switch', '-q', 'feature/b');
    out = run('status', 'FB-001', 'in-uitvoering', '--by', 's2');
    assert.equal(out.status, 0, out.stderr);
  } finally {
    r.cleanup();
  }
});

test('a PR the owner will not merge: he sets the ticket back on its branch, and the next session starts from main', () => {
  const ctx = setup();
  const { r, run } = ctx;
  try {
    readyTicket(ctx);
    pickedUp(ctx);
    assert.equal(run('status', 'FB-001', 'te-testen', '--by', 's1').status, 0);
    r.commit('FB-001 done, PR open');
    r.git('switch', '-q', 'main');
    r.git('switch', '-q', '-c', 'feature/b');
    let out = run('status', 'FB-001', 'in-uitvoering', '--by', 's2');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /Wordt die PR niet gemerged/);

    r.git('switch', '-q', 'feature/a');
    assert.equal(run('status', 'FB-001', 'klaar-voor-bouw', '--by', 'eigenaar', '--log', 'PR niet gemerged').status, 0);
    r.commit('FB-001 back, PR not merged');
    r.git('switch', '-q', 'feature/b');
    out = run('status', 'FB-001', 'in-uitvoering', '--by', 's2');
    assert.equal(out.status, 0, out.stderr);
  } finally {
    r.cleanup();
  }
});

test('a repository without a main branch gets a Dutch message, without a developer prefix', () => {
  const ctx = setup();
  try {
    ctx.r.git('branch', '-m', 'main', 'trunk');
    const out = ctx.run('list');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /Er is geen lokale branch "main" in deze repo/);
    assert.doesNotMatch(out.stderr, /Unexpected/);
  } finally {
    ctx.r.cleanup();
  }
});

test('outside a repository the CLI says so in Dutch, without a stack trace', () => {
  const ctx = setup();
  try {
    const outside = path.join(ctx.r.dir, 'nergens');
    fs.mkdirSync(outside);
    const out = runIn(ctx, outside, 'list');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /hoort niet bij een git-repository/);
    assert.doesNotMatch(out.stderr, /\n\s+at /);
  } finally {
    ctx.r.cleanup();
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
