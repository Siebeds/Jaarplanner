// The board page. It holds no ticket logic of its own: the server parses, validates and places
// every ticket, and this file only draws what it is sent and keeps the filters.

import { esc, renderMarkdown } from './markdown.js';

const KIND = { FB: 'Functioneel', TB: 'Technisch' };
const STATUS = {
  nieuw: 'Nieuw',
  'klaar-voor-bouw': 'Klaar voor bouw',
  'in-uitvoering': 'In uitvoering',
  'te-testen': 'Te testen',
  klaar: 'Klaar',
};
const HINT = {
  nieuw: 'nog te verfijnen',
  'klaar-voor-bouw': 'mag opgepakt worden',
  'in-uitvoering': 'een sessie werkt eraan',
  'in-review': 'klaar, wacht op de merge',
  'te-testen': 'op main, klaar om te testen',
  klaar: 'afgerond',
};
const DONE_LIMIT = 12;
const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

const $ = (sel) => document.querySelector(sel);
const el = {
  meta: $('#meta'),
  board: $('#board'),
  invalid: $('#invalid'),
  error: $('#error'),
  dialog: $('#detail'),
  drawer: $('#drawer'),
  q: $('#q'),
};

// The kind filter and the Klaar toggle persist; the search does not, because a remembered search
// would silently hide cards on the next visit.
const prefs = { kind: 'alle', allDone: false, ...loadPrefs(), q: '' };
let data = null;
let live = false;
let openKey = null;
let drawerHtml = '';
let pendingHash = decodeURIComponent(location.hash.slice(1)) || null;

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem('backlogbord') ?? '{}');
  } catch {
    return {};
  }
}

function savePrefs() {
  try {
    localStorage.setItem('backlogbord', JSON.stringify({ kind: prefs.kind, allDone: prefs.allDone }));
  } catch {
    // private window or blocked storage: the filters just do not persist
  }
}

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const kindClass = (t) => (t.prefix === 'TB' ? 'tb' : 'fb');
const allTickets = () => (data?.ok ? [...data.columns.flatMap((c) => c.cards), ...data.invalid] : []);
const columnTitle = (id) => data?.columns?.find((c) => c.id === id)?.title ?? 'Ongeldig';

function formatWhen(stamp) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})$/.exec(stamp ?? '');
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today - d) / 86400000);
  if (days === 0) return `vandaag ${m[4]}`;
  if (days === 1) return `gisteren ${m[4]}`;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}${d.getFullYear() !== today.getFullYear() ? ` ${m[1]}` : ''}`;
}

function matches(t) {
  if (prefs.kind !== 'alle' && t.prefix !== prefs.kind) return false;
  const q = prefs.q.trim().toLowerCase();
  if (!q) return true;
  return [t.id, t.file, t.fields.titel, t.fields['opgepakt-door'], t.fields.branch].some((v) => (v ?? '').toLowerCase().includes(q));
}

function prLink(pr) {
  if (!pr) return 'geen';
  if (/^https:\/\//.test(pr)) return `<a href="${esc(pr)}" target="_blank" rel="noreferrer noopener">${esc(pr)}</a>`;
  const n = pr.replace(/^#/, '');
  return data?.remote
    ? `<a href="${esc(`${data.remote}/pull/${n}`)}" target="_blank" rel="noreferrer noopener">#${esc(n)}</a>`
    : `#${esc(n)}`;
}

// ---- board ------------------------------------------------------------------------------------

function card(t) {
  const f = t.fields;
  const k = kindClass(t);
  const meta = [`<span class="prio p-${esc(f.prioriteit)}">${f.prioriteit === 'hoog' ? '▲ ' : ''}${esc(cap(f.prioriteit))}</span>`];
  if (f['opgepakt-door']) meta.push(`<span class="who"><span class="dot" aria-hidden="true"></span>${esc(f['opgepakt-door'])}</span>`);
  if (t.criteria.total) meta.push(`<span class="crit">${t.criteria.done}/${t.criteria.total} criteria</span>`);
  meta.push(`<span class="when">${esc(formatWhen(f.bijgewerkt))}</span>`);
  const flags = [];
  if (f.geblokkeerd) flags.push(`<span class="flag blocked"><span aria-hidden="true">■ </span>Geblokkeerd: ${esc(f.geblokkeerd)}</span>`);
  if (t.column === 'in-review') flags.push(`<span class="flag review">Wacht op merge${f.branch ? ` van ${esc(f.branch)}` : ''}</span>`);
  else if (!t.onMain) flags.push('<span class="flag notmain">Nog niet op main</span>');
  if (t.warnings.length) {
    flags.push(`<span class="flag warn">${t.warnings.length} ${t.warnings.length === 1 ? 'opmerking' : 'opmerkingen'} over de structuur</span>`);
  }
  return `<li><button type="button" class="card ${k}" data-key="${esc(t.key)}">
    <span class="card-top"><span class="tag ${k}">${KIND[t.prefix]}</span><span class="id">${esc(t.id)}</span></span>
    <span class="card-title">${esc(f.titel)}</span>
    <span class="card-meta">${meta.join('')}</span>
    ${flags.join('')}
  </button></li>`;
}

