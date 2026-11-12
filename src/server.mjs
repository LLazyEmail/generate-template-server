#!/usr/bin/env node
/**
 * Thin callable HTTP server.
 *
 * Contract:
 *   POST /render          { templateId, payload? }            → { html, templateId, ... }
 *   POST /render-many     { items: [{ templateId, payload }] } → zip (or JSON)
 *   GET  /templates        list available template ids
 *   GET  /health           { ok, version, catalogSource }
 *
 * Generation stays in `@llazyemail/generate-template`. This process only
 * handles HTTP, optional auth, catalog loading, and zip packaging.
 */

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createGenerator } from '@llazyemail/generate-template';
import archiver from 'archiver';
import { loadCatalog } from './load-catalog.mjs';
import { requireAuth } from './auth.mjs';

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';
const VERSION = process.env.npm_package_version ?? '0.1.0';

let generate;
let catalogSource = 'loading';

async function init() {
  const { catalog, samplePayloads, source } = await loadCatalog();
  catalogSource = source;
  generate = createGenerator({ catalog, samplePayloads });
  // keep reference for /templates
  generate._catalog = catalog;
  generate._samples = samplePayloads;
}

function json(res, status, body, extraHeaders = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(data),
    'access-control-allow-origin': '*',
    ...extraHeaders,
  });
  res.end(data);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

function log(reqId, msg, extra = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), reqId, msg, ...extra }));
}

async function handleRender(req, res, reqId) {
  const body = await readBody(req);
  if (body === null) return json(res, 400, { error: 'invalid_json', reqId });
  const templateId = body.templateId;
  if (!templateId) return json(res, 400, { error: 'templateId_required', reqId });

  try {
    const result = await generate.run({
      templateId,
      payload: body.payload,
    });
    log(reqId, 'render.ok', { templateId });
    return json(res, 200, {
      templateId: result.templateId ?? templateId,
      html: result.html,
      slug: result.slug,
      reqId,
    });
  } catch (err) {
    const code = err?.code ?? 'RENDER_FAILED';
    const status = code === 'UNKNOWN_TEMPLATE' ? 404 : 422;
    log(reqId, 'render.fail', { templateId, code });
    return json(res, status, {
      error: code,
      message: err?.message ?? String(err),
      reqId,
    });
  }
}

async function handleRenderMany(req, res, reqId) {
  const body = await readBody(req);
  if (body === null) return json(res, 400, { error: 'invalid_json', reqId });
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return json(res, 400, { error: 'items_required', reqId });

  const rendered = [];
  for (const item of items) {
    if (!item?.templateId) continue;
    try {
      const result = await generate.run({
        templateId: item.templateId,
        payload: item.payload,
      });
      const ext = (result.extension || 'html').replace(/^\./, '');
      rendered.push({
        name: `${result.slug ?? item.templateId}.${ext}`,
        content: result.html ?? result.content ?? '',
      });
    } catch (err) {
      return json(res, 422, {
        error: err?.code ?? 'RENDER_FAILED',
        templateId: item.templateId,
        message: err?.message ?? String(err),
        reqId,
      });
    }
  }

  const accept = String(req.headers.accept || '');
  if (accept.includes('application/json')) {
    return json(res, 200, { files: rendered, reqId });
  }

  res.writeHead(200, {
    'content-type': 'application/zip',
    'content-disposition': 'attachment; filename="artifacts.zip"',
    'access-control-allow-origin': '*',
    'x-request-id': reqId,
  });
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (e) => {
    console.error(e);
    res.destroy(e);
  });
  archive.pipe(res);
  for (const f of rendered) {
    archive.append(f.content, { name: f.name });
  }
  archive.finalize();
  log(reqId, 'render-many.ok', { count: rendered.length });
}

function handleTemplates(_req, res) {
  const catalog = generate?._catalog ?? [];
  const samples = generate?._samples ?? {};
  const ids = catalog.flatMap((c) => c.ids);
  return json(res, 200, {
    templates: ids,
    samples: Object.keys(samples),
    catalogSource,
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const method = req.method || 'GET';
  const reqId = req.headers['x-request-id'] || randomUUID();
  res.setHeader('x-request-id', reqId);

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,accept,authorization,x-api-key,x-request-id',
    });
    return res.end();
  }

  // health is always public
  if (method === 'GET' && url.pathname === '/health') {
    return json(res, 200, {
      ok: true,
      service: 'generate-template-server',
      version: VERSION,
      catalogSource,
    });
  }

  if (!requireAuth(req, res)) return;

  if (method === 'GET' && url.pathname === '/templates') {
    return handleTemplates(req, res);
  }
  if (method === 'POST' && url.pathname === '/render') {
    return handleRender(req, res, reqId);
  }
  if (method === 'POST' && url.pathname === '/render-many') {
    return handleRenderMany(req, res, reqId);
  }

  return json(res, 404, { error: 'not_found', path: url.pathname, reqId });
});

init()
  .then(() => {
    server.listen(PORT, HOST, () => {
      console.log(
        `generate-template-server ${VERSION} listening on http://${HOST}:${PORT} (catalog: ${catalogSource})`,
      );
    });
  })
  .catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });

export { server };
