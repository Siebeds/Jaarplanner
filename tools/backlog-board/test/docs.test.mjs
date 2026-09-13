// backlog/TICKETS.md is the people's copy of lib/format.mjs. This keeps the two from drifting: every
// status, column, key and section the code knows must be named in the guide.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { COLUMNS, FOLDERS, KEYS, PRIORITIES, SECTIONS, STATUSES } from '../lib/format.mjs';

const guide = fs.readFileSync(new URL('../../../backlog/TICKETS.md', import.meta.url), 'utf8');

test('TICKETS.md names every status, column, key, priority, folder and section of the format', () => {
  const missing = [
    ...STATUSES.map((s) => `\`${s}\``),
    ...COLUMNS.map((c) => c.title),
    ...KEYS.map((k) => `\`${k}\``),
    ...PRIORITIES.map((p) => `\`${p}\``),
    ...Object.values(FOLDERS).map((f) => `\`${f}/\``),
    ...[...SECTIONS.FB, ...SECTIONS.TB],
  ].filter((needle) => !guide.includes(needle));
  assert.deepEqual(missing, []);
});
