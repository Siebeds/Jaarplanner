import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../public/markdown.js';

test('HTML in a ticket is shown as text, never executed', () => {
  const html = renderMarkdown('<script>alert(1)</script> en <img src=x onerror=alert(1)>');
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('only http(s) links become links', () => {
  assert.match(renderMarkdown('[analyse](https://example.com/a)'), /<a href="https:\/\/example.com\/a" target="_blank" rel="noreferrer noopener">analyse<\/a>/);
  assert.ok(!renderMarkdown('[klik](javascript:alert(1))').includes('<a'));
});

test('task lists, nesting, emphasis and code', () => {
  const html = renderMarkdown('- [x] klaar\n- [ ] open\n  - genest\n\n**vet** en *schuin* en `code`');
  assert.match(html, /<li class="task done"><span class="box" aria-hidden="true">☑<\/span><span class="sr">Afgevinkt: <\/span>klaar/);
  assert.match(html, /<li class="task">.*open<ul><li>genest<\/li><\/ul><\/li><\/ul>/s);
  assert.match(html, /<strong>vet<\/strong> en <em>schuin<\/em> en <code>code<\/code>/);
});

test('comments disappear; tables, quotes and fences render', () => {
  assert.equal(renderMarkdown('<!-- hulp -->'), '');
  assert.match(renderMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |'), /<table><thead><tr><th>a<\/th><th>b<\/th><\/tr><\/thead><tbody><tr><td>1<\/td><td>2<\/td><\/tr><\/tbody><\/table>/);
  assert.match(renderMarkdown('> let op'), /<blockquote><p>let op<\/p><\/blockquote>/);
  assert.match(renderMarkdown('```\n<b>x</b>\n```'), /<pre><code>&lt;b&gt;x&lt;\/b&gt;<\/code><\/pre>/);
});

test('consecutive lines keep their line breaks', () => {
  assert.equal(renderMarkdown('Gegeven a\nwanneer b'), '<p>Gegeven a<br>wanneer b</p>');
});
