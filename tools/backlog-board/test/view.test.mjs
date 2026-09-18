import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createdFrom, matchesFilters, nextSort, sortTickets } from '../public/view.js';

const t = (id, fields = {}) => ({
  id,
  prefix: id.slice(0, 2),
  file: `${id}-x.md`,
  fields: { titel: `Ticket ${id}`, prioriteit: 'middel', aangemaakt: '2026-09-01', bijgewerkt: '2026-09-01 10:00', ...fields },
});

// Thursday 18 September 2026.
const today = new Date(2026, 8, 18, 15, 30);

test('the creation-date ranges start on the right day, today included', () => {
  assert.equal(createdFrom('alles', today), null);
  assert.equal(createdFrom('vandaag', today), '2026-09-18');
  assert.equal(createdFrom('week', today), '2026-09-14', 'a week starts on Monday');
  assert.equal(createdFrom('7', today), '2026-09-12');
  assert.equal(createdFrom('30', today), '2026-08-20');
});

test('this week on a Sunday still starts on the Monday before it', () => {
  assert.equal(createdFrom('week', new Date(2026, 8, 20)), '2026-09-14');
  assert.equal(createdFrom('week', new Date(2026, 8, 14)), '2026-09-14');
});

test('the creation-date filter keeps the first day of the range and drops the day before', () => {
  const inRange = t('FB-001', { aangemaakt: '2026-09-12' });
  const before = t('FB-002', { aangemaakt: '2026-09-11' });
  assert.equal(matchesFilters(inRange, { created: '7' }, today), true);
  assert.equal(matchesFilters(before, { created: '7' }, today), false);
  assert.equal(matchesFilters(t('FB-003', { aangemaakt: undefined }), { created: '7' }, today), false);
  assert.equal(matchesFilters(before, { created: 'alles' }, today), true);
});

test('the priority filter combines with kind and search', () => {
  const hoogFb = t('FB-010', { prioriteit: 'hoog', titel: 'Thema dupliceren' });
  const hoogTb = t('TB-010', { prioriteit: 'hoog' });
  const laagFb = t('FB-011', { prioriteit: 'laag', titel: 'Thema dupliceren' });
  assert.equal(matchesFilters(hoogFb, { prio: 'hoog' }), true);
  assert.equal(matchesFilters(laagFb, { prio: 'hoog' }), false);
  assert.equal(matchesFilters(hoogTb, { prio: 'hoog', kind: 'FB' }), false);
  assert.equal(matchesFilters(hoogFb, { prio: 'hoog', q: 'dupliceren' }), true);
  assert.equal(matchesFilters(hoogFb, { prio: 'hoog', q: 'woordweb' }), false);
});

test('sorting by number is numeric, not alphabetical, and flips with the direction', () => {
  const list = [t('FB-100'), t('FB-9'), t('FB-20')];
  assert.deepEqual(sortTickets(list, 'nummer', 'asc').map((x) => x.id), ['FB-9', 'FB-20', 'FB-100']);
  assert.deepEqual(sortTickets(list, 'nummer', 'desc').map((x) => x.id), ['FB-100', 'FB-20', 'FB-9']);
});

test('sorting by priority puts hoog first and breaks ties by number', () => {
  const list = [t('FB-3', { prioriteit: 'laag' }), t('FB-2', { prioriteit: 'hoog' }), t('FB-1', { prioriteit: 'middel' }), t('FB-0', { prioriteit: 'hoog' })];
  assert.deepEqual(sortTickets(list, 'prioriteit').map((x) => x.id), ['FB-0', 'FB-2', 'FB-1', 'FB-3']);
});

test('the date sorts start newest first', () => {
  const list = [t('FB-1', { aangemaakt: '2026-09-01' }), t('FB-2', { aangemaakt: '2026-09-18' }), t('FB-3', { aangemaakt: '2026-09-10' })];
  assert.deepEqual(sortTickets(list, 'aangemaakt').map((x) => x.id), ['FB-2', 'FB-3', 'FB-1']);
  const upd = [t('FB-1', { bijgewerkt: '2026-09-01 09:00' }), t('FB-2', { bijgewerkt: '2026-09-01 17:00' })];
  assert.deepEqual(sortTickets(upd, 'bijgewerkt').map((x) => x.id), ['FB-2', 'FB-1']);
});

test('the standard sort keeps the incoming order and never changes the input', () => {
  const list = [t('FB-2'), t('FB-1'), t('FB-3')];
  assert.deepEqual(sortTickets(list, 'standaard').map((x) => x.id), ['FB-2', 'FB-1', 'FB-3']);
  assert.deepEqual(sortTickets(list, 'standaard', 'desc').map((x) => x.id), ['FB-3', 'FB-1', 'FB-2']);
  sortTickets(list, 'nummer');
  assert.deepEqual(list.map((x) => x.id), ['FB-2', 'FB-1', 'FB-3']);
});

test('a header click flips the active sort and starts another in its default direction', () => {
  assert.deepEqual(nextSort({ sort: 'standaard', dir: 'asc' }, 'nummer'), { sort: 'nummer', dir: 'asc' });
  assert.deepEqual(nextSort({ sort: 'nummer', dir: 'asc' }, 'nummer'), { sort: 'nummer', dir: 'desc' });
  assert.deepEqual(nextSort({ sort: 'nummer', dir: 'desc' }, 'aangemaakt'), { sort: 'aangemaakt', dir: 'desc' });
});
