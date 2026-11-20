/**
 * Filter template ids by a case-insensitive substring.
 */
export function searchTemplates(ids, query) {
  if (!query) return ids;
  const q = String(query).toLowerCase();
  return ids.filter((id) => id.toLowerCase().includes(q));
}
