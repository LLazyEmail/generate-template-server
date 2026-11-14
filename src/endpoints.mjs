/**
 * Endpoint catalog used by /docs and /openapi.json.
 */
export const ENDPOINTS = [
  { method: 'GET', path: '/health', auth: false, desc: 'liveness + uptime' },
  { method: 'GET', path: '/ready', auth: false, desc: 'readiness (catalog loaded)' },
  { method: 'GET', path: '/version', auth: false, desc: 'package version' },
  { method: 'GET', path: '/docs', auth: false, desc: 'endpoint list' },
  { method: 'GET', path: '/openapi.json', auth: false, desc: 'OpenAPI 3 stub' },
  { method: 'GET', path: '/demo', auth: false, desc: 'browser client example' },
  { method: 'GET', path: '/cache', auth: true, desc: 'render cache stats' },
  { method: 'GET', path: '/templates', auth: true, desc: 'catalog ids' },
  { method: 'GET', path: '/templates/:id', auth: true, desc: 'exists + hasSample' },
  { method: 'GET', path: '/samples/:id', auth: true, desc: 'sample payload' },
  { method: 'GET', path: '/metrics', auth: true, desc: 'counters' },
  { method: 'GET', path: '/recent', auth: true, desc: 'recent renders' },
  { method: 'POST', path: '/reload', auth: true, desc: 'hot-reload catalog' },
  { method: 'POST', path: '/render', auth: true, desc: 'JSON HTML' },
  { method: 'POST', path: '/render-preview', auth: true, desc: 'raw HTML for iframe' },
  { method: 'POST', path: '/render-many', auth: true, desc: 'zip or JSON' },
  { method: 'POST', path: '/download', auth: true, desc: 'zip of files + optional index' },
];
