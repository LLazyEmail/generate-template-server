/**
 * Request handlers. Pure functions of (req, res, ctx).
 * ctx = { state, reqId, startedAt }
 */
import archiver from 'archiver';
import { toHttpError } from './errors.mjs';
import { config } from './config.mjs';
import { inc, snapshot } from './metrics.mjs';
import { record, list as recentList } from './recent.mjs';
import { withTimeout } from './timeout.mjs';
import { buildIndex, sendZip } from './download.mjs';
import { reloadCatalog } from './reload.mjs';
import { json, html, readBody } from './http.mjs';

export const ENDPOINTS = [
  { method: 'GET', path: '/health', auth: false, desc: 'liveness + uptime' },
  { method: 'GET', path: '/version', auth: false, desc: 'package version' },
  { method: 'GET', path: '/docs', auth: false, desc: 'endpoint list' },
  { method: 'GET', path: '/openapi.json', auth: false, desc: 'OpenAPI 3 stub' },
  { method: 'GET', path: '/demo', auth: false, desc: 'browser client example' },
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

async function runOne(state, templateId, payload) {
  const result = await withTimeout(
    state.generate.run({ templateId, payload }),
    `render ${templateId}`,
  );
  inc('renders');
  return result;
}

function findSample(state, id) {
  const key = Object.keys(state.samplePayloads).find(
    (k) => k.toLowerCase() === String(id).toLowerCase(),
  );
  return key ? state.samplePayloads[key] : undefined;
}

function templateExists(state, id) {
  const lower = String(id).toLowerCase();
  return state.catalog.some((c) => c.ids.some((i) => i.toLowerCase() === lower));
}

function allTemplateIds(state) {
  return state.catalog.flatMap((c) => c.ids);
}

async function sequential(tasks) {
  const out = [];
  for (const t of tasks) out.push(await t);
  return out;
}

export async function handleHealth(res, ctx) {
  const { state, startedAt } = ctx;
  return json(res, 200, {
    ok: true,
    service: 'generate-template-server',
    version: config.version,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    catalogSource: state.catalogSource,
  });
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

export function handleTemplates(res, ctx) {
  const { state } = ctx;
  return json(res, 200, {
    templates: allTemplateIds(state),
    samples: Object.keys(state.samplePayloads),
    catalogSource: state.catalogSource,
  });
}

export function handleTemplateById(id, res, ctx) {
  if (!templateExists(ctx.state, id)) {
    return json(res, 404, { error: 'UNKNOWN_TEMPLATE', templateId: id });
  }
  return json(res, 200, {
    templateId: id,
    exists: true,
    hasSample: findSample(ctx.state, id) !== undefined,
  });
}

export function handleSample(id, res, ctx) {
  const sample = findSample(ctx.state, id);
  if (sample === undefined) return json(res, 404, { error: 'NO_SAMPLE', templateId: id });
  return json(res, 200, { templateId: id, payload: sample });
}

export function handleMetrics(res) {
  return json(res, 200, snapshot());
}

export function handleRecent(res) {
  return json(res, 200, { recent: recentList() });
}

export async function handleReload(res, ctx) {
  try {
    const info = await reloadCatalog(ctx.state);
    return json(res, 200, { ...info, reqId: ctx.reqId });
  } catch (err) {
    const { status, body } = toHttpError(err);
    return json(res, status, { ...body, reqId: ctx.reqId });
  }
}

export async function handleRender(req, res, ctx) {
  const body = await readBody(req);
  if (body === null) return json(res, 400, { error: 'invalid_json', reqId: ctx.reqId });
  if (!body.templateId) return json(res, 400, { error: 'templateId_required', reqId: ctx.reqId });
  try {
    const result = await runOne(ctx.state, body.templateId, body.payload);
    record({ templateId: body.templateId, reqId: ctx.reqId, slug: result.slug });
    return json(res, 200, {
      templateId: result.templateId ?? body.templateId,
      html: result.html,
      slug: result.slug,
      reqId: ctx.reqId,
    });
  } catch (err) {
    inc('render_errors');
    const { status, body: errBody } = toHttpError(err);
    return json(res, status, { ...errBody, reqId: ctx.reqId });
  }
}

export async function handleRenderPreview(req, res, ctx) {
  const body = await readBody(req);
  if (body === null) return json(res, 400, { error: 'invalid_json', reqId: ctx.reqId });
  if (!body.templateId) return json(res, 400, { error: 'templateId_required', reqId: ctx.reqId });
  try {
    const result = await runOne(ctx.state, body.templateId, body.payload);
    return html(res, 200, result.html ?? '');
  } catch (err) {
    const { status, body: errBody } = toHttpError(err);
    return json(res, status, { ...errBody, reqId: ctx.reqId });
  }
}

export async function handleRenderMany(req, res, ctx) {
  const body = await readBody(req);
  if (body === null) return json(res, 400, { error: 'invalid_json', reqId: ctx.reqId });
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return json(res, 400, { error: 'items_required', reqId: ctx.reqId });

  const tasks = items.filter((i) => i?.templateId).map(async (item) => {
    const result = await runOne(ctx.state, item.templateId, item.payload);
    return { name: `${result.slug ?? item.templateId}.html`, html: result.html };
  });

  let rendered;
  try {
    rendered = body.parallel ? await Promise.all(tasks) : await sequential(tasks);
  } catch (err) {
    const { status, body: errBody } = toHttpError(err);
    return json(res, status, { ...errBody, reqId: ctx.reqId });
  }

  if (String(req.headers.accept || '').includes('application/json')) {
    return json(res, 200, { files: rendered, reqId: ctx.reqId });
  }

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

export async function handleDownload(req, res, ctx) {
  const body = await readBody(req);
  if (body === null) return json(res, 400, { error: 'invalid_json', reqId: ctx.reqId });

  let ids = [];
  if (body.all) ids = allTemplateIds(ctx.state);
  else if (Array.isArray(body.templateIds)) ids = body.templateIds;
  else if (Array.isArray(body.items)) ids = body.items.map((i) => i.templateId).filter(Boolean);
  if (ids.length === 0) return json(res, 400, { error: 'nothing_to_render', reqId: ctx.reqId });

  const files = [];
  for (const id of ids) {
    const item = Array.isArray(body.items) ? body.items.find((i) => i.templateId === id) : null;
    try {
      const result = await runOne(ctx.state, id, item?.payload ?? findSample(ctx.state, id));
      files.push({ name: `${result.slug ?? id}.html`, content: result.html ?? '' });
    } catch (err) {
      const { status, body: errBody } = toHttpError(err);
      return json(res, status, { ...errBody, templateId: id, reqId: ctx.reqId });
    }
  }

  if (body.includeIndex !== false) {
    files.unshift({ name: 'index.html', content: buildIndex(files, body.productName || 'files') });
  }
  sendZip(res, files, body.artifactName || 'rendered', config.corsOrigin);
}
