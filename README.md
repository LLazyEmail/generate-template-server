# generate-template-server

Thin callable HTTP server that wraps `@llazyemail/generate-template` `run()`.

This is the **surface** for the online editor, preview, and zip-download flows.
It does **not** own generation logic. That stays in `@llazyemail/generate-template`.

```
Browser / CLI / CI Action
        ↓
   this server  (HTTP, zip, auth, catalog loading)
        ↓
@llazyemail/generate-template.run()
        ↓
   markup-generator / in-memory content
```

## Endpoints

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/health` | — | `{ ok, version, catalogSource }` (always public) |
| GET | `/templates` | — | list of template ids + sample keys |
| POST | `/render` | `{ "templateId": "welcome", "payload": { "name": "Alex" } }` | `{ html, templateId, slug?, reqId }` |
| POST | `/render-many` | `{ "items": [{ "templateId", "payload" }] }` | `application/zip` (or JSON if `Accept: application/json`) |

Failures from `run()` are returned as JSON with the stable `GenerateTemplateError` code and a `reqId`.

## Run locally

```bash
npm install
npm start          # http://localhost:8787
```

### Use your own catalog

```bash
CATALOG_PATH=./examples/external-catalog.mjs npm start
```

The module must default-export `{ catalog, samplePayloads? }`. This is the same shape the CLI expects.

### API key (optional)

```bash
API_KEY=secret npm start
```

Then:

```bash
curl -H 'Authorization: Bearer secret' http://localhost:8787/templates
# or
curl -H 'X-API-Key: secret' ...
```

`/health` stays public.

## Examples

```bash
curl -s http://localhost:8787/health

curl -s -X POST http://localhost:8787/render \
  -H 'content-type: application/json' \
  -d '{"templateId":"welcome","payload":{"name":"Alex"}}'

# Zip download (“hit the download button”)
curl -s -X POST http://localhost:8787/render-many \
  -H 'content-type: application/json' \
  -d '{"items":[{"templateId":"welcome"},{"templateId":"invoice"}]}' \
  -o artifacts.zip
```

## Production notes

- Set `CATALOG_PATH` to a module that exports your real catalog (do not edit the demo).
- Set `API_KEY` when the server is reachable from the internet.
- Rate limiting and more advanced auth belong in this layer, not inside `generate-template`.
- The GitHub Action (`email-template-workflows` v3) remains the CI adapter and continues to call the CLI. It does not need to call this server.
- Request IDs are returned in responses and logged as structured JSON.

## Related

- [@llazyemail/generate-template](https://github.com/LLazyEmail/generate-template) — generation contract
- [email-template-workflows](https://github.com/LLazyEmail/email-template-workflows) — CI adapter (Render Static Artifacts)
- Organization schema lives in the generate-template docs
