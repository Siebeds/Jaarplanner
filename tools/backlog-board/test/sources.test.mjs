import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildBoard } from '../lib/board.mjs';
import { allTicketIds, collectVersions } from '../lib/sources.mjs';
import { filledTicket, tempRepo, ticketPath } from './helpers.mjs';

const byId = (board) => Object.fromEntries(board.columns.flatMap((c) => c.cards.map((t) => [t.id, t])));
const FB1 = ticketPath('FB', 1);
const FB2 = ticketPath('FB', 2);
const TB1 = ticketPath('TB', 1);

function scenario() {
  const r = tempRepo();
  r.write(FB1, filledTicket({ number: 1, status: 'klaar-voor-bouw', updated: '2026-09-01 10:00' }));
  r.write(FB2, filledTicket({ number: 2, status: 'nieuw', updated: '2026-09-01 10:00' }));
  r.write('backlog/functionele-backlog/README.md', '# Uitleg, geen ticket\n');
  r.commit('base');
  r.git('branch', 'old'); // behind main once main moves: merged, so ignored

  r.write('elders.txt', 'x');
  r.commit('main moves on');

  r.git('switch', '-q', '-c', 'feature/a');
  r.write(FB1, filledTicket({ number: 1, status: 'in-uitvoering', by: 'sessie-a', branch: 'feature/a', updated: '2026-09-02 09:00' }));
  r.write(TB1, filledTicket({ prefix: 'TB', number: 1, status: 'klaar', updated: '2026-09-02 09:30' }));
  r.commit('work on FB-001, add TB-001');
  r.git('switch', '-q', 'main');

  r.git('branch', 'feature/b'); // same commit as main: merged, contributes nothing
  const wt = path.join(r.dir, 'wt');
  r.git('worktree', 'add', '-q', '-b', 'feature/c', wt, 'main');
  fs.writeFileSync(path.join(wt, FB2), filledTicket({ number: 2, status: 'klaar-voor-bouw', updated: '2026-09-03 08:00' }));
  return { r, wt };
}

test('main, the tickets an unmerged branch changed, and uncommitted worktree edits', async () => {
  const { r } = scenario();
  try {
    const { versions, sources } = await collectVersions(r.repo);
    assert.deepEqual(sources.branches, ['feature/a']);
    assert.equal(sources.worktrees.length, 2);
    assert.ok(!versions.some((v) => v.file === 'README.md'), 'README.md is not a ticket');
    // feature/a contributes exactly the two files it changed, not main's untouched FB-002.
    assert.deepEqual(
      versions.filter((v) => v.source.type === 'branch').map((v) => v.file).sort(),
      ['FB-001-een-ticket.md', 'TB-001-een-ticket.md'],
    );

    const t = byId(buildBoard(versions));
    assert.equal(t['FB-001'].column, 'in-uitvoering');
    assert.equal(t['FB-001'].source.name, 'feature/a');
    assert.equal(t['TB-001'].column, 'in-review');
    assert.equal(t['TB-001'].onMain, false);
    assert.equal(t['FB-002'].column, 'klaar-voor-bouw');
    assert.equal(t['FB-002'].source.type, 'worktree');
    assert.equal(t['FB-002'].source.branch, 'feature/c');
  } finally {
    r.cleanup();
  }
});

test('after the merge the final statuses show from main, and the branch drops out', async () => {
  const { r, wt } = scenario();
  try {
    r.git('switch', '-q', 'feature/a');
    r.write(FB1, filledTicket({ number: 1, status: 'te-testen', by: 'sessie-a', branch: 'feature/a', updated: '2026-09-02 11:00', fields: { 'opgepakt-door': 'sessie-a' } }));
    r.commit('FB-001 done');
    assert.equal(byId(buildBoard((await collectVersions(r.repo)).versions))['FB-001'].column, 'in-review');

    r.git('switch', '-q', 'main');
    r.git('merge', '-q', '--no-ff', '-m', 'merge a', 'feature/a');
    fs.rmSync(path.join(wt, FB2)); // discard the worktree edit
    r.git('-C', wt, 'checkout', '--', FB2);

    const { versions, sources } = await collectVersions(r.repo);
    assert.deepEqual(sources.branches, []);
    const t = byId(buildBoard(versions));
    assert.equal(t['FB-001'].column, 'te-testen');
    assert.equal(t['TB-001'].column, 'klaar');
    assert.equal(t['FB-002'].column, 'nieuw');
    assert.ok(versions.every((v) => v.source.type === 'main'));
  } finally {
    r.cleanup();
  }
});

test('an uncommitted edit in the main checkout itself counts as a worktree version', async () => {
  const r = tempRepo();
  try {
    r.write(FB1, filledTicket({ number: 1, status: 'nieuw', updated: '2026-09-01 10:00' }));
    r.commit('base');
    r.write(FB1, filledTicket({ number: 1, status: 'klaar-voor-bouw', updated: '2026-09-01 11:00' }));
    const t = byId(buildBoard((await collectVersions(r.repo)).versions));
    assert.equal(t['FB-001'].column, 'klaar-voor-bouw');
    assert.equal(t['FB-001'].source.type, 'worktree');
  } finally {
    r.cleanup();
  }
});

test('allTicketIds sees merged branches and uncommitted files too, so numbers are never handed out twice', async () => {
  const { r, wt } = scenario();
  try {
    r.git('switch', '-q', '-c', 'feature/d');
    r.write(ticketPath('TB', 7), filledTicket({ prefix: 'TB', number: 7 }));
    r.commit('TB-007 on a side branch');
    r.git('switch', '-q', 'main');
    r.write(ticketPath('TB', 9), filledTicket({ prefix: 'TB', number: 9 }), wt);
    const ids = await allTicketIds(r.repo);
    for (const id of ['FB-001', 'FB-002', 'TB-001', 'TB-007', 'TB-009']) assert.ok(ids.has(id), id);
  } finally {
    r.cleanup();
  }
});
