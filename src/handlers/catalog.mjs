/**
 * Catalog handlers. Split from meta.mjs to stay under the CI 90-line limit.
 */
import { json } from '../http.mjs';
import { reloadCatalog } from '../reload.mjs';
import { toHttpError } from '../errors.mjs';
import { state } from '../state.mjs';
import { findSample, templateExists, allTemplateIds } from '../catalog-helpers.mjs';

export async function handleReload(req, res, reqId) {
  try {
    const info = await reloadCatalog(state);
    return json(res, 200, { ...info, reqId });
  } catch (err) {
    const { status, body } = toHttpError(err);
    return json(res, status, { ...body, reqId });
  }
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
