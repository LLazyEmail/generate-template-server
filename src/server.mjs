#!/usr/bin/env node
/**
 * Thin callable HTTP server.
 *
 * Contract:
 *   POST /render          { templateId, payload? }           → { html, templateId, ... }
 *   POST /render-preview  { templateId, payload? }           → text/html (for iframes)
 *   POST /render-many     { items: [{ templateId, payload }] } → zip stream (or JSON if Accept: application/json)
 *   GET  /templates        list available template ids
 *   GET  /health           { ok: true }
 *
 * The generation contract is exactly `@llazyemail/generate-template` `run()`.
 * This process only handles HTTP, auth hooks, and zip packaging.
 */

import { createServer } from 'node:http';
import { createGenerator } from '@llazyemail/generate-template';
import archiver from 'archiver';
import { demoCatalog, samplePayloads } from './catalog.mjs';

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';

// In a real deployment this comes from a project config or mounted module.
const generate = createGenerator({
  catalog: demoCatalog,
  samplePayloads,
});

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(data),
    'access-control-allow-origin': '*',
  });
  res.end(data);
}

function html(res, status, content) {
  const data = Buffer.from(content, 'utf8');
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'content-length': data.length,
    'access-control-allow-origin': '*',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data: https:;",
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

async function runOne(templateId, payload) {
  return generate.run({ templateId, payload });
}

async function handleRender(req, res) {
  const body = await readBody(req);
  if (body === null) return json(res, 400, { error: 'invalid_json' });
  const templateId = body.templateId;
  if (!templateId) return json(res, 400, { error: 'templateId_required' });

  try {
    const result = await runOne(templateId, body.payload);
    return json(res, 200, {
      templateId: result.templateId ?? templateId,
      html: result.html,
      slug: result.slug,
    });
  } catch (err) {
    const code = err?.code ?? 'RENDER_FAILED';
    const status = code === 'UNKNOWN_TEMPLATE' ? 404 : 422;
    return json(res, status, {
      error: code,
      message: err?.message ?? String(err),
    });
  }
}

async function handleRenderPreview(req, res) {
  const body = await readBody(req);
  if (body === null) return json(res, 400, { error: 'invalid_json' });
  const templateId = body.templateId;
  if (!templateId) return json(res, 400, { error: 'templateId_required' });

  try {
    const result = await runOne(templateId, body.payload);
    return html(res, 200, result.html ?? '');
  } catch (err) {
    const code = err?.code ?? 'RENDER_FAILED';
    const status = code === 'UNKNOWN_TEMPLATE' ? 404 : 422;
    return json(res, status, {
      error: code,
      message: err?.message ?? String(err),
    });
  }
}

async function handleRenderMany(req, res) {
  const body = await readBody(req);
  if (body === null) return json(res, 400, { error: 'invalid_json' });
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return json(res, 400, { error: 'items_required' });

  const rendered = [];
  for (const item of items) {
    if (!item?.templateId) continue;
    try {
      const result = await runOne(item.templateId, item.payload);
      rendered.push({
        name: `${result.slug ?? item.templateId}.html`,
        html: result.html,
      });
    } catch (err) {
      return json(res, 422, {
        error: err?.code ?? 'RENDER_FAILED',
        templateId: item.templateId,
        message: err?.message ?? String(err),
      });
    }
  }

  const accept = String(req.headers.accept || '');
  if (accept.includes('application/json')) {
    return json(res, 200, { files: rendered });
  }

  res.writeHead(200, {
    'content-type': 'application/zip',
    'content-disposition': 'attachment; filename="templates.zip"',
    'access-control-allow-origin': '*',
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
}

async function handleTemplates(_req, res) {
  const ids = demoCatalog.flatMap((c) => c.ids);
  return json(res, 200, { templates: ids, samples: Object.keys(samplePayloads) });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const method = req.method || 'GET';

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,accept',
    });
    return res.end();
  }

  if (method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { ok: true, service: 'generate-template-server' });
  }
  if (method === 'GET' && url.pathname === '/templates') {
    return handleTemplates(req, res);
  }
  if (method === 'POST' && url.pathname === '/render') {
    return handleRender(req, res);
  }
  if (method === 'POST' && url.pathname === '/render-preview') {
    return handleRenderPreview(req, res);
  }
  if (method === 'POST' && url.pathname === '/render-many') {
    return handleRenderMany(req, res);
  }

  return json(res, 404, { error: 'not_found', path: url.pathname });
});

server.listen(PORT, HOST, () => {
  console.log(`generate-template-server listening on http://${HOST}:${PORT}`);
});

export { server };
