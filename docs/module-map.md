# Module map

Where to look, and where to add.

| If you need… | Open |
|---------------|------|
| Process start / stop | `src/server.mjs` |
| A new route | `src/router.mjs` |
| A new handler | `src/handlers/<domain>.mjs` then re-export |
| JSON / HTML helpers | `src/http.mjs` |
| Shared state | `src/state.mjs` |
| Endpoint list for `/docs` | `src/endpoints.mjs` |
| Single render + cache | `src/run.mjs` |
| Catalog load | `src/load-catalog.mjs` |
| Catalog reload | `src/reload.mjs` |
| Catalog lookups | `src/catalog-helpers.mjs` |
| Auth | `src/auth.mjs` |
| Rate limit | `src/rate-limit.mjs` |
| Errors | `src/errors.mjs` |
| Zip + index | `src/download.mjs` |
| Demo page | `src/static.mjs` |
| Readiness | `src/ready.mjs` |
| Cache | `src/cache.mjs` |
| Request id | `src/request-id.mjs` |
| Response time | `src/response-time.mjs` |
| Concurrency | `src/concurrency.mjs` |
| Audit | `src/audit.mjs` |
| HTML size | `src/size.mjs` |
| Config check | `src/config-validate.mjs` |
| Drain | `src/drain.mjs` |
| Client | `client/index.mjs` |

Keep this table in sync when you add a module. Update `AGENTS.md` too.
