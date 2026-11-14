/**
 * Request handlers. Called by the router.
 * Does not own HTTP framing or process lifecycle.
 */
import archiver from 'archiver';
import { config } from './config.mjs';
import { inc, snapshot } from './metrics.mjs';
import { record, list as recentList } from './recent.mjs';
import { withTimeout } from './timeout.mjs';
import { toHttpError } from './errors.mjs';
import { json, html, readBody } from './http.mjs';
import { buildIndex, sendZip } from './download.mjs';
import { reloadCatalog } from './reload.mjs';
import { serveDemo } from './static.mjs';
import { isReady, readyBody } from './ready.mjs';
import { cacheGet, cacheSet, cacheStats } from './cache.mjs';

export const startedAt = Date.now();
export const state = { generate: null, catalog: [], samplePayloads: {}, catalogSource: 'loading' };

export async function init() {
  await reloadCatalog(state);
}

export const ENDPOINTS = [
  { method: 'GET', path: '/health', auth: false, desc: 'liveness + uptime' },
  { method: 'GET', path: '/ready', auth: false, desc: 'readiness (catalog loaded)' },
  { method: 'GET', path: '/version', auth: false, desc: 'package version' },
  { method: 'GET', path: '/docs', auth: false, desc: 'endpoint list' },
  { method: 'GET', path: '/openapi.json', auth: false, desc: 'OpenAPI 3 stub' },
  { method: 'GET', path: '/demo', auth: false, desc: 'browser client example' },
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
function allTemplateIds() {
  return state.catalog.flatMap((c) => c.ids);
}

export async function handleReload(req, res, reqId) {
  try {
    const info = await reloadCatalog(state);
    return json(res, 200, { ...info, reqId });
  } catch (err) {
    const { status, body } = toHttpError(err);
    return json(res, status, { ...body, reqId });
  }
}

export async function handleRender(req, res, reqId) {
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

export async function handleRenderPreview(req, res, reqId) {
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

async function sequential(tasks) {
  const out = [];
  for (const t of tasks) out.push(await t);
  return out;
}

export async function handleRenderMany(req, res, reqId) {
  const body = await readBody(req);
  if (body === null) return json(res, 400, { error: 'invalid_json', reqId });
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return json(res, 400, { error: 'items_required', reqId });
  const tasks = items.filter((i) => i?.templateId).map(async (item) => {
    const result = await runOne(item.templateId, item.payload);
    return { name: `${result.slug ?? item.templateId}.html`, html: result.html };
  });
  let rendered;
  try {
    rendered = body.parallel ? await Promise.all(tasks) : await sequential(tasks);
  } catch (err) {
    const { status, body: errBody } = toHttpError(err);
    return json(res, status, { ...errBody, reqId });
  }
  if (String(req.headers.accept || '').includes('application/json')) return json(res, 200, { files: rendered, reqId });
  res.writeHead(200, {
    'content-type': 'application/zip',
    'content-disposition': 'attachment; filename="artifacts.zip"',
    'access-control-allow-origin': config.corsOrigin,
  });
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);
  for (const f of rendered) archive.append(f.html, { name: f.name });
  archive.finalize();
}

export async function handleDownload(req, res, reqId) {
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

export function handleTemplates(_req, res) {
  return json(res, 200, {
    templates: allTemplateIds(),
    samples: Object.keys(state.samplePayloads),
    catalogSource: state.catalogSource,
  });
}

export function handleTemplateById(id, res) {
  if (!templateExists(id)) return json(res, 404, { error: 'UNKNOWN_TEMPLATE', templateId: id });
  return json(res, 200, { templateId: id, exists: true, hasSample: findSample(id) !== undefined });
}

export function handleSample(id, res) {
  const sample = findSample(id);
  if (sample === undefined) return json(res, 404, { error: 'NO_SAMPLE', templateId: id });
  return json(res, 200, { templateId: id, payload: sample });
}

export function openApiStub() {
  return {
    openapi: '3.0.3',
    info: { title: 'generate-template-server', version: config.version },
    paths: Object.fromEntries(ENDPOINTS.map((e) => [e.path, { [e.method.toLowerCase()]: { summary: e.desc } }])),
  };
}

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
  return json(res, 200, openApiStub());
}

export function handleMetrics(res) {
  if (!config.enableMetrics) return json(res, 404, { error: 'not_found' });
  return json(res, 200, snapshot());
}

export function handleRecent(res) {
  if (!config.enableRecent) return json(res, 404, { error: 'not_found' });
  return json(res, 200, { recent: recentList() });
}
