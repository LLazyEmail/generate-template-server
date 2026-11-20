import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertHtmlSize } from './size.mjs';

test('accepts small html and returns byte length', () => {
  const n = assertHtmlSize('<p>ok</p>');
  assert.equal(n, Buffer.byteLength('<p>ok</p>'));
});

test('accepts empty', () => {
  assert.equal(assertHtmlSize(''), 0);
  assert.equal(assertHtmlSize(undefined), 0);
});

test('rejects oversized html', () => {
  const big = 'x'.repeat(3_000_000);
  assert.throws(() => assertHtmlSize(big), (err) => {
    assert.equal(err.code, 'HTML_TOO_LARGE');
    assert.equal(err.statusCode, 413);
    return true;
  });
});
