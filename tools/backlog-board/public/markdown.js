// A small, safe Markdown renderer for ticket sections. All text is escaped first and only a known
// subset is turned back into markup: headings, paragraphs, (nested) lists with task boxes, quotes,
// code, simple tables, bold, italic and http(s) links. HTML comments are dropped.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

const LIST = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const FENCE = /^\s*(```|~~~)/;
const HEADING = /^(#{3,6})\s+(.*)$/;
const QUOTE = /^\s*>/;
const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

// Code spans and links are finished markup the moment they are built, so they are parked behind a
// placeholder before the emphasis passes run; otherwise an underscore in a link's attributes turns
// into <em>. The placeholder delimiter is a private-use character, spelled as a code point so this
// source file stays plain text (a literal control character made git treat it as binary).
const MARK = String.fromCharCode(0xe000);
const PARKED = new RegExp(`${MARK}(\\d+)${MARK}`, 'g');

function inline(raw) {
  const parked = [];
  const park = (html) => `${MARK}${parked.push(html) - 1}${MARK}`;
  let s = esc(String(raw).replaceAll(MARK, ''));
  s = s.replace(/`([^`]+)`/g, (_, c) => park(`<code>${c}</code>`));
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, text, href) =>
    park(`<a href="${href}" target="_blank" rel="noreferrer noopener">${text}</a>`),
  );
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^_\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>');
  // A link can hold a parked code span, so restore until nothing parked is left. Each pass expands
  // one level of nesting and there are at most two (code inside a link).
  for (let pass = 0; pass < 3 && s.includes(MARK); pass++) s = s.replace(PARKED, (_, i) => parked[Number(i)]);
  return s;
}

function isTableStart(lines, i) {
  return lines[i].includes('|') && i + 1 < lines.length && TABLE_RULE.test(lines[i + 1]);
}

function startsBlock(lines, i) {
  const l = lines[i];
  return FENCE.test(l) || HEADING.test(l) || QUOTE.test(l) || LIST.test(l) || isTableStart(lines, i);
}

function cells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function listItem(text) {
  const task = /^\[( |x|X)\]\s+([\s\S]*)$/.exec(text);
  const body = (task ? task[2] : text).split('\n').map(inline).join('<br>');
  if (!task) return `<li>${body}`;
  const done = task[1] !== ' ';
  return `<li class="task${done ? ' done' : ''}"><span class="box" aria-hidden="true">${done ? '☑' : '☐'}</span><span class="sr">${done ? 'Afgevinkt: ' : 'Open: '}</span>${body}`;
}

function renderList(lines, start) {
  const items = [];
  let i = start;
  while (i < lines.length) {
    const m = LIST.exec(lines[i]);
    if (m) {
      items.push({ indent: m[1].replace(/\t/g, '  ').length, ordered: /\d/.test(m[2]), text: m[3] });
      i++;
    } else if (items.length && /^\s{2,}\S/.test(lines[i])) {
      items[items.length - 1].text += `\n${lines[i].trim()}`;
      i++;
    } else break;
  }
  let html = '';
  const stack = [];
  for (const it of items) {
    const top = stack[stack.length - 1];
    if (!top || it.indent > top.indent) {
      const tag = it.ordered ? 'ol' : 'ul';
      stack.push({ indent: it.indent, tag });
      html += `<${tag}>`;
    } else {
      while (stack.length > 1 && it.indent < stack[stack.length - 1].indent) html += `</li></${stack.pop().tag}>`;
      html += '</li>';
    }
    html += listItem(it.text);
  }
  while (stack.length) html += `</li></${stack.pop().tag}>`;
  return [html, i];
}

export function renderMarkdown(markdown) {
  const lines = String(markdown ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i++;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      const level = Math.min(6, h[1].length + 1);
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }
    if (QUOTE.test(line)) {
      const buf = [];
      while (i < lines.length && QUOTE.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push(`<blockquote>${renderMarkdown(buf.join('\n'))}</blockquote>`);
      continue;
    }
    if (isTableStart(lines, i)) {
      const head = cells(lines[i]);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') rows.push(cells(lines[i++]));
      out.push(
        `<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>` +
          `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`,
      );
      continue;
    }
    if (LIST.test(line)) {
      const [html, next] = renderList(lines, i);
      out.push(html);
      i = next;
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() !== '' && (buf.length === 0 || !startsBlock(lines, i))) buf.push(lines[i++].trim());
    out.push(`<p>${buf.map(inline).join('<br>')}</p>`);
  }
  return out.join('\n');
}
