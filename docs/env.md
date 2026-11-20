# Environment variables

All reads live in `src/config.mjs` (or the module that owns the feature). Do not scatter `process.env`.

| Var | Default | Used by |
|-----|---------|---------|
| `PORT` | 8787 | bind |
| `HOST` | 0.0.0.0 | bind |
| `CATALOG_PATH` | demo | `load-catalog.mjs` |
| `API_KEY` | unset (open) | `auth.mjs` |
| `RATE_LIMIT_MAX` | 60 | `rate-limit.mjs` |
| `MAX_BODY_BYTES` | 1000000 | `http.mjs` |
| `MAX_HTML_BYTES` | 2000000 | `size.mjs` |
| `CORS_ORIGIN` | `*` | responses |
| `ENABLE_METRICS` | 1 | `/metrics` |
| `ENABLE_RECENT` | 1 | `/recent` |
| `RECENT_LIMIT` | 50 | ring buffer |
| `RENDER_CACHE` | 0 | `cache.mjs` |
| `RENDER_CACHE_TTL_MS` | 60000 | cache |
| `RENDER_CONCURRENCY` | 8 | `concurrency.mjs` |
| `AUDIT_LIMIT` | 100 | `audit.mjs` |
| `RENDER_TIMEOUT_MS` | 10000 | `timeout.mjs` |

## Startup

`validateConfig` rejects a bad `PORT` or body limit before listen.
