/**
 * Tiny ring buffer of recent successful renders (templateId + timestamp + reqId).
 * Useful for debugging and the online editor "recent" sidebar.
 */
const limit = Number(process.env.RECENT_LIMIT ?? 50);
const items = [];

export function record(entry) {
  items.unshift({ ...entry, at: new Date().toISOString() });
  if (items.length > limit) items.length = limit;
}

export function list() {
  return items.slice();
}
