#!/usr/bin/env node
// The local backlog board: a read-only HTTP server on localhost that shows the ticket folders as a
// kanban board and pushes changes to the page as they happen. It reads git and the disk; it never
// fetches, pulls, checks out or writes.
//
//   node tools/backlog-board/server.mjs [--port 5199] [--repo <path>] [--open]

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { buildBoard } from './lib/board.mjs';
import { collectVersions, createCache, mainRoot, remoteWebUrl } from './lib/sources.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const { values } = parseArgs({
  options: {
    port: { type: 'string', default: '5199' },
    repo: { type: 'string' },
    open: { type: 'boolean', default: false },
    interval: { type: 'string', default: '3000' },
  },
});

const port = Number(values.port);
const interval = Math.max(1000, Number(values.interval));
const root = await mainRoot(values.repo ? path.resolve(values.repo) : here);
const remote = await remoteWebUrl(root);
const cache = createCache();

const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/markdown.js': ['markdown.js', 'text/javascript; charset=utf-8'],
  '/view.js': ['view.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
};

let payload = null; // the last board sent, as a JSON string
let fingerprint = null; // the same board without its timestamp, to detect real changes
const clients = new Set();

async function refresh() {
  let next;
  try {
    const { versions, sources } = await collectVersions(root, cache);
    next = { ok: true, remote, sources, ...buildBoard(versions) };
  } catch (e) {
    next = { ok: false, error: e.message };
  }
  const print = JSON.stringify(next);
  if (print === fingerprint) return;
  fingerprint = print;
  payload = JSON.stringify({ ...next, generatedAt: new Date().toISOString() });
  for (const res of clients) res.write(`event: board\ndata: ${payload}\n\n`);
}

async function loop() {
  await refresh();
  setTimeout(loop, interval);
}

// Only answer requests addressed to this machine by name, so a web page elsewhere cannot read the
// board through a DNS-rebinding trick.
function hostAllowed(req) {
  const host = (req.headers.host ?? '').toLowerCase();
  return [`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`].includes(host);
}

const HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'",
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};

async function handle(req, res) {
  if (!hostAllowed(req)) {
    res.writeHead(403, HEADERS).end('Alleen bereikbaar via localhost.');
    return;
  }
  if (req.method !== 'GET') {
    res.writeHead(405, HEADERS).end();
    return;
  }
  let url;
  try {
    url = new URL(req.url, `http://localhost:${port}`);
  } catch {
    res.writeHead(400, HEADERS).end('Ongeldige aanvraag.');
    return;
  }
  if (url.pathname === '/api/board') {
    if (!payload) await refresh();
    res.writeHead(200, { ...HEADERS, 'Content-Type': 'application/json; charset=utf-8' }).end(payload);
    return;
  }
  if (url.pathname === '/api/events') {
    res.writeHead(200, { ...HEADERS, 'Content-Type': 'text/event-stream', Connection: 'keep-alive' });
    res.write('retry: 2000\n\n');
    if (payload) res.write(`event: board\ndata: ${payload}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  const hit = STATIC[url.pathname];
  if (!hit) {
    res.writeHead(404, HEADERS).end('Niet gevonden.');
    return;
  }
  const body = await fs.readFile(path.join(here, 'public', hit[0]));
  res.writeHead(200, { ...HEADERS, 'Content-Type': hit[1] }).end(body);
}

// One bad request must never take the board down: every failure becomes a response.
const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    console.error(`Fout bij ${req.url}: ${e.message}`);
    if (!res.headersSent) res.writeHead(500, HEADERS);
    res.end();
  });
});

// Keep proxies and the browser from closing an idle event stream.
setInterval(() => {
  for (const res of clients) res.write(': keep-alive\n\n');
}, 20000).unref();

function openBrowser(url) {
  const [cmd, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true }).unref();
}

server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `Poort ${port} is al in gebruik. Kies een andere met --port.` : e.message);
  process.exit(1);
});

server.listen(port, '127.0.0.1', async () => {
  const url = `http://localhost:${port}`;
  console.log(`Backlogbord: ${url}`);
  console.log(`Leest ${root} (main, niet-gemergde branches en worktrees), elke ${interval / 1000} s.`);
  await loop();
  if (values.open) openBrowser(url);
});
