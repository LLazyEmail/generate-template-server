import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const PORT = 18787;
let child;

test('server starts and /health responds', async (t) => {
  child = spawn('node', ['src/server.mjs'], {
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // wait for listen
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout starting server')), 8000);
    const onData = (buf) => {
      if (String(buf).includes('listening')) {
        clearTimeout(timer);
        child.stdout.off('data', onData);
        resolve();
      }
    };
    child.stdout.on('data', onData);
    child.on('error', reject);
  });

  const res = await fetch(`http://127.0.0.1:${PORT}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.service, 'generate-template-server');

  after(() => child?.kill());
});

test('POST /render returns html', async () => {
  const res = await fetch(`http://127.0.0.1:${PORT}/render`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ templateId: 'welcome', payload: { name: 'TestUser' } }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.match(body.html, /Welcome, TestUser/);
});
