/**
 * Single-template render with optional cache.
 */
import { inc } from './metrics.mjs';
import { withTimeout } from './timeout.mjs';
import { cacheGet, cacheSet } from './cache.mjs';
import { state } from './state.mjs';

export async function runOne(templateId, payload) {
  const hit = cacheGet(templateId, payload);
  if (hit) {
    inc('cache_hits');
    return hit;
  }
  const result = await withTimeout(
    state.generate.run({ templateId, payload }),
    `render ${templateId}`,
  );
  cacheSet(templateId, payload, result);
  inc('renders');
  return result;
}
