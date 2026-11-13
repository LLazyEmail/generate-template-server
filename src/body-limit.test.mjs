import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from './config.mjs';
import { inc, snapshot, reset } from './metrics.mjs';
import { record, list } from './recent.mjs';

test('config reads defaults', () => {
  assert.equal(typeof config.port, 'number');
  assert.ok(config.maxBodyBytes > 0);
});

test('metrics increment', () => {
  reset();
  inc('renders');
  inc('renders', 2);
  assert.equal(snapshot().renders, 3);
});

test('recent ring buffer', () => {
  record({ templateId: 'welcome', reqId: 'a' });
  const items = list();
  assert.ok(items.length >= 1);
  assert.equal(items[0].templateId, 'welcome');
});
