import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchTemplates } from './search.mjs';

test('empty query returns all', () => {
  const ids = ['Welcome', 'Status'];
  assert.deepEqual(searchTemplates(ids, ''), ids);
  assert.deepEqual(searchTemplates(ids, undefined), ids);
});

test('case-insensitive substring', () => {
  const ids = ['Welcome', 'status-report', 'Invoice'];
  assert.deepEqual(searchTemplates(ids, 'wel'), ['Welcome']);
  assert.deepEqual(searchTemplates(ids, 'STATUS'), ['status-report']);
});

test('no match returns empty', () => {
  assert.deepEqual(searchTemplates(['a'], 'z'), []);
});
