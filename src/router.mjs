/**
 * Route table and dispatch. Keeps server.mjs thin.
 */
import { randomUUID } from 'node:crypto';
import { config } from './config.mjs';
import { inc } from './metrics.mjs';
import { logRequest } from './logger.mjs';
import { requireAuth, isPublicPath } from './auth.mjs';
import { checkRateLimit } from './rate-limit.mjs';
import { json, options } from './http.mjs';
import { serveDemo } from './static.mjs';
import {
  handleHealth,
  handleVersion,
  handleDocs,
  handleOpenApi,
  handleTemplates,
  handleTemplateById,
  handleSample,
  handleMetrics,
  handleRecent,
  handleReload,
  handleRender,
  handleRenderPreview,
  handleRenderMany,
  handleDownload,
} from './handlers.mjs';

export function createRequestListener({ state, startedAt }) {
  return async function onRequest(req, res) {
    const start = Date.now();
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const method = req.method || 'GET';
    const reqId = req.headers['x-request-id'] || randomUUID();
    res.setHeader('x-request-id', reqId);
    inc('requests');

    const origEnd = res.end;
    res.end = function (...args) {
      logRequest({
        reqId,
        method,
        path: url.pathname,
        status: res.statusCode,
        ms: Date.now() - start,
      });
      return origEnd.apply(this, args);
    };

    const ctx = { state, reqId, startedAt };

    if (method === 'OPTIONS') return options(res);
    if (method === 'GET' && url.pathname === '/demo') return serveDemo(res, config.corsOrigin);
    if (method === 'GET' && url.pathname === '/health') return handleHealth(res, ctx);
    if (method === 'GET' && url.pathname === '/version') return handleVersion(res);
    if (method === 'GET' && url.pathname === '/docs') return handleDocs(res);
    if (method === 'GET' && url.pathname === '/openapi.json') return handleOpenApi(res);

    if (!isPublicPath(url.pathname) && !requireAuth(req, res)) return;
    if (!checkRateLimit(req, res)) {
      inc('rate_limited');
      return;
    }

    const templateMatch = url.pathname.match(/^\/templates\/([^/]+)$/);
    if (method === 'GET' && templateMatch) {
      return handleTemplateById(decodeURIComponent(templateMatch[1]), res, ctx);
    }
    const sampleMatch = url.pathname.match(/^\/samples\/([^/]+)$/);
    if (method === 'GET' && sampleMatch) {
      return handleSample(decodeURIComponent(sampleMatch[1]), res, ctx);
    }

    if (method === 'GET' && url.pathname === '/templates') return handleTemplates(res, ctx);
    if (method === 'GET' && url.pathname === '/metrics' && config.enableMetrics) return handleMetrics(res);
    if (method === 'GET' && url.pathname === '/recent' && config.enableRecent) return handleRecent(res);
    if (method === 'POST' && url.pathname === '/reload') return handleReload(res, ctx);
    if (method === 'POST' && url.pathname === '/render') return handleRender(req, res, ctx);
    if (method === 'POST' && url.pathname === '/render-preview') return handleRenderPreview(req, res, ctx);
    if (method === 'POST' && url.pathname === '/render-many') return handleRenderMany(req, res, ctx);
    if (method === 'POST' && url.pathname === '/download') return handleDownload(req, res, ctx);

    return json(res, 404, { error: 'not_found', path: url.pathname, reqId });
  };
}
