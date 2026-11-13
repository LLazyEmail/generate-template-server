#!/usr/bin/env node
/**
 * Thin entry. Wiring only.
 * Layers:
 *   http.mjs     — response helpers
 *   handlers.mjs — request handlers
 *   router.mjs   — route table + dispatch
 *   static.mjs   — GET /demo
 */
import { createServer } from 'node:http';
import { config } from './config.mjs';
import { reloadCatalog } from './reload.mjs';
import { createRequestListener } from './router.mjs';

const startedAt = Date.now();
const state = {
  generate: null,
  catalog: [],
  samplePayloads: {},
  catalogSource: 'loading',
};

async function init() {
  await reloadCatalog(state);
}

const server = createServer(createRequestListener({ state, startedAt }));

init()
  .then(() => {
    server.listen(config.port, config.host, () => {
      console.log(
        `generate-template-server ${config.version} listening on http://${config.host}:${config.port} (catalog: ${state.catalogSource})`,
      );
    });
  })
  .catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { server };
