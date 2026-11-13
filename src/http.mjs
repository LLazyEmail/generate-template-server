/**
 * HTTP response helpers. No business logic.
 */
import { config } from './config.mjs';

export function json(res, status, body, extra = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(data),
    'access-control-allow-origin': config.corsOrigin,
    ...extra,
  });
  res.end(data);
}

export function html(res, status, content) {
  const data = Buffer.from(content, 'utf8');
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'content-length': data.length,
    'access-control-allow-origin': config.corsOrigin,
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data: https:;",
  });
  res.end(data);
}

export function options(res) {
  res.writeHead(204, {
    'access-control-allow-origin': config.corsOrigin,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,accept,authorization,x-api-key,x-request-id',
  });
  res.end();
}

export async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const c of req) {
    total += c.length;
    if (total > config.maxBodyBytes) {
      const err = new Error('body too large');
      err.code = 'BODY_TOO_LARGE';
      err.statusCode = 413;
      throw err;
    }
    chunks.push(c);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}
