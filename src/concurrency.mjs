/**
 * Limits concurrent generator runs.
 * Set RENDER_CONCURRENCY (default 8). Excess requests wait or 503.
 */
const limit = Number(process.env.RENDER_CONCURRENCY ?? 8);
let active = 0;
const queue = [];

export function concurrencyStats() {
  return { limit, active, queued: queue.length };
}

export async function withConcurrency(fn) {
  if (active >= limit) {
    await new Promise((resolve) => queue.push(resolve));
  }
  active += 1;
  try {
    return await fn();
  } finally {
    active -= 1;
    const next = queue.shift();
    if (next) next();
  }
}
