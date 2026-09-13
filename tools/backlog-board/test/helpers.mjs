import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FOLDERS } from '../lib/format.mjs';
import { renderNewTicket, setFields } from '../lib/write.mjs';

export const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
};

/** A ticket that passes validation: the template with every section filled in. */
export function filledTicket({
  prefix = 'FB',
  number = 1,
  title = 'Een ticket',
  status = 'nieuw',
  priority = 'middel',
  by = 'tester',
  branch = '',
  updated,
  fields = {},
} = {}) {
  let text = renderNewTicket({ prefix, number, title, status, priority, by, branch, now: new Date(2026, 8, 1, 10, 0) });
  text = text.replace(/(## Acceptatiecriteria\n\n)<!--[\s\S]*?-->/, '$1- [ ] Gegeven a, wanneer b, dan c\n- [x] Gegeven d, wanneer e, dan f');
  text = text.replace(/<!--[\s\S]*?-->/g, 'Ingevuld.');
  const all = { ...fields, ...(updated ? { bijgewerkt: updated } : {}) };
  return Object.keys(all).length ? setFields(text, all) : text;
}

export function ticketPath(prefix, number, slug = 'een-ticket') {
  return `${FOLDERS[prefix]}/${prefix}-${String(number).padStart(3, '0')}-${slug}.md`;
}

export function tempRepo() {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'backlogbord-')));
  const repo = path.join(dir, 'repo');
  fs.mkdirSync(repo);
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', env: GIT_ENV }).trim();
  git('init', '-q', '-b', 'main');
  git('config', 'core.autocrlf', 'false');
  return {
    dir,
    repo,
    git,
    write(rel, text, base = repo) {
      const full = path.join(base, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, text);
    },
    read(rel, base = repo) {
      return fs.readFileSync(path.join(base, rel), 'utf8');
    },
    commit(message, base = repo) {
      execFileSync('git', ['-C', base, 'add', '-A'], { env: GIT_ENV });
      execFileSync('git', ['-C', base, 'commit', '-q', '-m', message], { env: GIT_ENV });
    },
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
    },
  };
}
