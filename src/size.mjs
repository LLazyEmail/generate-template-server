/**
 * Rejects rendered HTML larger than MAX_HTML_BYTES (default 2MB).
 * Prevents accidental huge responses from clipping or OOM.
 */
const max = Number(process.env.MAX_HTML_BYTES ?? 2_000_000);

export function assertHtmlSize(html) {
  const bytes = Buffer.byteLength(html ?? '', 'utf8');
  if (bytes > max) {
    const err = new Error(`html exceeds ${max} bytes`);
    err.code = 'HTML_TOO_LARGE';
    err.statusCode = 413;
    throw err;
  }
  return bytes;
}
