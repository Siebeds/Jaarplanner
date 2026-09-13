import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBoard, columnOf } from '../lib/board.mjs';
import { FOLDERS } from '../lib/format.mjs';
import { filledTicket } from './helpers.mjs';

const version = (type, text, { file = 'FB-001-een-ticket.md', folder = FOLDERS.FB, name = type } = {}) => ({
  source: { type, name },
  folder,
  file,
  text,
});
const cards = (board) => board.columns.flatMap((c) => c.cards);

test('columnOf: a final status off main is In review, on main it is itself', () => {
  assert.equal(columnOf('te-testen', 'branch'), 'in-review');
  assert.equal(columnOf('klaar', 'worktree'), 'in-review');
  assert.equal(columnOf('te-testen', 'main'), 'te-testen');
  assert.equal(columnOf('in-uitvoering', 'worktree'), 'in-uitvoering');
});

test('the newest bijgewerkt wins, wherever it is', () => {
  const board = buildBoard([
    version('main', filledTicket({ status: 'klaar-voor-bouw', updated: '2026-09-02 10:00' })),
    version('branch', filledTicket({ status: 'in-uitvoering', by: 's', branch: 'b', updated: '2026-09-01 10:00' })),
  ]);
  const [t] = cards(board);
  assert.equal(t.column, 'klaar-voor-bouw');
  assert.equal(t.source.type, 'main');
  assert.equal(t.versions.length, 2);
});

test('on a tie the version closest to the work wins', () => {
  const at = '2026-09-02 10:00';
  const board = buildBoard([
    version('main', filledTicket({ status: 'klaar-voor-bouw', updated: at })),
    version('worktree', filledTicket({ status: 'in-uitvoering', by: 's', branch: 'b', updated: at })),
  ]);
  assert.equal(cards(board)[0].column, 'in-uitvoering');
});

test('an invalid newer version does not win, but it is reported on the card', () => {
  const broken = filledTicket({ updated: '2026-09-05 10:00' }).replace('## Aanleiding', '## Iets anders');
  const board = buildBoard([version('main', filledTicket({ status: 'klaar-voor-bouw' })), version('branch', broken, { name: 'feature/x' })]);
  const [t] = cards(board);
  assert.equal(t.column, 'klaar-voor-bouw');
  assert.ok(t.warnings.some((w) => w.includes('branch feature/x volgt de structuur niet')));
  assert.equal(board.invalid.length, 0);
});

test('a ticket with no valid version is off the board and listed as invalid', () => {
  const board = buildBoard([version('main', 'rommel', { file: 'FB-009-x.md' })]);
  assert.equal(cards(board).length, 0);
  assert.equal(board.invalid.length, 1);
  assert.equal(board.invalid[0].id, 'FB-009');
});

test('two files with the same number are both flagged and taken off the board', () => {
  const board = buildBoard([
    version('main', filledTicket({ prefix: 'TB', number: 3 }), { file: 'TB-003-een-ticket.md', folder: FOLDERS.TB }),
    version('branch', filledTicket({ prefix: 'TB', number: 3 }), { file: 'TB-003-iets-anders.md', folder: FOLDERS.TB }),
  ]);
  assert.equal(cards(board).length, 0);
  assert.equal(board.invalid.length, 2);
  assert.ok(board.invalid.every((t) => t.errors.some((e) => e.includes('wordt door 2 bestanden gebruikt'))));
});

test('a ticket seen only on a branch is marked as not on main', () => {
  const board = buildBoard([version('branch', filledTicket({ prefix: 'TB', status: 'in-uitvoering', by: 's', branch: 'b' }), { file: 'TB-001-een-ticket.md', folder: FOLDERS.TB })]);
  assert.equal(cards(board)[0].onMain, false);
});

test('cards are ordered by priority in the planning columns and by recency in the others', () => {
  const t = (n, prio, status, updated, extra = {}) =>
    version('main', filledTicket({ number: n, priority: prio, status, updated, ...extra }), { file: `FB-00${n}-een-ticket.md` });
  const board = buildBoard([
    t(1, 'laag', 'klaar-voor-bouw', '2026-09-03 10:00'),
    t(2, 'hoog', 'klaar-voor-bouw', '2026-09-01 10:00'),
    t(3, 'laag', 'te-testen', '2026-09-01 10:00'),
    t(4, 'hoog', 'te-testen', '2026-09-03 10:00'),
  ]);
  const col = (id) => board.columns.find((c) => c.id === id).cards.map((c) => c.id);
  assert.deepEqual(col('klaar-voor-bouw'), ['FB-002', 'FB-001']);
  assert.deepEqual(col('te-testen'), ['FB-004', 'FB-003']);
});
