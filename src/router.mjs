/**
 * Route table and dispatch.
 * New endpoints register here, not in server.mjs.
 */
import { randomUUID } from 'node:crypto';
import { json, options } from './http.mjs';
import { requireAuth, isPublicPath } from './auth.mjs';
import { checkRateLimit } from './rate-limit.mjs';
import { inc } from './metrics.mjs';
import { logRequest } from './logger.mjs';
import * as h from './handlers.mjs';

export async function dispatch(req, res) {
  const start = Date.now();
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const method = req.method || 'GET';
  const reqId = req.headers['x-request-id'] || randomUUID();
  res.setHeader('x-request-id', reqId);
  inc('requests');
  const origEnd = res.end;
  res.end = function (...args) {
    logRequest({ reqId, method, path: url.pathname, status: res.statusCode, ms: Date.now() - start });
    return origEnd.apply(this, args);
  };

  if (method === 'OPTIONS') return options(res);

  if (method === 'GET' && url.pathname === '/ready') return h.handleReady(res);
  if (method === 'GET' && url.pathname === '/demo') return h.handleDemo(res);
  if (method === 'GET' && url.pathname === '/health') return h.handleHealth(res);
  if (method === 'GET' && url.pathname === '/version') return h.handleVersion(res);
  if (method === 'GET' && url.pathname === '/docs') return h.handleDocs(res);
  if (method === 'GET' && url.pathname === '/openapi.json') return h.handleOpenApi(res);

  if (!isPublicPath(url.pathname) && !requireAuth(req, res)) return;
  if (!checkRateLimit(req, res)) {
    inc('rate_limited');
    return;
  }

  if (method === 'GET' && url.pathname === '/cache') return h.handleCache(res);

  const templateMatch = url.pathname.match(/^\/templates\/([^/]+)$/);
  if (method === 'GET' && templateMatch) return h.handleTemplateById(decodeURIComponent(templateMatch[1]), res);
  const sampleMatch = url.pathname.match(/^\/samples\/([^/]+)$/);
  if (method === 'GET' && sampleMatch) return h.handleSample(decodeURIComponent(sampleMatch[1]), res);

  if (method === 'GET' && url.pathname === '/templates') return h.handleTemplates(req, res);
  if (method === 'GET' && url.pathname === '/metrics') return h.handleMetrics(res);
  if (method === 'GET' && url.pathname === '/recent') return h.handleRecent(res);
  if (method === 'POST' && url.pathname === '/reload') return h.handleReload(req, res, reqId);
  if (method === 'POST' && url.pathname === '/render') return h.handleRender(req, res, reqId);
  if (method === 'POST' && url.pathname === '/render-preview') return h.handleRenderPreview(req, res, reqId);
  if (method === 'POST' && url.pathname === '/render-many') return h.handleRenderMany(req, res, reqId);
  if (method === 'POST' && url.pathname === '/download') return h.handleDownload(req, res, reqId);

  return json(res, 404, { error: 'not_found', path: url.pathname, reqId });
}
