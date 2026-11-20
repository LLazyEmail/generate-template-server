# Error codes

Failures return `{ error, message?, reqId }`. Use the helpers in `src/errors.mjs`. Do not invent new shapes.

| Code | HTTP | When |
|------|------|------|
| `unauthorized` | 401 | `API_KEY` set and missing/wrong key |
| `invalid_json` | 400 | body is not JSON |
| `templateId_required` | 400 | render body missing id |
| `items_required` | 400 | render-many with empty items |
| `nothing_to_render` | 400 | download with no ids |
| `BODY_TOO_LARGE` | 413 | body over `MAX_BODY_BYTES` |
| `HTML_TOO_LARGE` | 413 | rendered HTML over `MAX_HTML_BYTES` |
| `UNKNOWN_TEMPLATE` | 404 | id not in catalog |
| `NO_SAMPLE` | 404 | no sample payload for id |
| `RENDER_TIMEOUT` | 504 | `run()` exceeded timeout |
| `INVALID_CONFIG` | process exit | bad `PORT` or body limit at startup |
| `SHUTTING_DOWN` | 503 | request arrived during drain |

Additive fields are fine. Removing or renaming a field is a breaking change.
