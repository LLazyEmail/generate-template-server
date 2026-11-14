/**
 * Catalog lookups used by handlers.
 */
import { state } from './state.mjs';

export function findSample(id) {
  const key = Object.keys(state.samplePayloads).find(
    (k) => k.toLowerCase() === String(id).toLowerCase(),
  );
  return key ? state.samplePayloads[key] : undefined;
}

export function templateExists(id) {
  const lower = String(id).toLowerCase();
  return state.catalog.some((c) => c.ids.some((i) => i.toLowerCase() === lower));
}

export function allTemplateIds() {
  return state.catalog.flatMap((c) => c.ids);
}
