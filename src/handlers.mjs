/**
 * Barrel for request handlers.
 * New handlers go in src/handlers/<domain>.mjs, then re-export here.
 */
export { init, startedAt, state } from './state.mjs';
export { ENDPOINTS } from './endpoints.mjs';
export { runOne } from './run.mjs';
export { findSample, templateExists, allTemplateIds } from './catalog-helpers.mjs';
export { handleRender, handleRenderPreview } from './handlers/render.mjs';
export { handleRenderMany } from './handlers/many.mjs';
export { handleDownload } from './handlers/download.mjs';
export {
  handleReload,
  handleTemplates,
  handleTemplateById,
  handleSample,
  handleHealth,
  handleReady,
  handleCache,
  handleDemo,
  handleVersion,
  handleDocs,
  handleOpenApi,
  handleMetrics,
  handleRecent,
} from './handlers/meta.mjs';
