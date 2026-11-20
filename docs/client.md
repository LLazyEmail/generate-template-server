# Client SDK

`client/index.mjs` is a thin fetch wrapper. Other repos should use it instead of hand-writing HTTP.

```js
import { createClient } from './client/index.mjs';
const client = createClient({ baseUrl: 'http://localhost:8787', apiKey });

await client.ready();
const { html } = await client.render('welcome', { name: 'Alex' });
const blob = await client.download({ all: true });
```

## Methods

| Method | Path |
|--------|------|
| `health()` | GET `/health` |
| `ready()` | GET `/ready` |
| `version()` | GET `/version` |
| `docs()` | GET `/docs` |
| `templates()` | GET `/templates` |
| `template(id)` | GET `/templates/:id` |
| `sample(id)` | GET `/samples/:id` |
| `metrics()` | GET `/metrics` |
| `recent()` | GET `/recent` |
| `cache()` | GET `/cache` |
| `render(id, payload)` | POST `/render` |
| `renderPreview(id, payload)` | POST `/render-preview` |
| `renderMany(items, opts)` | POST `/render-many` |
| `download(opts)` | POST `/download` |

Errors throw with `err.code` and `err.status`.
