// Writes tickets: a fresh one from the template, and targeted edits to an existing one. Edits touch
// only the frontmatter lines they change and append to the Werklog, so a hand-written ticket keeps
// its own formatting.

import { GUIDANCE, KEYS, KIND_OF_PREFIX, SECTIONS } from './format.mjs';
import { normalise } from './parse.mjs';

const pad = (n) => String(n).padStart(2, '0');

export function today(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function timestamp(d = new Date()) {
  return `${today(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function slugify(title, max = 50) {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const cut = slug.length <= max ? slug : slug.slice(0, max).replace(/-[^-]*$/, '');
  return cut || 'ticket';
}

export function formatNumber(n) {
  return String(n).padStart(3, '0');
}

export function worklogLine(at, by, message) {
  return `- ${at} · ${by.replace(/·/g, '-').trim()} · ${message.replace(/\n+/g, ' ').trim()}`;
}

function formatValue(key, value) {
  if (key === 'fr') return `[${(value ?? []).join(', ')}]`;
  return value ?? '';
}

function frontmatterLine(key, value) {
  const formatted = formatValue(key, value);
  return formatted === '' ? `${key}:` : `${key}: ${formatted}`;
}

/**
 * Renders a new ticket with every key and every section, the sections holding their guidance as
 * HTML comments. The validator rejects it until every section but Werklog has real content, which
 * is the point: the template cannot be committed half-filled.
 */
export function renderNewTicket({ prefix, number, title, status, priority, by, branch = '', fr = [], now = new Date() }) {
  const at = timestamp(now);
  const values = {
    id: `${prefix}-${formatNumber(number)}`,
    titel: title,
    soort: KIND_OF_PREFIX[prefix],
    status,
    prioriteit: priority,
    aangemaakt: today(now),
    bijgewerkt: at,
    'opgepakt-door': status === 'in-uitvoering' ? by : '',
    branch,
    pr: '',
    geblokkeerd: '',
    fr,
  };
  const front = KEYS.map((k) => frontmatterLine(k, values[k])).join('\n');
  const body = SECTIONS[prefix]
    .map((section) => {
      if (section === 'Werklog') return `## Werklog\n\n${worklogLine(at, by, `aangemaakt (status ${status})`)}`;
      return `## ${section}\n\n<!-- ${GUIDANCE[section]} -->`;
    })
    .join('\n\n');
  return `---\n${front}\n---\n\n${body}\n`;
}

/** Replaces the given frontmatter keys in place. Every key must already exist in the file. */
export function setFields(text, updates) {
  const lines = normalise(text).split('\n');
  const end = lines.indexOf('---', 1);
  if (lines[0] !== '---' || end === -1) throw new Error('Geen frontmatter-blok gevonden.');
  for (const [key, value] of Object.entries(updates)) {
    const i = lines.findIndex((l, idx) => idx > 0 && idx < end && (l === `${key}:` || l.startsWith(`${key}: `)));
    if (i === -1) throw new Error(`Sleutel ${key} ontbreekt in de frontmatter.`);
    lines[i] = frontmatterLine(key, value);
  }
  return lines.join('\n');
}

/** Appends one line to the Werklog, which the format guarantees is the last section. */
export function appendWorklog(text, line) {
  const body = normalise(text).replace(/\s+$/, '');
  if (!/\n## Werklog\s*(\n|$)/.test(body)) throw new Error('Geen sectie "## Werklog" gevonden.');
  const lastHeading = body.lastIndexOf('\n## ');
  if (!body.slice(lastHeading).startsWith('\n## Werklog')) throw new Error('"## Werklog" is niet de laatste sectie.');
  const separator = /\n## Werklog$/.test(body) ? '\n\n' : '\n';
  return `${body}${separator}${line}\n`;
}
