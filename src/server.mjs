#!/usr/bin/env node
/**
 * Thin callable HTTP server.
 * Optional render cache when RENDER_CACHE=1.
 */
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
import { logRequest, logError } from './logger.mjs';
import { loadCatalog } from './load-catalog.mjs';
import { requireAuth, isPublicPath } from './auth.mjs';
import { buildIndex, sendZip } from './download.mjs';
import { reloadCatalog } from './reload.mjs';
import { cacheGet, cacheSet, cacheStats } from './cache.mjs';

const startedAt = Date.now();
const state = { generate: null, catalog: [], samplePayloads: {}, catalogSource: 'loading' };

async function init() {
  await reloadCatalog(state);
}

const ENDPOINTS = [
  { method: 'GET', path: '/health', auth: false, desc: 'liveness + uptime' },
  { method: 'GET', path: '/version', auth: false, desc: 'package version' },
  { method: 'GET', path: '/docs', auth: false, desc: 'endpoint list' },
  { method: 'GET', path: '/openapi.json', auth: false, desc: 'OpenAPI 3 stub' },
  { method: 'GET', path: '/cache', auth: true, desc: 'render cache stats' },
  { method: 'GET', path: '/templates', auth: true, desc: 'catalog ids' },
  { method: 'GET', path: '/templates/:id', auth: true, desc: 'exists + hasSample' },
  { method: 'GET', path: '/samples/:id', auth: true, desc: 'sample payload' },
  { method: 'GET', path: '/metrics', auth: true, desc: 'counters' },
  { method: 'GET', path: '/recent', auth: true, desc: 'recent renders' },
  { method: 'POST', path: '/reload', auth: true, desc: 'hot-reload catalog' },
  { method: 'POST', path: '/render', auth: true, desc: 'JSON HTML' },
  { method: 'POST', path: '/render-preview', auth: true, desc: 'raw HTML for iframe' },
  { method: 'POST', path: '/render-many', auth: true, desc: 'zip or JSON' },
  { method: 'POST', path: '/download', auth: true, desc: 'zip of files + optional index' },
];

function json(res, status, body, extra = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(data),
    'access-control-allow-origin': config.corsOrigin,
    ...extra,
  });
  res.end(data);
}
function html(res, status, content) {
  const data = Buffer.from(content, 'utf8');
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'content-length': data.length,
    'access-control-allow-origin': config.corsOrigin,
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data: https:;",
  });
  res.end(data);
}
async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const c of req) {
    total += c.length;
    if (total > config.maxBodyBytes) {
      const err = new Error('body too large');
      err.code = 'BODY_TOO_LARGE';
      err.statusCode = 413;
      throw err;
    }
    chunks.push(c);
  }
  if (chunks.length === 0) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; }
}
async function runOne(templateId, payload) {
  const hit = cacheGet(templateId, payload);
  if (hit) {
    inc('cache_hits');
    return hit;
  }
  const result = await withTimeout(state.generate.run({ templateId, payload }), `render ${templateId}`);
  cacheSet(templateId, payload, result);
  inc('renders');
  return result;
}
function findSample(id) {
  const key = Object.keys(state.samplePayloads).find((k) => k.toLowerCase() === String(id).toLowerCase());
  return key ? state.samplePayloads[key] : undefined;
}
function templateExists(id) {
  const lower = String(id).toLowerCase();
  return state.catalog.some((c) => c.ids.some((i) => i.toLowerCase() === lower));
}
function allTemplateIds() { return state.catalog.flatMap((c) => c.ids); }

