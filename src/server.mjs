#!/usr/bin/env node
/**
 * Thin callable HTTP server.
 *
 * Endpoints:
 *   POST /render           { templateId, payload? } → JSON { html, ... }
 *   POST /render-preview   { templateId, payload? } → text/html (iframe)
 *   POST /render-many      { items, parallel? }     → zip or JSON
 *   POST /download         { items?, templateIds?, all?, includeIndex?, artifactName? }
 *                          → zip (mirrors email-template-workflows zip-artifact)
 *   GET  /templates
 *   GET  /templates/:id
 *   GET  /samples/:id
 *   GET  /health
 *   GET  /version
 *   GET  /docs
 *   GET  /openapi.json
 *   GET  /metrics
 *   GET  /recent
 *
 * Generation stays in `@llazyemail/generate-template`.
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

const startedAt = Date.now();

let generate;
let catalog = [];
let samplePayloads = {};
let catalogSource = 'loading';

async function init() {
  const loaded = await loadCatalog();
  catalog = loaded.catalog;
  samplePayloads = loaded.samplePayloads;
  catalogSource = loaded.source;
  generate = createGenerator({ catalog, samplePayloads });
}

const ENDPOINTS = [
  { method: 'GET', path: '/health', auth: false, desc: 'liveness + uptime' },
  { method: 'GET', path: '/version', auth: false, desc: 'package version' },
  { method: 'GET', path: '/docs', auth: false, desc: 'endpoint list' },
  { method: 'GET', path: '/openapi.json', auth: false, desc: 'OpenAPI 3 stub' },
  { method: 'GET', path: '/templates', auth: true, desc: 'catalog ids' },
  { method: 'GET', path: '/templates/:id', auth: true, desc: 'exists + hasSample' },
  { method: 'GET', path: '/samples/:id', auth: true, desc: 'sample payload' },
  { method: 'GET', path: '/metrics', auth: true, desc: 'counters' },
  { method: 'GET', path: '/recent', auth: true, desc: 'recent renders' },
  { method: 'POST', path: '/render', auth: true, desc: 'JSON HTML' },
  { method: 'POST', path: '/render-preview', auth: true, desc: 'raw HTML for iframe' },
  { method: 'POST', path: '/render-many', auth: true, desc: 'zip or JSON; optional parallel' },
  { method: 'POST', path: '/download', auth: true, desc: 'zip of files + optional index (workflows-compatible)' },
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
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

async function runOne(templateId, payload) {
  const result = await withTimeout(
    generate.run({ templateId, payload }),
    `render ${templateId}`,
  );
  inc('renders');
  return result;
}

function findSample(id) {
  const key = Object.keys(samplePayloads).find(
    (k) => k.toLowerCase() === String(id).toLowerCase(),
  );
  return key ? samplePayloads[key] : undefined;
}

function templateExists(id) {
  const lower = String(id).toLowerCase();
  return catalog.some((c) => c.ids.some((i) => i.toLowerCase() === lower));
}

function allTemplateIds() {
  return catalog.flatMap((c) => c.ids);
}

async function handleRender(req, res, reqId) {
  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    const { status, body: errBody } = toHttpError(err);
    return json(res, status, { ...errBody, reqId });
  }
  if (body === null) return json(res, 400, { error: 'invalid_json', reqId });
  const templateId = body.templateId;
  if (!templateId) return json(res, 400, { error: 'templateId_required', reqId });

  try {
    const result = await runOne(templateId, body.payload);
    record({ templateId, reqId, slug: result.slug });
    return json(res, 200, {
      templateId: result.templateId ?? templateId,
      html: result.html,
      slug: result.slug,
      reqId,
    });
  } catch (err) {
    inc('render_errors');
    logError({ reqId, templateId, error: err?.message, code: err?.code });
    const { status, body: errBody } = toHttpError(err);
    return json(res, status, { ...errBody, reqId });
  }
}

async function handleRenderPreview(req, res, reqId) {
  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    const { status, body: errBody } = toHttpError(err);
    return json(res, status, { ...errBody, reqId });
  }
  if (body === null) return json(res, 400, { error: 'invalid_json', reqId });
  const templateId = body.templateId;
  if (!templateId) return json(res, 400, { error: 'templateId_required', reqId });

  try {
    const result = await runOne(templateId, body.payload);
    record({ templateId, reqId, slug: result.slug, preview: true });
    return html(res, 200, result.html ?? '');
  } catch (err) {
    inc('render_errors');
    const { status, body: errBody } = toHttpError(err);
    return json(res, status, { ...errBody, reqId });
  }
}

async function handleRenderMany(req, res, reqId) {
  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    const { status, body: errBody } = toHttpError(err);
    return json(res, status, { ...errBody, reqId });
  }
  if (body === null) return json(res, 400, { error: 'invalid_json', reqId });
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return json(res, 400, { error: 'items_required', reqId });

  const tasks = items
    .filter((item) => item?.templateId)
    .map(async (item) => {
      const result = await runOne(item.templateId, item.payload);
      record({ templateId: item.templateId, reqId, slug: result.slug });
      return {
        name: `${result.slug ?? item.templateId}.html`,
        html: result.html,
      };
    });

  let rendered;
  try {
    rendered = body.parallel ? await Promise.all(tasks) : await sequential(tasks);
  } catch (err) {
    inc('render_errors');
    const { status, body: errBody } = toHttpError(err);
    return json(res, status, { ...errBody, reqId });
  }

  const accept = String(req.headers.accept || '');
  if (accept.includes('application/json')) {
    return json(res, 200, { files: rendered, reqId });
  }

  res.writeHead(200, {
    'content-type': 'application/zip',
    'content-disposition': 'attachment; filename="artifacts.zip"',
    'access-control-allow-origin': config.corsOrigin,
    'x-request-id': reqId,
  });
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (e) => {
    console.error(e);
    res.destroy(e);
  });
  archive.pipe(res);
  for (const f of rendered) {
    archive.append(f.html, { name: f.name });
  }
  archive.finalize();
  inc('zips');
}

/**
 * Dedicated download path.
 * Body:
 *   { items?: [{templateId, payload?}], templateIds?: string[], all?: boolean,
 *     includeIndex?: boolean, artifactName?: string, productName?: string }
 * Returns a zip. When includeIndex is true (default), an index.html is added
 * so the archive matches the shape produced by email-template-workflows
 * with zip-artifact: true.
 */
