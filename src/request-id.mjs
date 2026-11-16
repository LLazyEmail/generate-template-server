/**
 * Request ID generation and header.
 * Prefers an incoming X-Request-Id; otherwise generates a UUID.
 */
import { randomUUID } from 'node:crypto';

export function requestId(req) {
  const incoming = req.headers['x-request-id'];
  if (typeof incoming === 'string' && incoming.length > 0 && incoming.length < 128) {
    return incoming;
  }
  return randomUUID();
}

export function setRequestId(res, id) {
  res.setHeader('x-request-id', id);
}
