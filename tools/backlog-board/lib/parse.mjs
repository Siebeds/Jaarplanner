// Parses one ticket file and validates it against lib/format.mjs. Never throws on bad input: a
// broken ticket must show up on the board as a red card, not vanish or take the board down.
//
// Error and warning messages are Dutch, because the board and the CLI show them to the owner and
// the functional architect.

import {
  DATE,
  FILE_NAME,
  FOLDERS,
  FR,
  KEYS,
  KIND_OF_PREFIX,
  MAX_TITLE,
  MAY_BE_EMPTY,
  PR,
  PRIORITIES,
  REQUIRED_VALUES,
  SECTIONS,
  STATUSES,
  TIMESTAMP,
  WORKLOG_LINE,
} from './format.mjs';

export function normalise(text) {
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

export function parseFileName(file) {
  const m = FILE_NAME.exec(file);
  if (!m) return null;
  return { prefix: m[1], number: m[2], id: `${m[1]}-${m[2]}`, slug: m[3] };
}

export function stripComments(markdown) {
  return markdown.replace(/<!--[\s\S]*?-->/g, '');
}

function parseValue(key, raw) {
  let value = raw.trim();
  if (value.length >= 2 && /^(["']).*\1$/.test(value)) value = value.slice(1, -1);
  if (key !== 'fr') return value;
  if (value === '' || value === '[]') return [];
  if (!/^\[.*\]$/.test(value)) return null;
  return value
    .slice(1, -1)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseFrontmatter(lines, errors) {
  if (lines[0] !== '---') {
    errors.push('Het bestand begint niet met een frontmatter-blok (een regel met alleen "---").');
    return { fields: null, bodyStart: 0 };
  }
  const end = lines.indexOf('---', 1);
  if (end === -1) {
    errors.push('Het frontmatter-blok wordt niet afgesloten met een regel "---".');
    return { fields: null, bodyStart: 0 };
  }
  const fields = {};
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    const m = /^([a-z][a-z-]*):(?:\s(.*))?$/.exec(line);
    if (!m) {
      errors.push(`Frontmatter-regel ${i + 1} is geen "sleutel: waarde": ${line}`);
      continue;
    }
    const [, key, raw = ''] = m;
    if (!KEYS.includes(key)) {
      errors.push(`Onbekende sleutel in de frontmatter: ${key}`);
      continue;
    }
    if (key in fields) {
      errors.push(`De sleutel ${key} staat twee keer in de frontmatter.`);
      continue;
    }
    const value = parseValue(key, raw);
    if (value === null) {
      errors.push(`fr moet een lijst zijn, bijvoorbeeld [FR-7.2, FR-7.3].`);
      continue;
    }
    fields[key] = value;
  }
  for (const key of KEYS) {
    if (!(key in fields)) errors.push(`Sleutel ontbreekt in de frontmatter: ${key}`);
  }
  return { fields, bodyStart: end + 1 };
}

function parseSections(lines, start, errors) {
  const sections = [];
  let current = null;
  let inFence = false;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const heading = !inFence && /^(#{1,2}) (.+?)\s*$/.exec(line);
    if (heading && heading[1] === '#') {
      errors.push(`Gebruik geen kop van niveau 1 ("# ..."); de titel staat in de frontmatter: ${line}`);
      continue;
    }
    if (heading) {
      current = { title: heading[2], lines: [] };
      sections.push(current);
      continue;
    }
    if (current) current.lines.push(line);
    else if (line.trim() !== '') {
      errors.push(`Er staat tekst vóór de eerste sectie: ${line.slice(0, 60)}`);
    }
  }
  return sections.map((s) => ({ title: s.title, body: s.lines.join('\n').trim() }));
}

function checkSectionOrder(prefix, sections, errors) {
  const expected = SECTIONS[prefix];
  const found = sections.map((s) => s.title);
  for (const title of found) {
    if (!expected.includes(title)) errors.push(`Onverwachte sectie "## ${title}". Toegestaan: ${expected.join(', ')}.`);
  }
  for (const title of expected) {
    const count = found.filter((t) => t === title).length;
    if (count === 0) errors.push(`Sectie ontbreekt: "## ${title}".`);
    if (count > 1) errors.push(`Sectie "## ${title}" staat er ${count} keer.`);
  }
  const known = found.filter((t) => expected.includes(t));
  const inOrder = expected.filter((t) => known.includes(t));
  if (known.length === inOrder.length && known.some((t, i) => t !== inOrder[i])) {
    errors.push(`De secties staan niet in de vaste volgorde: ${expected.join(', ')}.`);
  }
}

function countCriteria(body) {
  const items = [...stripComments(body).matchAll(/^\s*[-*] \[( |x|X)\] /gm)];
  return { total: items.length, done: items.filter((m) => m[1] !== ' ').length };
}

function parseWorklog(body, warnings) {
  const entries = [];
  for (const line of stripComments(body).split('\n')) {
    if (line.trim() === '') continue;
    const m = WORKLOG_LINE.exec(line);
    if (m) entries.push({ at: m[1], by: m[2].trim(), text: m[3] });
    else {
      warnings.push(`Werklogregel volgt het formaat "- JJJJ-MM-DD UU:MM · wie · wat" niet: ${line.slice(0, 60)}`);
      entries.push({ at: null, by: null, text: line.replace(/^- /, '') });
    }
  }
  return entries;
}

/**
 * @param {string} text   the raw file content
 * @param {{ file: string, folder: string }} where   file name and repo-relative folder
 */
export function parseTicket(text, { file, folder }) {
  const errors = [];
  const warnings = [];
  const name = parseFileName(file);
  if (!name) {
    errors.push(`De bestandsnaam volgt het patroon FB-001-korte-titel.md of TB-001-korte-titel.md niet: ${file}`);
  } else if (FOLDERS[name.prefix] !== folder) {
    errors.push(`${name.prefix}-tickets horen in ${FOLDERS[name.prefix]}, niet in ${folder}.`);
  }

  const lines = normalise(text).split('\n');
  const { fields, bodyStart } = parseFrontmatter(lines, errors);
  const sections = parseSections(lines, bodyStart, errors);
  const prefix = name?.prefix ?? (fields?.id?.slice(0, 2) === 'TB' ? 'TB' : 'FB');

  if (fields) {
    for (const key of REQUIRED_VALUES) {
      if (key in fields && fields[key] === '') errors.push(`${key} mag niet leeg zijn.`);
    }
    if (name && fields.id && fields.id !== name.id) {
      errors.push(`De id in de frontmatter (${fields.id}) past niet bij de bestandsnaam (${name.id}).`);
    }
    if (fields.soort && fields.soort !== KIND_OF_PREFIX[prefix]) {
      errors.push(`soort moet "${KIND_OF_PREFIX[prefix]}" zijn voor een ${prefix}-ticket, niet "${fields.soort}".`);
    }
    if (fields.status && !STATUSES.includes(fields.status)) {
      errors.push(`Onbekende status "${fields.status}". Toegestaan: ${STATUSES.join(', ')}.`);
    }
    if (fields.prioriteit && !PRIORITIES.includes(fields.prioriteit)) {
      errors.push(`Onbekende prioriteit "${fields.prioriteit}". Toegestaan: ${PRIORITIES.join(', ')}.`);
    }
    if (fields.aangemaakt && !DATE.test(fields.aangemaakt)) {
      errors.push(`aangemaakt moet een datum JJJJ-MM-DD zijn, niet "${fields.aangemaakt}".`);
    }
    if (fields.bijgewerkt && !TIMESTAMP.test(fields.bijgewerkt)) {
      errors.push(`bijgewerkt moet "JJJJ-MM-DD UU:MM" zijn, niet "${fields.bijgewerkt}".`);
    }
    if (fields.pr && !PR.test(fields.pr)) errors.push(`pr moet een nummer (52 of #52) of een https-link zijn.`);
    if (fields.branch && /\s/.test(fields.branch)) errors.push(`branch mag geen spaties bevatten.`);
    for (const fr of fields.fr ?? []) {
      if (!FR.test(fr)) errors.push(`"${fr}" in fr is geen FR-nummer zoals FR-7.2.`);
    }
    if (fields.status === 'in-uitvoering') {
      if (!fields['opgepakt-door']) errors.push('Een ticket in uitvoering moet opgepakt-door invullen.');
      if (!fields.branch) errors.push('Een ticket in uitvoering moet branch invullen.');
    }
    if (prefix === 'TB' && fields.status === 'te-testen') {
      errors.push('Technische tickets gaan niet via te-testen: hun eindstatus is klaar.');
    }
    if (fields.titel && fields.titel.length > MAX_TITLE) {
      warnings.push(`De titel is ${fields.titel.length} tekens lang; houd hem onder ${MAX_TITLE} voor het board.`);
    }
    if (DATE.test(fields.aangemaakt ?? '') && TIMESTAMP.test(fields.bijgewerkt ?? '')) {
      if (fields.bijgewerkt.slice(0, 10) < fields.aangemaakt) warnings.push('bijgewerkt ligt vóór aangemaakt.');
    }
  }

  checkSectionOrder(prefix, sections, errors);
  for (const s of sections) {
    if (!MAY_BE_EMPTY.includes(s.title) && SECTIONS[prefix].includes(s.title) && stripComments(s.body).trim() === '') {
      errors.push(`Sectie "## ${s.title}" is leeg.`);
    }
  }
  const criteriaSection = sections.find((s) => s.title === 'Acceptatiecriteria');
  const criteria = countCriteria(criteriaSection?.body ?? '');
  if (criteriaSection && criteria.total === 0) {
    errors.push('Acceptatiecriteria bevat geen enkele "- [ ]"-regel.');
  }
  const worklogSection = sections.find((s) => s.title === 'Werklog');
  const worklog = parseWorklog(worklogSection?.body ?? '', warnings);

  return {
    file,
    folder,
    prefix,
    id: name?.id ?? null,
    valid: errors.length === 0,
    errors,
    warnings,
    fields: fields ?? {},
    sections,
    criteria,
    worklog,
  };
}
