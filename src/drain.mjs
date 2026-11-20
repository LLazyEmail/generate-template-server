/**
 * Tracks in-flight requests so shutdown can drain before exit.
 */
let inflight = 0;
let closing = false;

export function enter() {
  if (closing) {
    const err = new Error('server is shutting down');
    err.code = 'SHUTTING_DOWN';
    err.statusCode = 503;
    throw err;
  }
  inflight += 1;
}

export function leave() {
  inflight = Math.max(0, inflight - 1);
}

export function beginClose() {
  closing = true;
}

export function inflightCount() {
  return inflight;
}

export async function waitDrain(timeoutMs = 5000) {
  const start = Date.now();
  while (inflight > 0 && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 50));
  }
}
