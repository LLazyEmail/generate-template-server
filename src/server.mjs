#!/usr/bin/env node
/** Thin callable HTTP server. Optional render cache when RENDER_CACHE=1. */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createGenerator } from '@llazyemail/generate-template';
import { config } from './config.mjs';
import { loadCatalog } from './load-catalog.mjs';
import { requireAuth, isPublicPath } from './auth.mjs';
import { cacheGet, cacheSet, cacheStats } from './cache.mjs';
import { withTimeout } from './timeout.mjs';
import { inc } from './metrics.mjs';

let generate;
async function init() {
  const loaded = await loadCatalog();
  generate = createGenerator({ catalog: loaded.catalog, samplePayloads: loaded.samplePayloads });
}
function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': config.corsOrigin });
  res.end(data);
}
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; }
}
async function runOne(templateId, payload) {
  const hit = cacheGet(templateId, payload);
  if (hit) { inc('cache_hits'); return hit; }
  const result = await withTimeout(generate.run({ templateId, payload }), `render ${templateId}`);
  cacheSet(templateId, payload, result);
  inc('renders');
  return result;
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const method = req.method || 'GET';
  const reqId = req.headers['x-request-id'] || randomUUID();
  res.setHeader('x-request-id', reqId);
  if (method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true, cache: cacheStats() });
  if (method === 'GET' && url.pathname === '/cache') return json(res, 200, cacheStats());
  if (!isPublicPath(url.pathname) && !requireAuth(req, res)) return;
  if (method === 'POST' && url.pathname === '/render') {
    const body = await readBody(req);
    if (!body?.templateId) return json(res, 400, { error: 'templateId_required', reqId });
    try {
      const result = await runOne(body.templateId, body.payload);
      return json(res, 200, { html: result.html, slug: result.slug, reqId, cached: Boolean(cacheGet(body.templateId, body.payload)) });
    } catch (err) {
      return json(res, 422, { error: err?.code || 'RENDER_FAILED', message: err?.message, reqId });
    }
  }
  return json(res, 404, { error: 'not_found', reqId });
});
init().then(() => server.listen(config.port, config.host, () => console.log(`listening :${config.port} (cache ${cacheStats().enabled ? 'on' : 'off'})`))).catch((e) => { console.error(e); process.exit(1); });
export { server };
