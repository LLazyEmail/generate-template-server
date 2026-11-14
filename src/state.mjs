/**
 * Shared process state. Owned by handlers, not by the entry point.
 */
import { reloadCatalog } from './reload.mjs';

export const startedAt = Date.now();
export const state = {
  generate: null,
  catalog: [],
  samplePayloads: {},
  catalogSource: 'loading',
};

export async function init() {
  await reloadCatalog(state);
}
