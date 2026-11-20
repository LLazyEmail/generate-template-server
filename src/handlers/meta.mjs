/**
 * Health, docs, and other non-render handlers.
 * Catalog handlers live in catalog.mjs.
 */
import { config } from '../config.mjs';
import { json } from '../http.mjs';
import { snapshot } from '../metrics.mjs';
import { list as recentList } from '../recent.mjs';
import { serveDemo } from '../static.mjs';
import { isReady, readyBody } from '../ready.mjs';
import { cacheStats } from '../cache.mjs';
import { state, startedAt } from '../state.mjs';
import { ENDPOINTS } from '../endpoints.mjs';

export function handleHealth(res) {
  return json(res, 200, {
    ok: true,
    service: 'generate-template-server',
    version: config.version,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    catalogSource: state.catalogSource,
    cache: cacheStats(),
  });
}

export function handleReady(res) {
  const ok = isReady(state);
  return json(res, ok ? 200 : 503, readyBody(state));
}

export function handleCache(res) {
  return json(res, 200, cacheStats());
}

export function handleDemo(res) {
  return serveDemo(res, config.corsOrigin);
}

export function handleVersion(res) {
  return json(res, 200, { version: config.version });
}

export function handleDocs(res) {
  return json(res, 200, { endpoints: ENDPOINTS, version: config.version });
}

export function handleOpenApi(res) {
  return json(res, 200, {
    openapi: '3.0.3',
    info: { title: 'generate-template-server', version: config.version },
    paths: Object.fromEntries(
      ENDPOINTS.map((e) => [e.path, { [e.method.toLowerCase()]: { summary: e.desc } }]),
    ),
  });
}

export function handleMetrics(res) {
  if (!config.enableMetrics) return json(res, 404, { error: 'not_found' });
  return json(res, 200, snapshot());
}

export function handleRecent(res) {
  if (!config.enableRecent) return json(res, 404, { error: 'not_found' });
  return json(res, 200, { recent: recentList() });
}
