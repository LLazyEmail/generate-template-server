/**
 * Dedicated download path. Renders and zips with optional index.
 */
import { config } from '../config.mjs';
import { json, readBody } from '../http.mjs';
import { toHttpError } from '../errors.mjs';
import { buildIndex, sendZip } from '../download.mjs';
import { runOne } from '../run.mjs';
import { findSample, allTemplateIds } from '../catalog-helpers.mjs';

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
  if (body.includeIndex !== false) {
    files.unshift({ name: 'index.html', content: buildIndex(files, body.productName || 'files') });
  }
  sendZip(res, files, body.artifactName || 'rendered', config.corsOrigin);
}
