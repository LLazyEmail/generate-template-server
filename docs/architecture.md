# Architecture

This server is a thin HTTP adapter. It does not generate content.

```
caller (browser, client SDK, CI action)
        ↓
  generate-template-server
    router.mjs      route table
    handlers/*      request shapes
    auth / rate / log
        ↓
  @llazyemail/generate-template.run()
        ↓
  markup (HTML or other)
```

## Layers

| Layer | File | Owns |
|-------|------|------|
Entry | `src/server.mjs` | listen, shutdown |
Router | `src/router.mjs` | method + path → handler |
Handlers | `src/handlers/*.mjs` | request/response shapes |
Helpers | `src/*.mjs` | auth, cache, zip, catalog |
Generation | external package | `run()` only |

## Rules of the boundary

- New behavior that changes markup belongs in `generate-template`.
- New behavior that changes HTTP belongs here.
- A handler calls `runOne` and returns JSON, HTML, or a zip. It does not call disk writers.

## Why it is split

`server.mjs` used to hold routing, helpers, and handlers. That made every PR conflict. Each concern now has its own file, and no file is over 90 lines.
