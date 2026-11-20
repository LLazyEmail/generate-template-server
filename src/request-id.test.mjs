import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestId, setRequestId } from './request-id.mjs';

test('echoes a valid incoming id', () => {
  const id = requestId({ headers: { 'x-request-id': 'abc-123' } });
  assert.equal(id, 'abc-123');
});

test('generates a uuid when missing', () => {
  const id = requestId({ headers: {} });
  assert.match(id, /^[0-9a-f-]{36}$/i);
});

test('rejects an oversized incoming id', () => {
  const id = requestId({ headers: { 'x-request-id': 'x'.repeat(200) } });
  assert.notEqual(id, 'x'.repeat(200));
});

test('setRequestId writes the header', () => {
  const headers = {};
  setRequestId({ setHeader: (k, v) => { headers[k] = v; } }, 'rid');
  assert.equal(headers['x-request-id'], 'rid');
});
