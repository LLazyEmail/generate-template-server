#!/usr/bin/env node
/** Thin callable HTTP server. See README for endpoints. */
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

const startedAt = Date.now();
const state = { generate: null, catalog: [], samplePayloads: {}, catalogSource: 'loading' };

async function init() {
  const loaded = await loadCatalog();
  state.catalog = loaded.catalog;
  state.samplePayloads = loaded.samplePayloads;
  state.catalogSource = loaded.source;
  state.generate = createGenerator({ catalog: loaded.catalog, samplePayloads: loaded.samplePayloads });
}

function getGenerate() { return state.generate; }
function getCatalog() { return state.catalog; }
function getSamples() { return state.samplePayloads; }

const ENDPOINTS = [
  { method: 'GET', path: '/health', auth: false, desc: 'liveness' },
  { method: 'POST', path: '/reload', auth: true, desc: 'hot-reload catalog' },
  { method: 'POST', path: '/render', auth: true, desc: 'JSON HTML' },
  { method: 'POST', path: '/download', auth: true, desc: 'zip' },
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
  const result = await withTimeout(getGenerate().run({ templateId, payload }), `render ${templateId}`);
  inc('renders');
  return result;
}

function findSample(id) {
  const samples = getSamples();
  const key = Object.keys(samples).find((k) => k.toLowerCase() === String(id).toLowerCase());
  return key ? samples[key] : undefined;
}
function allTemplateIds() { return getCatalog().flatMap((c) => c.ids); }
function templateExists(id) {
  const lower = String(id).toLowerCase();
  return getCatalog().some((c) => c.ids.some((i) => i.toLowerCase() === lower));
}

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
    logError({ reqId, error: err?.message });
    const { status, body: errBody } = toHttpError(err);
    return json(res, status, { ...errBody, reqId });
  }
}

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
    const payload = item?.payload ?? findSample(id);
    try {
      const result = await runOne(id, payload);
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
  return json(res, 200, { templates: allTemplateIds(), samples: Object.keys(getSamples()), catalogSource: state.catalogSource });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const method = req.method || 'GET';
  const reqId = req.headers['x-request-id'] || randomUUID();
  res.setHeader('x-request-id', reqId);
  inc('requests');
  if (method === 'OPTIONS') {
    res.writeHead(204, { 'access-control-allow-origin': config.corsOrigin, 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,authorization,x-api-key,x-request-id' });
    return res.end();
  }
  if (method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { ok: true, version: config.version, catalogSource: state.catalogSource, uptime: Math.floor((Date.now() - startedAt) / 1000) });
  }
  if (!isPublicPath(url.pathname) && !requireAuth(req, res)) return;
  if (!checkRateLimit(req, res)) { inc('rate_limited'); return; }
  if (method === 'POST' && url.pathname === '/reload') return handleReload(req, res, reqId);
  if (method === 'GET' && url.pathname === '/templates') return handleTemplates(req, res);
  if (method === 'POST' && url.pathname === '/render') return handleRender(req, res, reqId);
  if (method === 'POST' && url.pathname === '/download') return handleDownload(req, res, reqId);
  return json(res, 404, { error: 'not_found', path: url.pathname, reqId });
});

init().then(() => server.listen(config.port, config.host, () => {
  console.log(`generate-template-server ${config.version} on http://${config.host}:${config.port}`);
})).catch((e) => { console.error(e); process.exit(1); });

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
export { server };