function column(col) {
  const cards = col.cards.filter(matches);
  const limited = col.id === 'klaar' && !prefs.allDone && cards.length > DONE_LIMIT;
  const shown = limited ? cards.slice(0, DONE_LIMIT) : cards;
  let more = '';
  if (limited) more = `<button type="button" class="more" data-more>Toon alle ${cards.length}</button>`;
  else if (col.id === 'klaar' && prefs.allDone && cards.length > DONE_LIMIT) {
    more = `<button type="button" class="more" data-more>Toon enkel de laatste ${DONE_LIMIT}</button>`;
  }
  return `<section class="column col-${col.id}" aria-labelledby="col-${col.id}">
    <header class="column-head">
      <h2 id="col-${col.id}">${esc(col.title)} <span class="count">${cards.length}</span></h2>
      <p class="hint">${esc(HINT[col.id])}</p>
    </header>
    ${shown.length ? `<ol class="cards">${shown.map(card).join('')}</ol>` : '<p class="empty">Geen tickets</p>'}
    ${more}
  </section>`;
}

function renderInvalid() {
  const bad = data.invalid.filter(matches);
  el.invalid.hidden = bad.length === 0;
  if (!bad.length) return;
  el.invalid.innerHTML = `<h2><span aria-hidden="true">■ </span>${bad.length} ${bad.length === 1 ? 'ticket volgt' : 'tickets volgen'} de vaste structuur niet</h2>
    <p>Ze staan niet op het bord tot ze hersteld zijn. <code>node tools/backlog-board/tickets.mjs check</code> toont dezelfde fouten.</p>
    <ul>${bad
      .map(
        (t) =>
          `<li><button type="button" class="link" data-key="${esc(t.key)}">${esc(t.file)}</button> <span class="where">${esc(t.source.label)}</span><br><span>${esc(t.errors[0])}${t.errors.length > 1 ? ` (en nog ${t.errors.length - 1})` : ''}</span></li>`,
      )
      .join('')}</ul>`;
}

function renderMeta() {
  const parts = [live ? '<span class="live on">Live</span>' : '<span class="live off">Verbinding verbroken, opnieuw verbinden…</span>'];
  const s = data?.sources;
  if (s) {
    parts.push(`main ${esc(s.main)}`);
    parts.push(`${s.branches.length} ${s.branches.length === 1 ? 'branch' : 'branches'} buiten main`);
    parts.push(`${s.worktrees.length} ${s.worktrees.length === 1 ? 'worktree' : 'worktrees'}`);
  }
  if (data?.generatedAt) {
    const t = new Date(data.generatedAt);
    parts.push(`gewijzigd om ${t.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`);
  }
  el.meta.innerHTML = parts.join(' <span aria-hidden="true">·</span> ');
}

function renderBoard() {
  if (!data) return;
  el.error.hidden = data.ok;
  if (!data.ok) {
    el.error.textContent = `Het bord kan de repo niet lezen: ${data.error}`;
    el.board.innerHTML = '';
    el.invalid.hidden = true;
    return;
  }
  const focused = document.activeElement?.closest?.('#board [data-key], #invalid [data-key]')?.dataset.key;
  el.board.innerHTML = data.columns.map(column).join('');
  renderInvalid();
  if (focused) document.querySelector(`[data-key="${CSS.escape(focused)}"]`)?.focus();
}

// ---- detail -----------------------------------------------------------------------------------

