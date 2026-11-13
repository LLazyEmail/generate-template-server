/**
 * Lightweight counters. Exposed at GET /metrics when ENABLE_METRICS is not '0'.
 */
const counters = new Map();

export function inc(name, by = 1) {
  counters.set(name, (counters.get(name) ?? 0) + by);
}

export function snapshot() {
  return Object.fromEntries(counters);
}

export function reset() {
  counters.clear();
}
