# generate-template-server

Thin callable HTTP server that wraps `@llazyemail/generate-template` `run()`.

This is the **surface** for the online editor, preview, and zip-download flows.
It does **not** own generation logic. That stays in `@llazyemail/generate-template`.

```
Browser / CLI / CI Action
        ↓
   this server  (HTTP, zip, auth hooks)
        ↓
@llazyemail/generate-template.run()
        ↓
   markup-generator / in-memory HTML
```

## Endpoints

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/health` | — | `{ ok: true }` |
| GET | `/templates` | — | list of template ids |
| POST | `/render` | `{ "templateId": "welcome", "payload": { "name": "Alex" } }` | `{ html, templateId, slug? }` |
| POST | `/render-many` | `{ "items": [{ "templateId", "payload" }] }` | `application/zip` (or JSON if `Accept: application/json`) |

Failures from `run()` are returned as JSON with the stable `GenerateTemplateError` code.

## Run locally

```bash
npm install
npm start          # http://localhost:8787
```

```bash
curl -s http://localhost:8787/health
curl -s -X POST http://localhost:8787/render \
  -H 'content-type: application/json' \
  -d '{"templateId":"welcome","payload":{"name":"Alex"}}'
```

Zip download (the “hit the download button” path):

```bash
curl -s -X POST http://localhost:8787/render-many \
  -H 'content-type: application/json' \
  -d '{"items":[{"templateId":"welcome"},{"templateId":"invoice"}]}' \
  -o templates.zip
```

## Production notes

- Replace the demo catalog in `src/catalog.mjs` with a real project catalog
  (same pattern the CLI uses: `generate-template.config.js` or a mounted module).
- Add auth / rate limiting at this layer. Do not put them inside `generate-template`.
- The GitHub Action (`email-template-workflows` v3) remains the CI adapter and
  continues to call the CLI or scripts. It does not need to call this server.

## Related

- [@llazyemail/generate-template](https://github.com/LLazyEmail/generate-template) — generation contract
- [email-template-workflows](https://github.com/LLazyEmail/email-template-workflows) — CI adapter (Render Static Artifacts)
- Organization schema lives in the generate-template docs
