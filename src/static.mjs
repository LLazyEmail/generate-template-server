/**
 * Serves the browser client example at /demo so the online-editor path
 * can be tried without a separate static host.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const demoPath = join(here, '..', 'examples', 'client.html');

export async function serveDemo(res, corsOrigin = '*') {
  try {
    const html = await readFile(demoPath, 'utf8');
    const data = Buffer.from(html, 'utf8');
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'content-length': data.length,
      'access-control-allow-origin': corsOrigin,
      'cache-control': 'no-cache',
    });
    res.end(data);
  } catch (err) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'demo_not_found', message: err.message }));
  }
}
