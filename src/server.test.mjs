import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGenerator } from '@llazyemail/generate-template';
import { demoCatalog, samplePayloads } from './catalog.mjs';

test('demo catalog renders welcome via generate-template', async () => {
  const generate = createGenerator({
    catalog: demoCatalog,
    samplePayloads,
  });
  const result = await generate.run({ templateId: 'welcome', payload: { name: 'Test' } });
  assert.match(result.html, /Welcome, Test/);
});

test('demo catalog lists expected ids', () => {
  const ids = demoCatalog.flatMap((c) => c.ids);
  assert.ok(ids.includes('welcome'));
  assert.ok(ids.includes('invoice'));
});
