#!/usr/bin/env node
/** Thin callable HTTP server. Adds GET /ready for load balancers. */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createGenerator } from '@llazyemail/generate-template';
import { checkRateLimit } from './rate-limit.mjs';
import { toHttpError } from './errors.mjs';
import { config } from './config.mjs';
import { loadCatalog } from './load-catalog.mjs';
import { requireAuth, isPublicPath } from './auth.mjs';
import { isReady, readyBody } from './ready.mjs';

const state = { generate: null, catalog: [], samplePayloads: {}, catalogSource: 'loading' };
async function init() {
  const loaded = await loadCatalog();
  state.catalog = loaded.catalog;
  state.samplePayloads = loaded.samplePayloads;
  state.catalogSource = loaded.source;
  state.generate = createGenerator({ catalog: loaded.catalog, samplePayloads: loaded.samplePayloads });
}
function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': config.corsOrigin });
  res.end(data);
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const method = req.method || 'GET';
  const reqId = req.headers['x-request-id'] || randomUUID();
  res.setHeader('x-request-id', reqId);
  if (method === 'GET' && url.pathname === '/ready') {
    const ok = isReady(state);
    return json(res, ok ? 200 : 503, readyBody(state));
  }
  if (method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { ok: true, version: config.version, catalogSource: state.catalogSource });
  }
  if (!isPublicPath(url.pathname) && !requireAuth(req, res)) return;
  if (!checkRateLimit(req, res)) return;
  if (method === 'GET' && url.pathname === '/templates') {
    return json(res, 200, { templates: state.catalog.flatMap((c) => c.ids), catalogSource: state.catalogSource });
  }
  return json(res, 404, { error: 'not_found', path: url.pathname, reqId });
});
init().then(() => server.listen(config.port, config.host, () => console.log(`listening :${config.port} (/ready)`))).catch((e) => { console.error(e); process.exit(1); });
export { server };
