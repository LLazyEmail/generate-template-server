/**
 * Structured JSON logger. One line per request when ENABLE_REQUEST_LOG is not '0'.
 */
const enabled = process.env.ENABLE_REQUEST_LOG !== '0';

export function logRequest(info) {
  if (!enabled) return;
  console.log(
    JSON.stringify({
      level: 'info',
      ts: new Date().toISOString(),
      ...info,
    }),
  );
}

export function logError(info) {
  console.error(
    JSON.stringify({
      level: 'error',
      ts: new Date().toISOString(),
      ...info,
    }),
  );
}
