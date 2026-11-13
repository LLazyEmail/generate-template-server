# generate-template-server

Thin callable HTTP server that wraps `@llazyemail/generate-template` `run()`.

This is the **surface** for the online editor, preview, and zip-download flows.
It does **not** own generation logic. That stays in `@llazyemail/generate-template`.

```
Browser / CLI / CI Action
        ↓
   this server  (HTTP, zip, auth, metrics, recent)
        ↓
@llazyemail/generate-template.run()
        ↓
   markup-generator / in-memory content
```

**AI agents and contributors:** read [`AGENTS.md`](AGENTS.md) first.

## Endpoints

| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | `/health` | no | `{ ok, service, version }` |
| GET | `/version` | no | `{ version }` |
| GET | `/docs` | no | machine-readable endpoint list |
| GET | `/templates` | yes | catalog ids + sample keys |
| GET | `/metrics` | yes | counters (`ENABLE_METRICS`) |
| GET | `/recent` | yes | recent successful renders (`ENABLE_RECENT`) |
| POST | `/render` | yes | `{ html, templateId, slug?, reqId }` |
| POST | `/render-preview` | yes | raw `text/html` (iframe, tight CSP) |
| POST | `/render-many` | yes | zip (or JSON if `Accept: application/json`) |

Failures return stable `{ error, message, reqId }` shapes (see `src/errors.mjs`).

## Run locally

```bash
npm install
npm start          # http://localhost:8787
```

Copy `.env.example` to `.env` for configuration.

### Useful env vars

| Var | Default | Purpose |
|-----|---------|---------|
| `PORT` / `HOST` | 8787 / 0.0.0.0 | bind |
| `CATALOG_PATH` | (demo) | external catalog module |
| `API_KEY` | (unset = open) | Bearer / X-API-Key |
| `RATE_LIMIT_MAX` | 60 | requests per window (0 = off) |
| `MAX_BODY_BYTES` | 1000000 | body size limit |
| `CORS_ORIGIN` | * | Access-Control-Allow-Origin |
| `ENABLE_METRICS` | 1 | `/metrics` |
| `ENABLE_RECENT` | 1 | `/recent` |

## Examples

```bash
curl -s http://localhost:8787/health
curl -s http://localhost:8787/docs

curl -s -X POST http://localhost:8787/render \
  -H 'content-type: application/json' \
  -d '{"templateId":"welcome","payload":{"name":"Alex"}}'

# iframe-friendly
curl -s -X POST http://localhost:8787/render-preview \
  -H 'content-type: application/json' \
  -d '{"templateId":"welcome"}'

# zip
curl -s -X POST http://localhost:8787/render-many \
  -H 'content-type: application/json' \
  -d '{"items":[{"templateId":"welcome"}]}' \
  -o artifacts.zip
```

## Production notes

- Point `CATALOG_PATH` at a real catalog module. Do not edit the demo.
- Set `API_KEY` when the server is reachable.
- Rate limiting, body limits, and auth live here — never inside `generate-template`.
- The GitHub Action (`email-template-workflows` v3) remains the CI adapter and calls the CLI.
- See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`AGENTS.md`](AGENTS.md).

## Related

- [@llazyemail/generate-template](https://github.com/LLazyEmail/generate-template) — generation contract
- [email-template-workflows](https://github.com/LLazyEmail/email-template-workflows) — CI adapter
- Organization schema: `generate-template/docs/organization-schema.md`
