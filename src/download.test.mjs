import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex } from './download.mjs';

test('buildIndex lists files and escapes', () => {
  const html = buildIndex(
    [{ name: 'welcome.html' }, { name: 'a&b.html' }],
    'files',
  );
  assert.match(html, /welcome.html/);
  assert.match(html, /a&b.html/);
  assert.match(html, /Rendered files/);
});
