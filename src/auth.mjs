/**
 * Optional API-key auth.
 * Public paths stay open even when API_KEY is set.
 */
const API_KEY = process.env.API_KEY;

const PUBLIC_PATHS = new Set([
  '/health',
  '/version',
  '/docs',
  '/openapi.json',
  '/demo',
]);

export function isPublicPath(pathname) {
  return PUBLIC_PATHS.has(pathname);
}

export function requireAuth(req, res) {
  if (!API_KEY) return true;

  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
  const apiKeyHeader = req.headers['x-api-key'];

  if (bearer === API_KEY || apiKeyHeader === API_KEY) return true;

  res.writeHead(401, {
    'content-type': 'application/json',
    'www-authenticate': 'Bearer',
  });
  res.end(JSON.stringify({ error: 'unauthorized' }));
  return false;
}