async function handleDownload(req, res, reqId) {
  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    const { status, body: errBody } = toHttpError(err);
    return json(res, status, { ...errBody, reqId });
  }
  if (body === null) return json(res, 400, { error: 'invalid_json', reqId });

  let ids = [];
  if (body.all) {
    ids = allTemplateIds();
  } else if (Array.isArray(body.templateIds)) {
    ids = body.templateIds;
  } else if (Array.isArray(body.items)) {
    ids = body.items.map((i) => i.templateId).filter(Boolean);
  }

  if (ids.length === 0) {
    return json(res, 400, { error: 'nothing_to_render', reqId });
  }

  const files = [];
  for (const id of ids) {
    const item = Array.isArray(body.items)
      ? body.items.find((i) => i.templateId === id)
      : null;
    const payload = item?.payload ?? findSample(id);
    try {
      const result = await runOne(id, payload);
      const name = `${result.slug ?? id}.html`;
      files.push({ name, content: result.html ?? '' });
      record({ templateId: id, reqId, slug: result.slug, download: true });
    } catch (err) {
      inc('render_errors');
      const { status, body: errBody } = toHttpError(err);
      return json(res, status, { ...errBody, templateId: id, reqId });
    }
  }

  const includeIndex = body.includeIndex !== false;
  const productName = body.productName || 'files';
  if (includeIndex) {
    files.unshift({
      name: 'index.html',
      content: buildIndex(files, productName),
    });
  }

  const artifactName = body.artifactName || 'rendered';
  inc('downloads');
  sendZip(res, files, artifactName, config.corsOrigin);
}

async function sequential(tasks) {
  const out = [];
  for (const t of tasks) out.push(await t);
  return out;
}

