// Collects every version of every ticket the board should know about, from git and from disk,
// without changing anything: no fetch, no checkout, no write.
//
// Sources, and what each contributes:
//   main       every ticket file on the local `main` branch (the baseline everyone pulls).
//   branch     each local branch NOT merged into main, but only the ticket files it changed since
//              it forked from main. A file a branch never touched is main's old copy, and showing it
//              would let a stale status compete with the current one.
//   worktree   each checked-out worktree, but only ticket files whose working copy differs from its
//              own HEAD: the uncommitted edits. Committed work is already covered by its branch.
// A worktree on a detached, unmerged HEAD counts as a branch source as well.

import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { FOLDERS, IGNORED_FILES } from './format.mjs';
import { normalise } from './parse.mjs';

const execFileAsync = promisify(execFile);
const TICKET_PATHS = Object.values(FOLDERS);

async function git(root, args) {
  const { stdout } = await execFileAsync('git', ['-C', root, ...args], {
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  return stdout;
}

export async function repoRoot(from = process.cwd()) {
  return path.resolve((await git(from, ['rev-parse', '--show-toplevel'])).trim());
}

/** The main worktree (the one holding `.git`), so labels read the same from whichever checkout runs this. */
export async function mainRoot(from = process.cwd()) {
  const common = path.resolve((await git(from, ['rev-parse', '--path-format=absolute', '--git-common-dir'])).trim());
  return path.basename(common) === '.git' ? path.dirname(common) : repoRoot(from);
}

export async function remoteWebUrl(root) {
  try {
    const url = (await git(root, ['remote', 'get-url', 'origin'])).trim();
    const m = /github\.com[:/](.+?)(?:\.git)?$/.exec(url);
    return m ? `https://github.com/${m[1]}` : null;
  } catch {
    return null;
  }
}

export function createCache() {
  return { trees: new Map(), blobs: new Map(), mergeBases: new Map(), merged: { key: null, refs: new Set() } };
}

/** Ticket files in a commit, as [{ folder, file, path, blob }]. Cached per commit: a commit never changes. */
async function tree(root, cache, commit) {
  if (cache.trees.has(commit)) return cache.trees.get(commit);
  const out = await git(root, ['ls-tree', '-r', commit, '--', ...TICKET_PATHS]);
  const entries = [];
  for (const line of out.split('\n')) {
    const m = /^\d+ blob ([0-9a-f]+)\t(.+)$/.exec(line);
    if (!m) continue;
    const repoPath = m[2];
    const folder = path.posix.dirname(repoPath);
    if (!TICKET_PATHS.includes(folder)) continue; // nested folders are not part of the format
    if (IGNORED_FILES.includes(path.posix.basename(repoPath))) continue;
    entries.push({ folder, file: path.posix.basename(repoPath), path: repoPath, blob: m[1] });
  }
  cache.trees.set(commit, entries);
  return entries;
}

/** Reads blobs through one `git cat-file --batch` process, caching by blob id. */
async function readBlobs(root, cache, ids) {
  const missing = [...new Set(ids)].filter((id) => !cache.blobs.has(id));
  if (missing.length === 0) return;
  const output = await new Promise((resolve, reject) => {
    const child = spawn('git', ['-C', root, 'cat-file', '--batch'], { windowsHide: true });
    const chunks = [];
    child.stdout.on('data', (c) => chunks.push(c));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`git cat-file exit ${code}`))));
    child.stdin.end(missing.join('\n') + '\n');
  });
  let offset = 0;
  while (offset < output.length) {
    const headerEnd = output.indexOf(0x0a, offset);
    const [id, type, size] = output.subarray(offset, headerEnd).toString('utf8').split(' ');
    if (type !== 'blob') {
      offset = headerEnd + 1;
      continue;
    }
    const start = headerEnd + 1;
    const length = Number(size);
    cache.blobs.set(id, normalise(output.subarray(start, start + length).toString('utf8')));
    offset = start + length + 1; // content is followed by a newline
  }
}

async function mergeBase(root, cache, main, commit) {
  const key = `${main}..${commit}`;
  if (!cache.mergeBases.has(key)) {
    let base = null;
    try {
      base = (await git(root, ['merge-base', main, commit])).trim() || null;
    } catch {
      base = null; // unrelated history: treat every ticket file on it as changed
    }
    cache.mergeBases.set(key, base);
  }
  return cache.mergeBases.get(key);
}

async function refs(root, patterns) {
  const out = await git(root, ['for-each-ref', '--format=%(objectname) %(refname)', ...patterns]);
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha, ref] = line.split(' ');
      return { sha, ref, name: ref.replace(/^refs\/heads\//, '').replace(/^refs\/remotes\//, '') };
    });
}

async function mergedRefs(root, cache, main, all, patterns) {
  const key = main + '|' + patterns.join(',') + '|' + all.map((r) => r.sha).join(',');
  if (cache.merged.key !== key) {
    const out = await git(root, ['for-each-ref', `--merged=${main}`, '--format=%(refname)', ...patterns]);
    cache.merged = { key, refs: new Set(out.split('\n').filter(Boolean)) };
  }
  return cache.merged.refs;
}

export async function worktrees(root) {
  const out = await git(root, ['worktree', 'list', '--porcelain']);
  const list = [];
  let current = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) {
      current = { path: path.resolve(line.slice(9)), head: null, branch: null, bare: false, prunable: false };
      list.push(current);
    } else if (!current) continue;
    else if (line.startsWith('HEAD ')) current.head = line.slice(5);
    else if (line.startsWith('branch ')) current.branch = line.slice(7).replace(/^refs\/heads\//, '');
    else if (line === 'bare') current.bare = true;
    else if (line.startsWith('prunable')) current.prunable = true;
  }
  return list.filter((w) => !w.bare && !w.prunable && w.head);
}

