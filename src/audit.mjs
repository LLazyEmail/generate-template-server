/**
 * In-memory audit log for mutations (reload, etc.).
 * Ring buffer. Size via AUDIT_LIMIT (default 100).
 */
const limit = Number(process.env.AUDIT_LIMIT ?? 100);
const entries = [];

export function audit(entry) {
  entries.unshift({ at: new Date().toISOString(), ...entry });
  if (entries.length > limit) entries.length = limit;
}

export function listAudit() {
  return entries.slice();
}