function drawer(t) {
  const f = t.fields;
  const k = kindClass(t);
  const facts = [
    ['Kolom', t.column ? esc(columnTitle(t.column)) : 'Niet op het bord (ongeldig)'],
    ['Status in het bestand', esc(STATUS[f.status] ?? f.status ?? 'onleesbaar')],
    ['Prioriteit', esc(cap(f.prioriteit) || 'onleesbaar')],
    ['Opgepakt door', esc(f['opgepakt-door'] || 'niemand')],
    ['Branch', f.branch ? `<code>${esc(f.branch)}</code>` : 'geen'],
    ['PR', prLink(f.pr)],
    ['FR', esc((f.fr ?? []).join(', ') || 'geen')],
    ['Criteria', t.criteria.total ? `${t.criteria.done} van ${t.criteria.total} afgevinkt` : 'geen'],
    ['Aangemaakt', esc(f.aangemaakt ?? '')],
    ['Bijgewerkt', esc(f.bijgewerkt ?? '')],
  ];
  const problems = [];
  if (f.geblokkeerd) problems.push(`<div class="banner blocked"><strong>Geblokkeerd.</strong> ${esc(f.geblokkeerd)}</div>`);
  if (t.errors.length) {
    problems.push(
      `<div class="banner error"><strong>Dit ticket volgt de vaste structuur niet.</strong><ul>${t.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>`,
    );
  }
  if (t.warnings.length) {
    problems.push(`<div class="banner warn"><strong>Opmerkingen.</strong><ul>${t.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>`);
  }
  const sections = t.sections
    .map((s) => {
      const html = renderMarkdown(s.body);
      const slug = s.title.toLowerCase().replace(/[^a-z]+/g, '-');
      return `<section class="sec sec-${slug}"><h3>${esc(s.title)}</h3>${html || '<p class="empty">Leeg</p>'}</section>`;
    })
    .join('');
  const versions = t.versions
    .map(
      (v) =>
        `<li${v.winner ? ' class="winner"' : ''}>${esc(v.label)}: ${esc(STATUS[v.status] ?? v.status ?? 'onleesbaar')}${v.updated ? `, bijgewerkt ${esc(v.updated)}` : ''}${v.winner ? ' <strong>(deze wordt getoond)</strong>' : ''}${v.valid ? '' : ' <span class="bad">ongeldig</span>'}</li>`,
    )
    .join('');
  return `<header class="drawer-head">
      <div class="drawer-top">
        <span class="tag ${k}">${KIND[t.prefix] ?? 'Onbekend'}</span>
        <span class="id">${esc(t.id)}</span>
        <span class="pill">${t.column ? esc(columnTitle(t.column)) : 'Ongeldig'}</span>
        <button type="button" class="close" data-close aria-label="Sluiten">×</button>
      </div>
      <h2 id="detail-title">${esc(f.titel || t.file)}</h2>
    </header>
    ${problems.join('')}
    <dl class="facts">${facts.map(([dt, dd]) => `<div><dt>${dt}</dt><dd>${dd}</dd></div>`).join('')}</dl>
    ${sections}
    <section class="sec versions"><h3>Waar staat dit ticket</h3><ul>${versions}</ul>
      <p class="path"><code>${esc(t.folder)}/${esc(t.file)}</code></p></section>`;
}

function renderDrawer() {
  if (!openKey) return;
  const t = allTickets().find((x) => x.key === openKey);
  const html = t
    ? drawer(t)
    : `<header class="drawer-head"><div class="drawer-top"><button type="button" class="close" data-close aria-label="Sluiten">×</button></div>
       <h2 id="detail-title">Dit ticket staat niet meer op het bord</h2></header>`;
  if (html === drawerHtml) return;
  const scroll = el.drawer.scrollTop;
  el.drawer.innerHTML = html;
  el.drawer.scrollTop = scroll;
  drawerHtml = html;
}

function open(key) {
  const t = allTickets().find((x) => x.key === key);
  if (!t) return;
  openKey = key;
  drawerHtml = '';
  renderDrawer();
  el.drawer.scrollTop = 0;
  if (!el.dialog.open) el.dialog.showModal();
  history.replaceState(null, '', `#${encodeURIComponent(t.id)}`);
}

function openFromHash() {
  if (!pendingHash || !data?.ok) return;
  const t = allTickets().find((x) => x.id === pendingHash || x.file === pendingHash);
  pendingHash = null;
  if (t) open(t.key);
}

// ---- wiring -----------------------------------------------------------------------------------

function renderAll() {
  renderMeta();
  renderBoard();
  renderDrawer();
  openFromHash();
}

function syncControls() {
  for (const b of document.querySelectorAll('[data-kind]')) b.setAttribute('aria-pressed', String(b.dataset.kind === prefs.kind));
  el.q.value = prefs.q;
}

document.addEventListener('click', (e) => {
  const kind = e.target.closest('[data-kind]');
  if (kind) {
    prefs.kind = kind.dataset.kind;
    savePrefs();
    syncControls();
    renderBoard();
    return;
  }
  if (e.target.closest('[data-more]')) {
    prefs.allDone = !prefs.allDone;
    savePrefs();
    renderBoard();
    return;
  }
  if (e.target.closest('[data-close]')) {
    el.dialog.close();
    return;
  }
  const hit = e.target.closest('#board [data-key], #invalid [data-key]');
  if (hit) open(hit.dataset.key);
});

// A click on the backdrop lands on the dialog element itself.
el.dialog.addEventListener('click', (e) => {
  if (e.target === el.dialog) el.dialog.close();
});
el.dialog.addEventListener('close', () => {
  openKey = null;
  drawerHtml = '';
  history.replaceState(null, '', location.pathname);
});

el.q.addEventListener('input', () => {
  prefs.q = el.q.value;
  savePrefs();
  renderBoard();
});

window.addEventListener('hashchange', () => {
  pendingHash = decodeURIComponent(location.hash.slice(1)) || null;
  openFromHash();
});

function connect() {
  const events = new EventSource('/api/events');
  events.addEventListener('board', (e) => {
    data = JSON.parse(e.data);
    live = true;
    renderAll();
  });
  events.addEventListener('open', () => {
    live = true;
    renderMeta();
  });
  events.addEventListener('error', () => {
    live = false;
    renderMeta();
  });
}

syncControls();
connect();
