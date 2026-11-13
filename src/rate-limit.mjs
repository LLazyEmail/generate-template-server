/**
 * Simple token-bucket style rate limiter (in-memory).
 *
 * Controlled by:
 *   RATE_LIMIT_WINDOW_MS  (default 60000)
 *   RATE_LIMIT_MAX        (default 60)
 *
 * Keyed by IP (x-forwarded-for or socket). Disabled when RATE_LIMIT_MAX=0.
 */
const WINDOW = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
const MAX = Number(process.env.RATE_LIMIT_MAX ?? 60);
const buckets = new Map();

export function checkRateLimit(req, res) {
  if (MAX <= 0) return true;

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  const now = Date.now();
  let bucket = buckets.get(ip);
  if (!bucket || now - bucket.start > WINDOW) {
    bucket = { start: now, count: 0 };
    buckets.set(ip, bucket);
  }

  bucket.count += 1;
  if (bucket.count > MAX) {
    res.writeHead(429, {
      'content-type': 'application/json',
      'retry-after': String(Math.ceil(WINDOW / 1000)),
    });
    res.end(
      JSON.stringify({
        error: 'rate_limited',
        message: `Max ${MAX} requests per ${WINDOW}ms`,
        retryAfter: Math.ceil(WINDOW / 1000),
      }),
    );
    return false;
  }
  return true;
}
