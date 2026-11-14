/**
 * Multi-template render. Returns zip or JSON.
 */
import archiver from 'archiver';
import { config } from '../config.mjs';
import { json, readBody } from '../http.mjs';
import { toHttpError } from '../errors.mjs';
import { runOne } from '../run.mjs';

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
  if (String(req.headers.accept || '').includes('application/json')) {
    return json(res, 200, { files: rendered, reqId });
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