async function isAncestor(root, commit, of) {
  try {
    await git(root, ['merge-base', '--is-ancestor', commit, of]);
    return true;
  } catch {
    return false;
  }
}

export async function readWorkingFiles(dir) {
  const files = [];
  for (const folder of TICKET_PATHS) {
    let names;
    try {
      names = await fs.readdir(path.join(dir, folder), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of names) {
      if (!entry.isFile() || IGNORED_FILES.includes(entry.name)) continue;
      try {
        const text = normalise(await fs.readFile(path.join(dir, folder, entry.name), 'utf8'));
        files.push({ folder, file: entry.name, path: `${folder}/${entry.name}`, text });
      } catch {
        // deleted between readdir and readFile: skip, the next poll sees the truth
      }
    }
  }
  return files;
}

function relative(root, dir) {
  const rel = path.relative(root, dir).split(path.sep).join('/');
  return rel === '' ? '.' : rel;
}

/**
 * @param {{ remotes?: boolean }} options  `remotes` also reads unmerged remote-tracking branches
 *   (`refs/remotes`). The board never does (it shows this PC); the CLI's stale-copy guard does, so a
 *   branch another machine pushed and this clone fetched still counts.
 * @returns {Promise<{ versions: Array<{ source: object, folder: string, file: string, text: string }>, sources: object[] }>}
 */
export async function collectVersions(root, cache = createCache(), { remotes = false } = {}) {
  const patterns = remotes ? ['refs/heads', 'refs/remotes'] : ['refs/heads'];
  const heads = (await refs(root, patterns)).filter((r) => !r.ref.endsWith('/HEAD'));
  const main = heads.find((r) => r.ref === 'refs/heads/main');
  if (!main) throw new Error('Er is geen lokale branch "main" in deze repo.');
  const merged = await mergedRefs(root, cache, main.sha, heads, patterns);
  const trees = await worktrees(root);

  // Commit sources: main, unmerged branches, and detached unmerged worktree HEADs. A remote-tracking
  // branch at the same commit as a local one adds nothing, so it is skipped.
  const commitSources = [{ source: { type: 'main', name: 'main' }, sha: main.sha }];
  for (const r of heads) {
    if (r.ref === main.ref || merged.has(r.ref)) continue;
    if (commitSources.some((c) => c.sha === r.sha)) continue;
    const remote = r.ref.startsWith('refs/remotes/');
    commitSources.push({ source: { type: 'branch', name: r.name, ...(remote ? { remote: true } : {}) }, sha: r.sha });
  }
  for (const w of trees) {
    if (w.branch || w.head === main.sha) continue;
    if (commitSources.some((c) => c.sha === w.head)) continue;
    if (await isAncestor(root, w.head, main.sha)) continue;
    commitSources.push({ source: { type: 'branch', name: `${relative(root, w.path)} (losse HEAD)` }, sha: w.head });
  }

  const wanted = []; // { source, entry }
  for (const c of commitSources) {
    const entries = await tree(root, cache, c.sha);
    if (c.source.type === 'main') {
      for (const entry of entries) wanted.push({ source: c.source, entry });
      continue;
    }
    const base = await mergeBase(root, cache, main.sha, c.sha);
    const baseBlobs = new Map((base ? await tree(root, cache, base) : []).map((e) => [e.path, e.blob]));
    for (const entry of entries) {
      if (baseBlobs.get(entry.path) !== entry.blob) wanted.push({ source: c.source, entry });
    }
  }

  // Worktrees: uncommitted edits only.
  const worktreeVersions = [];
  const headBlobIds = [];
  const perWorktree = [];
  for (const w of trees) {
    const headEntries = await tree(root, cache, w.head);
    headBlobIds.push(...headEntries.map((e) => e.blob));
    perWorktree.push({ w, headEntries, files: await readWorkingFiles(w.path) });
  }
  await readBlobs(root, cache, [...wanted.map((x) => x.entry.blob), ...headBlobIds]);

  for (const { w, headEntries, files } of perWorktree) {
    const committed = new Map(headEntries.map((e) => [e.path, cache.blobs.get(e.blob)]));
    for (const f of files) {
      if (committed.get(f.path) === f.text) continue;
      worktreeVersions.push({
        source: { type: 'worktree', name: relative(root, w.path), branch: w.branch },
        folder: f.folder,
        file: f.file,
        text: f.text,
      });
    }
  }

  const versions = [
    ...wanted.map(({ source, entry }) => ({ source, folder: entry.folder, file: entry.file, text: cache.blobs.get(entry.blob) })),
    ...worktreeVersions,
  ];
  return {
    versions,
    sources: {
      main: main.sha.slice(0, 7),
      branches: commitSources.filter((c) => c.source.type === 'branch').map((c) => c.source.name),
      worktrees: trees.map((w) => ({ path: relative(root, w.path), branch: w.branch })),
    },
  };
}

/**
 * Every ticket id that exists anywhere this machine can see: all local and remote-tracking branches
 * (merged ones included) and every worktree's working files. Used to pick the next free number, so
 * it deliberately over-counts rather than risk handing out a number twice.
 */
export async function allTicketIds(root) {
  const all = await refs(root, ['refs/heads', 'refs/remotes']);
  const ids = new Set();
  const add = (file) => {
    const m = /^(FB|TB)-(\d{3,})-/.exec(file);
    if (m) ids.add(`${m[1]}-${m[2]}`);
  };
  const cache = createCache();
  for (const r of all) {
    if (r.ref.endsWith('/HEAD')) continue;
    for (const e of await tree(root, cache, r.sha)) add(e.file);
  }
  for (const w of await worktrees(root)) {
    for (const f of await readWorkingFiles(w.path)) add(f.file);
  }
  return ids;
}
