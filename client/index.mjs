/**
 * Minimal client for generate-template-server.
 *
 * Usage:
 *   import { createClient } from './client/index.mjs';
 *   const client = createClient({ baseUrl: 'http://localhost:8787', apiKey: '...' });
 *   const { html } = await client.render('welcome', { name: 'Alex' });
 */

export function createClient({ baseUrl = 'http://localhost:8787', apiKey } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (apiKey) headers['authorization'] = `Bearer ${apiKey}`;

  async function request(path, options = {}) {
    const res = await fetch(new URL(path, baseUrl), {
      ...options,
      headers: { ...headers, ...(options.headers || {}) },
    });
    if (!res.ok) {
      let body;
      try {
        body = await res.json();
      } catch {
        body = { error: 'http_error', message: res.statusText };
      }
      const err = new Error(body.message || res.statusText);
      err.code = body.error;
      err.status = res.status;
      throw err;
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    if (ct.includes('application/zip')) return res.blob();
    return res.text();
  }

  return {
    health: () => request('/health'),
    version: () => request('/version'),
    docs: () => request('/docs'),
    openapi: () => request('/openapi.json'),
    templates: () => request('/templates'),
    template: (id) => request(`/templates/${encodeURIComponent(id)}`),
    sample: (id) => request(`/samples/${encodeURIComponent(id)}`),
    metrics: () => request('/metrics'),
    recent: () => request('/recent'),
    render: (templateId, payload) =>
      request('/render', {
        method: 'POST',
        body: JSON.stringify({ templateId, payload }),
      }),
    renderPreview: (templateId, payload) =>
      request('/render-preview', {
        method: 'POST',
        body: JSON.stringify({ templateId, payload }),
      }),
    renderMany: (items, { asJson = false, parallel = false } = {}) =>
      request('/render-many', {
        method: 'POST',
        headers: asJson ? { accept: 'application/json' } : {},
        body: JSON.stringify({ items, parallel }),
      }),
  };
}