async function handleReload(req, res, reqId) {
  try {
    const info = await reloadCatalog(state);
    return json(res, 200, { ...info, reqId });
  } catch (err) {
    const { status, body } = toHttpError(err);
    return json(res, status, { ...body, reqId });
  }
}
async function handleRender(req, res, reqId) {
  const body = await readBody(req);
  if (body === null) return json(res, 400, { error: 'invalid_json', reqId });
  if (!body.templateId) return json(res, 400, { error: 'templateId_required', reqId });
  try {
    const result = await runOne(body.templateId, body.payload);
    record({ templateId: body.templateId, reqId, slug: result.slug });
    return json(res, 200, { templateId: result.templateId ?? body.templateId, html: result.html, slug: result.slug, reqId });
  } catch (err) {
    inc('render_errors');
    const { status, body: errBody } = toHttpError(err);
    return json(res, status, { ...errBody, reqId });
  }
}
async function handleRenderPreview(req, res, reqId) {
  const body = await readBody(req);
  if (body === null) return json(res, 400, { error: 'invalid_json', reqId });
  if (!body.templateId) return json(res, 400, { error: 'templateId_required', reqId });
  try {
    const result = await runOne(body.templateId, body.payload);
    return html(res, 200, result.html ?? '');
  } catch (err) {
    const { status, body: errBody } = toHttpError(err);
    return json(res, status, { ...errBody, reqId });
  }
}
async function handleRenderMany(req, res, reqId) {
  const body = await readBody(req);
  if (body === null) return json(res, 400, { error: 'invalid_json', reqId });
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return json(res, 400, { error: 'items_required', reqId });
  const tasks = items.filter((i) => i?.templateId).map(async (item) => {
    const result = await runOne(item.templateId, item.payload);
    return { name: `${result.slug ?? item.templateId}.html`, html: result.html };
  });
  let rendered;
  try { rendered = body.parallel ? await Promise.all(tasks) : await sequential(tasks); }
  catch (err) {
    const { status, body: errBody } = toHttpError(err);
    return json(res, status, { ...errBody, reqId });
  }
  if (String(req.headers.accept || '').includes('application/json')) return json(res, 200, { files: rendered, reqId });
  res.writeHead(200, { 'content-type': 'application/zip', 'content-disposition': 'attachment; filename="artifacts.zip"', 'access-control-allow-origin': config.corsOrigin });
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);
  for (const f of rendered) archive.append(f.html, { name: f.name });
  archive.finalize();
}
async function sequential(tasks) { const out = []; for (const t of tasks) out.push(await t); return out; }
async function handleDownload(req, res, reqId) {
  const body = await readBody(req);
  if (body === null) return json(res, 400, { error: 'invalid_json', reqId });
  let ids = [];
  if (body.all) ids = allTemplateIds();
  else if (Array.isArray(body.templateIds)) ids = body.templateIds;
  else if (Array.isArray(body.items)) ids = body.items.map((i) => i.templateId).filter(Boolean);
  if (ids.length === 0) return json(res, 400, { error: 'nothing_to_render', reqId });
  const files = [];
  for (const id of ids) {
    const item = Array.isArray(body.items) ? body.items.find((i) => i.templateId === id) : null;
    try {
      const result = await runOne(id, item?.payload ?? findSample(id));
      files.push({ name: `${result.slug ?? id}.html`, content: result.html ?? '' });
    } catch (err) {
      const { status, body: errBody } = toHttpError(err);
      return json(res, status, { ...errBody, templateId: id, reqId });
    }
  }
  if (body.includeIndex !== false) files.unshift({ name: 'index.html', content: buildIndex(files, body.productName || 'files') });
  sendZip(res, files, body.artifactName || 'rendered', config.corsOrigin);
}
function handleTemplates(_req, res) {
  return json(res, 200, { templates: allTemplateIds(), samples: Object.keys(state.samplePayloads), catalogSource: state.catalogSource });
}
function handleTemplateById(id, res) {
  if (!templateExists(id)) return json(res, 404, { error: 'UNKNOWN_TEMPLATE', templateId: id });
  return json(res, 200, { templateId: id, exists: true, hasSample: findSample(id) !== undefined });
}
function handleSample(id, res) {
  const sample = findSample(id);
  if (sample === undefined) return json(res, 404, { error: 'NO_SAMPLE', templateId: id });
  return json(res, 200, { templateId: id, payload: sample });
}
function openApiStub() {
  return { openapi: '3.0.3', info: { title: 'generate-template-server', version: config.version }, paths: Object.fromEntries(ENDPOINTS.map((e) => [e.path, { [e.method.toLowerCase()]: { summary: e.desc } }])) };
}

const server = createServer(async (req, res) => {
  const start = Date.now();
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const method = req.method || 'GET';
  const reqId = req.headers['x-request-id'] || randomUUID();
  res.setHeader('x-request-id', reqId);
  inc('requests');
  const origEnd = res.end;
  res.end = function (...args) { logRequest({ reqId, method, path: url.pathname, status: res.statusCode, ms: Date.now() - start }); return origEnd.apply(this, args); };
  if (method === 'OPTIONS') {
    res.writeHead(204, { 'access-control-allow-origin': config.corsOrigin, 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,accept,authorization,x-api-key,x-request-id' });
    return res.end();
  }
  if (method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true, service: 'generate-template-server', version: config.version, uptime: Math.floor((Date.now() - startedAt) / 1000), catalogSource: state.catalogSource, cache: cacheStats() });
  if (method === 'GET' && url.pathname === '/version') return json(res, 200, { version: config.version });
  if (method === 'GET' && url.pathname === '/docs') return json(res, 200, { endpoints: ENDPOINTS, version: config.version });
  if (method === 'GET' && url.pathname === '/openapi.json') return json(res, 200, openApiStub());
  if (!isPublicPath(url.pathname) && !requireAuth(req, res)) return;
  if (!checkRateLimit(req, res)) { inc('rate_limited'); return; }
  if (method === 'GET' && url.pathname === '/cache') return json(res, 200, cacheStats());
  const templateMatch = url.pathname.match(/^\/templates\/([^/]+)$/);
  if (method === 'GET' && templateMatch) return handleTemplateById(decodeURIComponent(templateMatch[1]), res);
  const sampleMatch = url.pathname.match(/^\/samples\/([^/]+)$/);
  if (method === 'GET' && sampleMatch) return handleSample(decodeURIComponent(sampleMatch[1]), res);
  if (method === 'GET' && url.pathname === '/templates') return handleTemplates(req, res);
  if (method === 'GET' && url.pathname === '/metrics' && config.enableMetrics) return json(res, 200, snapshot());
  if (method === 'GET' && url.pathname === '/recent' && config.enableRecent) return json(res, 200, { recent: recentList() });
  if (method === 'POST' && url.pathname === '/reload') return handleReload(req, res, reqId);
  if (method === 'POST' && url.pathname === '/render') return handleRender(req, res, reqId);
  if (method === 'POST' && url.pathname === '/render-preview') return handleRenderPreview(req, res, reqId);
  if (method === 'POST' && url.pathname === '/render-many') return handleRenderMany(req, res, reqId);
  if (method === 'POST' && url.pathname === '/download') return handleDownload(req, res, reqId);
  return json(res, 404, { error: 'not_found', path: url.pathname, reqId });
});

init().then(() => server.listen(config.port, config.host, () => {
  console.log(`generate-template-server ${config.version} listening on http://${config.host}:${config.port} (catalog: ${state.catalogSource})`);
})).catch((err) => { console.error('Failed to start:', err); process.exit(1); });
function shutdown() { server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 5000).unref(); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
export { server };
