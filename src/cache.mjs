/**
 * Optional in-memory render cache.
 * Enabled when RENDER_CACHE=1. TTL via RENDER_CACHE_TTL_MS (default 60s).
 * Key is templateId + stable JSON of payload.
 */
const enabled = process.env.RENDER_CACHE === '1';
const TTL = Number(process.env.RENDER_CACHE_TTL_MS ?? 60_000);
const store = new Map();

function key(templateId, payload) {
  return templateId + '::' + JSON.stringify(payload ?? null);
}

export function cacheGet(templateId, payload) {
  if (!enabled) return undefined;
  const k = key(templateId, payload);
  const hit = store.get(k);
  if (!hit) return undefined;
  if (Date.now() - hit.at > TTL) {
    store.delete(k);
    return undefined;
  }
  return hit.value;
}

export function cacheSet(templateId, payload, value) {
  if (!enabled) return;
  store.set(key(templateId, payload), { at: Date.now(), value });
}

export function cacheStats() {
  return { enabled, size: store.size, ttlMs: TTL };
}

export function cacheClear() {
  store.clear();
}
