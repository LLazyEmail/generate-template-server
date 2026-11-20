import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig } from './config-validate.mjs';

test('accepts a valid config', () => {
  assert.doesNotThrow(() => validateConfig({ port: 8787, maxBodyBytes: 1_000_000 }));
});

test('rejects bad port', () => {
  assert.throws(() => validateConfig({ port: 0, maxBodyBytes: 100 }), (err) => {
    assert.equal(err.code, 'INVALID_CONFIG');
    assert.match(err.message, /PORT/);
    return true;
  });
});

test('rejects non-positive body limit', () => {
  assert.throws(() => validateConfig({ port: 80, maxBodyBytes: 0 }), (err) => {
    assert.match(err.message, /MAX_BODY_BYTES/);
    return true;
  });
});
