/**
 * Hot-reload the catalog without restarting the process.
 * Used by POST /reload.
 */
import { loadCatalog } from './load-catalog.mjs';
import { createGenerator } from '@llazyemail/generate-template';

export async function reloadCatalog(state) {
  const loaded = await loadCatalog();
  state.catalog = loaded.catalog;
  state.samplePayloads = loaded.samplePayloads;
  state.catalogSource = loaded.source;
  state.generate = createGenerator({
    catalog: loaded.catalog,
    samplePayloads: loaded.samplePayloads,
  });
  state.reloadedAt = new Date().toISOString();
  return {
    ok: true,
    source: loaded.source,
    templates: loaded.catalog.flatMap((c) => c.ids),
    reloadedAt: state.reloadedAt,
  };
}
