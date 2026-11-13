#!/usr/bin/env node
/**
 * Thin callable HTTP server.
 *
 * Endpoints:
 *   POST /render           { templateId, payload? } → JSON { html, ... }
 *   POST /render-preview   { templateId, payload? } → text/html (iframe)
 *   POST /render-many      { items: [...] }         → zip or JSON
 *   GET  /templates
 *   GET  /health
 *   GET  /version
 *   GET  /docs             machine-readable endpoint list
 *   GET  /metrics          counters (if enabled)
 *   GET  /recent           recent successful renders (if enabled)
 *
 * Generation stays in `@llazyemail/generate-template`.
 */

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createGenerator } from '@llazyemail/generate-template';
import archiver from 'archiver';
import { demoCatalog, samplePayloads } from './catalog.mjs';
import { checkRateLimit } from './rate-limit.mjs';
import { toHttpError } from './errors.mjs';
import { config } from './config.mjs';
import { inc, snapshot } from './metrics.mjs';
import { record, list as recentList } from './recent.mjs';

const generate = createGenerator({
  catalog: demoCatalog,
  samplePayloads,
});

const ENDPOINTS = [
  { method: 'GET', path: '/health', auth: false, desc: 'liveness' },
  { method: 'GET', path: '/version', auth: false, desc: 'package version' },
  { method: 'GET', path: '/docs', auth: false, desc: 'this list' },
  { method: 'GET', path: '/templates', auth: true, desc: 'catalog ids' },
  { method: 'GET', path: '/metrics', auth: true, desc: 'counters' },
  { method: 'GET', path: '/recent', auth: true, desc: 'recent renders' },
  { method: 'POST', path: '/render', auth: true, desc: 'JSON HTML' },
  { method: 'POST', path: '/render-preview', auth: true, desc: 'raw HTML for iframe' },
  { method: 'POST', path: '/render-many', auth: true, desc: 'zip or JSON list' },
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
  const result = await generate.run({ templateId, payload });
  inc('renders');
  return result;
}

function contentTypeFor(result, accept) {
  if (accept?.includes('text/markdown') && result.markdown) return 'text/markdown';
  if (accept?.includes('text/plain') && result.text) return 'text/plain';
  return 'application/json';
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
    const payload = {
      templateId: result.templateId ?? templateId,
      html: result.html,
      slug: result.slug,
      reqId,
    };
    const accept = String(req.headers.accept || '');
    const ct = contentTypeFor(result, accept);
    if (ct === 'text/markdown' && result.markdown) {
      res.writeHead(200, {
        'content-type': 'text/markdown; charset=utf-8',
        'access-control-allow-origin': config.corsOrigin,
        'x-request-id': reqId,
      });
      return res.end(result.markdown);
    }
    return json(res, 200, payload);
  } catch (err) {
    inc('render_errors');
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

  const rendered = [];
  for (const item of items) {
    if (!item?.templateId) continue;
    try {
      const result = await runOne(item.templateId, item.payload);
      rendered.push({
        name: `${result.slug ?? item.templateId}.html`,
        html: result.html,
      });
      record({ templateId: item.templateId, reqId, slug: result.slug });
    } catch (err) {
      inc('render_errors');
      const { status, body: errBody } = toHttpError(err);
      return json(res, status, { ...errBody, templateId: item.templateId, reqId });
    }
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

function handleTemplates(_req, res) {
  const ids = demoCatalog.flatMap((c) => c.ids);
  return json(res, 200, { templates: ids, samples: Object.keys(samplePayloads) });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const method = req.method || 'GET';
  const reqId = req.headers['x-request-id'] || randomUUID();
  res.setHeader('x-request-id', reqId);
  inc('requests');

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': config.corsOrigin,
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,accept,authorization,x-api-key,x-request-id',
    });
    return res.end();
  }

  if (method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { ok: true, service: 'generate-template-server', version: config.version });
  }
  if (method === 'GET' && url.pathname === '/version') {
    return json(res, 200, { version: config.version });
  }
  if (method === 'GET' && url.pathname === '/docs') {
    return json(res, 200, { endpoints: ENDPOINTS, version: config.version });
  }

  if (!checkRateLimit(req, res)) {
    inc('rate_limited');
    return;
  }

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

  return json(res, 404, { error: 'not_found', path: url.pathname, reqId });
});

server.listen(config.port, config.host, () => {
  console.log(
    `generate-template-server ${config.version} listening on http://${config.host}:${config.port}`,
  );
});

function shutdown() {
  console.log('shutting down');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { server };
