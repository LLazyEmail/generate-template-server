#!/usr/bin/env node
/**
 * Thin callable HTTP server.
 * Entry point only: init, listen, shutdown.
 * Routing lives in router.mjs. Handlers live in handlers.mjs.
 */
import { createServer } from 'node:http';
import { config } from './config.mjs';
import { dispatch } from './router.mjs';
import { init } from './handlers.mjs';

const server = createServer(dispatch);

init()
  .then(() =>
    server.listen(config.port, config.host, () => {
      console.log(`generate-template-server ${config.version} listening on http://${config.host}:${config.port}`);
    }),
  )
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