function handleTemplates(_req, res) {
  const ids = allTemplateIds();
  return json(res, 200, {
    templates: ids,
    samples: Object.keys(samplePayloads),
    catalogSource,
  });
}

function handleTemplateById(id, res) {
  const exists = templateExists(id);
  if (!exists) return json(res, 404, { error: 'UNKNOWN_TEMPLATE', templateId: id });
  return json(res, 200, {
    templateId: id,
    exists: true,
    hasSample: findSample(id) !== undefined,
  });
}

function handleSample(id, res) {
  const sample = findSample(id);
  if (sample === undefined) {
    return json(res, 404, { error: 'NO_SAMPLE', templateId: id });
  }
  return json(res, 200, { templateId: id, payload: sample });
}

function openApiStub() {
  return {
    openapi: '3.0.3',
    info: { title: 'generate-template-server', version: config.version },
    paths: Object.fromEntries(
      ENDPOINTS.map((e) => [e.path, { [e.method.toLowerCase()]: { summary: e.desc } }]),
    ),
  };
}

const server = createServer(async (req, res) => {
  const start = Date.now();
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const method = req.method || 'GET';
  const reqId = req.headers['x-request-id'] || randomUUID();
  res.setHeader('x-request-id', reqId);
  inc('requests');

  const finish = (status) => {
    logRequest({
      reqId,
      method,
      path: url.pathname,
      status,
      ms: Date.now() - start,
    });
  };

  const origEnd = res.end;
  res.end = function (...args) {
    finish(res.statusCode);
    return origEnd.apply(this, args);
  };

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': config.corsOrigin,
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,accept,authorization,x-api-key,x-request-id',
    });
    return res.end();
  }

  if (method === 'GET' && url.pathname === '/health') {
    return json(res, 200, {
      ok: true,
      service: 'generate-template-server',
      version: config.version,
      uptime: Math.floor((Date.now() - startedAt) / 1000),
      catalogSource,
    });
  }
  if (method === 'GET' && url.pathname === '/version') {
    return json(res, 200, { version: config.version });
  }
  if (method === 'GET' && url.pathname === '/docs') {
    return json(res, 200, { endpoints: ENDPOINTS, version: config.version });
  }
  if (method === 'GET' && url.pathname === '/openapi.json') {
    return json(res, 200, openApiStub());
  }

  if (!isPublicPath(url.pathname) && !requireAuth(req, res)) return;

  if (!checkRateLimit(req, res)) {
    inc('rate_limited');
    return;
  }

  const templateMatch = url.pathname.match(/^\/templates\/([^/]+)$/);
  if (method === 'GET' && templateMatch) return handleTemplateById(decodeURIComponent(templateMatch[1]), res);

  const sampleMatch = url.pathname.match(/^\/samples\/([^/]+)$/);
  if (method === 'GET' && sampleMatch) return handleSample(decodeURIComponent(sampleMatch[1]), res);

  if (method === 'GET' && url.pathname === '/templates') return handleTemplates(req, res);
  if (method === 'GET' && url.pathname === '/metrics' && config.enableMetrics) {
    return json(res, 200, snapshot());
  }
  if (method === 'GET' && url.pathname === '/recent' && config.enableRecent) {
    return json(res, 200, { recent: recentList() });
  }
  if (method === 'POST' && url.pathname === '/render') return handleRender(req, res, reqId);
  if (method === 'POST' && url.pathname === '/render-preview') return handleRenderPreview(req, res, reqId);
  if (method === 'POST' && url.pathname === '/render-many') return handleRenderMany(req, res, reqId);
  if (method === 'POST' && url.pathname === '/download') return handleDownload(req, res, reqId);

  return json(res, 404, { error: 'not_found', path: url.pathname, reqId });
});

init()
  .then(() => {
    server.listen(config.port, config.host, () => {
      console.log(
        `generate-template-server ${config.version} listening on http://${config.host}:${config.port} (catalog: ${catalogSource})`,
      );
    });
  })
  .catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });

function shutdown() {
  console.log('shutting down');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { server };
