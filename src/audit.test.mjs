import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audit, listAudit } from './audit.mjs';

test('records newest first', () => {
  const before = listAudit().length;
  audit({ action: 'reload', reqId: 'a' });
  audit({ action: 'reload', reqId: 'b' });
  const list = listAudit();
  assert.equal(list[0].reqId, 'b');
  assert.equal(list[1].reqId, 'a');
  assert.ok(list.length >= before + 2);
  assert.ok(list[0].at);
});
