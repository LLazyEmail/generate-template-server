# Endpoints

Public paths stay open even when `API_KEY` is set: `/health`, `/ready`, `/version`, `/docs`, `/openapi.json`, `/demo`.

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| GET | `/health` | no | liveness + uptime |
| GET | `/ready` | no | 200 when catalog is loaded, else 503 |
| GET | `/version` | no | package version |
| GET | `/docs` | no | this list as JSON |
| GET | `/openapi.json` | no | OpenAPI 3 stub |
| GET | `/demo` | no | browser client |
| GET | `/templates` | yes | catalog ids |
| GET | `/templates/:id` | yes | exists + hasSample |
| GET | `/samples/:id` | yes | sample payload |
| GET | `/metrics` | yes | counters |
| GET | `/recent` | yes | recent renders |
| GET | `/cache` | yes | cache stats |
| POST | `/reload` | yes | hot-reload catalog |
| POST | `/render` | yes | JSON `{ html, templateId, slug }` |
| POST | `/render-preview` | yes | raw HTML for an iframe |
| POST | `/render-many` | yes | zip, or JSON if `Accept: application/json` |
| POST | `/download` | yes | zip of rendered files + optional index |

## Render body

```json
{ "templateId": "welcome", "payload": { "name": "Alex" } }
```

## Download body

```json
{ "templateIds": ["welcome"], "includeIndex": true, "artifactName": "out" }
```

`all: true` renders every id in the catalog. `items` accepts per-template payloads.
