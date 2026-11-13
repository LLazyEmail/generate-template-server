#!/usr/bin/env node
/** Thin callable HTTP server. Adds GET /demo that serves examples/client.html. */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createGenerator } from '@llazyemail/generate-template';
import archiver from 'archiver';
import { checkRateLimit } from './rate-limit.mjs';
import { toHttpError } from './errors.mjs';
import { config } from './config.mjs';
import { inc, snapshot } from './metrics.mjs';
import { record, list as recentList } from './recent.mjs';
import { withTimeout } from './timeout.mjs';
import { logRequest } from './logger.mjs';
import { loadCatalog } from './load-catalog.mjs';
import { requireAuth, isPublicPath } from './auth.mjs';
import { buildIndex, sendZip } from './download.mjs';
import { serveDemo } from './static.mjs';

const startedAt = Date.now();
let generate, catalog = [], samplePayloads = {}, catalogSource = 'loading';
async function init() {
  const loaded = await loadCatalog();
  catalog = loaded.catalog; samplePayloads = loaded.samplePayloads; catalogSource = loaded.source;
  generate = createGenerator({ catalog, samplePayloads });
}
const ENDPOINTS = [
  { method: 'GET', path: '/demo', auth: false, desc: 'browser client example' },
  { method: 'GET', path: '/health', auth: false, desc: 'liveness' },
  { method: 'POST', path: '/render', auth: true, desc: 'JSON HTML' },
  { method: 'POST', path: '/download', auth: true, desc: 'zip' },
];
function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': config.corsOrigin });
  res.end(data);
}
async function readBody(req) {
  const chunks = []; let total = 0;
  for await (const c of req) { total += c.length; if (total > config.maxBodyBytes) throw Object.assign(new Error('body too large'), { code: 'BODY_TOO_LARGE', statusCode: 413 }); chunks.push(c); }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; }
}
async function runOne(templateId, payload) {
  const result = await withTimeout(generate.run({ templateId, payload }), `render ${templateId}`);
  inc('renders'); return result;
}
function findSample(id) { const k = Object.keys(samplePayloads).find((x) => x.toLowerCase() === String(id).toLowerCase()); return k ? samplePayloads[k] : undefined; }
function allIds() { return catalog.flatMap((c) => c.ids); }

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const method = req.method || 'GET';
  const reqId = req.headers['x-request-id'] || randomUUID();
  res.setHeader('x-request-id', reqId);
  if (method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': config.corsOrigin }); return res.end(); }
  if (method === 'GET' && url.pathname === '/demo') return serveDemo(res, config.corsOrigin);
  if (method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true, version: config.version, catalogSource });
  if (!isPublicPath(url.pathname) && !requireAuth(req, res)) return;
  if (!checkRateLimit(req, res)) return;
  if (method === 'GET' && url.pathname === '/templates') return json(res, 200, { templates: allIds(), catalogSource });
  if (method === 'POST' && url.pathname === '/render') {
    const body = await readBody(req);
    if (!body?.templateId) return json(res, 400, { error: 'templateId_required', reqId });
    try {
      const result = await runOne(body.templateId, body.payload);
      return json(res, 200, { html: result.html, slug: result.slug, reqId });
    } catch (err) {
      const { status, body: e } = toHttpError(err);
      return json(res, status, { ...e, reqId });
    }
  }
  if (method === 'POST' && url.pathname === '/download') {
    const body = await readBody(req);
    const ids = body?.all ? allIds() : (body?.templateIds || []);
    if (!ids.length) return json(res, 400, { error: 'nothing_to_render', reqId });
    const files = [];
    for (const id of ids) {
      const result = await runOne(id, findSample(id));
      files.push({ name: `${result.slug ?? id}.html`, content: result.html ?? '' });
    }
    files.unshift({ name: 'index.html', content: buildIndex(files) });
    return sendZip(res, files, 'rendered', config.corsOrigin);
  }
  return json(res, 404, { error: 'not_found', path: url.pathname, reqId });
});
init().then(() => server.listen(config.port, config.host, () => console.log(`listening on :${config.port} (demo at /demo)`))).catch((e) => { console.error(e); process.exit(1); });
export { server };
