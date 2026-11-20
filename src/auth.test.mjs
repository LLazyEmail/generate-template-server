import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPublicPath, requireAuth } from './auth.mjs';

test('known public paths', () => {
  assert.equal(isPublicPath('/health'), true);
  assert.equal(isPublicPath('/version'), true);
  assert.equal(isPublicPath('/docs'), true);
  assert.equal(isPublicPath('/openapi.json'), true);
  assert.equal(isPublicPath('/render'), false);
});

test('auth is open when API_KEY is unset', () => {
  let wrote = false;
  const ok = requireAuth(
    { headers: {} },
    { writeHead() { wrote = true; }, end() {} },
  );
  assert.equal(ok, true);
  assert.equal(wrote, false);
});
