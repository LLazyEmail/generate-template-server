/**
 * Catalog loader.
 *
 * Priority:
 *   1. process.env.CATALOG_PATH — path to an ESM module that default-exports
 *      { catalog, samplePayloads? }
 *   2. Built-in demo catalog (src/catalog.mjs)
 */
import { pathToFileURL } from 'node:url';
import { demoCatalog, samplePayloads as demoSamples } from './catalog.mjs';

export async function loadCatalog() {
  const catalogPath = process.env.CATALOG_PATH;
  if (!catalogPath) {
    return { catalog: demoCatalog, samplePayloads: demoSamples, source: 'demo' };
  }

  try {
    const mod = await import(pathToFileURL(catalogPath).href);
    const data = mod.default ?? mod;
    if (!data?.catalog || !Array.isArray(data.catalog)) {
      throw new Error('catalog module must default-export { catalog: [...] }');
    }
    return {
      catalog: data.catalog,
      samplePayloads: data.samplePayloads ?? {},
      source: catalogPath,
    };
  } catch (err) {
    console.error(`Failed to load catalog from ${catalogPath}:`, err);
    throw err;
  }
}
