/**
 * Single-template render handlers.
 */
import { json, html, readBody } from '../http.mjs';
import { record } from '../recent.mjs';
import { inc } from '../metrics.mjs';
import { toHttpError } from '../errors.mjs';
import { runOne } from '../run.mjs';

export async function handleRender(req, res, reqId) {
  const body = await readBody(req);
  if (body === null) return json(res, 400, { error: 'invalid_json', reqId });
  if (!body.templateId) return json(res, 400, { error: 'templateId_required', reqId });
  try {
    const result = await runOne(body.templateId, body.payload);
    record({ templateId: body.templateId, reqId, slug: result.slug });
    return json(res, 200, {
      templateId: result.templateId ?? body.templateId,
      html: result.html,
      slug: result.slug,
      reqId,
    });
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
