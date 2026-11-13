/**
 * Machine-readable endpoint list.
 * Kept separate so both the server and tests can import it.
 */
export const ENDPOINTS = [
  { method: 'GET', path: '/health', auth: false, desc: 'liveness' },
  { method: 'GET', path: '/version', auth: false, desc: 'package version' },
  { method: 'GET', path: '/docs', auth: false, desc: 'this list' },
  { method: 'GET', path: '/templates', auth: true, desc: 'catalog ids' },
  { method: 'GET', path: '/metrics', auth: true, desc: 'counters' },
  { method: 'GET', path: '/recent', auth: true, desc: 'recent renders' },
  { method: 'POST', path: '/render', auth: true, desc: 'JSON HTML' },
  { method: 'POST', path: '/render-preview', auth: true, desc: 'raw HTML for iframe' },
  { method: 'POST', path: '/render-many', auth: true, desc: 'zip or JSON list' },
];
