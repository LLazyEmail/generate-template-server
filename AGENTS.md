# AGENTS.md — Rules for AI agents and contributors

This file is the standing contract for anyone (human or AI) changing `generate-template-server`.

## What this repo is

A **thin HTTP surface** over `@llazyemail/generate-template` `run()`.

It owns:
- HTTP routing, request/response shapes
- Optional auth, rate limiting, logging, request IDs
- Zip packaging and iframe-friendly HTML preview
- Catalog loading from an external module

It does **not** own:
- Template content or render functions
- Catalog structure or payload resolution
- Disk writing primitives
- CI action logic (that lives in `email-template-workflows`)

## Hard rules

1. **Never reimplement generation.** Always call `createGenerator` + `generate.run()`. If you need a new behavior, extend `generate-template` first.
2. **Keep the server thin.** New endpoints should be adapters, not new business logic.
3. **Stable error codes.** Use the helpers in `src/errors.mjs`. Do not invent new stringly error shapes.
4. **Backward compatible responses.** Existing clients rely on `{ html, templateId, slug? }` and the zip download. Additive fields are fine; removing fields is a breaking change.
5. **Auth and rate limits are optional.** `/health` stays public. Everything else can be protected by `API_KEY` or rate limit when the env vars are set.
6. **Catalog is injected.** Prefer `CATALOG_PATH` over editing `src/catalog.mjs`.
7. **Tests matter.** New endpoints need at least a unit or integration assertion.
8. **No secrets in repo.** `.npmrc`, API keys, and tokens stay in env or GitHub secrets.
9. **No file over 90 lines.** If a file is about to cross 90 lines, split it. This is a hard limit for `src/**/*.mjs`. Documentation and generated files are exempt.

## Working style (AI agents)

These rules exist because a single growing file becomes unreviewable and unmergeable.

### Always use feature branches

- Never commit directly to `main`.
- One concern per branch. Name it `feat/`, `fix/`, or `docs/`.
- Open a pull request. Do not batch unrelated changes into one PR.
- Base the branch on current `main`. If the branch goes dirty, rebase or recreate it from `main` instead of stacking more commits on a diverged history.

### Write like a software developer

- Small, focused modules. One responsibility per file.
- Clear names. No god objects, no 400-line handlers mixed with routing and helpers.
- Additive changes. Prefer a new module over editing a large file for a new feature.
- Keep the public surface stable. Internal structure can change freely if the HTTP contract does not.
- **Stay under 90 lines.** When a file approaches the limit, extract the next concern into a new file and re-export if needed.

### Do not put all changes into one file

- `src/server.mjs` is an entry point. It should stay short (init, listen, shutdown, wiring).
- HTTP helpers go in `src/http.mjs`.
- Request handlers live in `src/handlers/<domain>.mjs`. `src/handlers.mjs` is a barrel.
- Route table and dispatch go in `src/router.mjs`.
- Shared state goes in `src/state.mjs`.
- A new feature gets its own module and a thin wire-up.

### When a file keeps changing, reorganize

If the same file is edited in most pull requests, that is a signal to split it.

- Extract the part that changes most into its own module.
- Leave the stable wiring in the entry point or barrel.
- Prefer composition over a growing switch or if-else chain.
- After a split, update this table so the next agent knows where to put things.
- If the split still leaves a file over 90 lines, split again.

## Where to put things

| Concern | Location |
|---------|----------|
| Entry (init, listen, shutdown) | `src/server.mjs` |
| HTTP helpers (json, html, readBody) | `src/http.mjs` |
| Handler barrel | `src/handlers.mjs` |
| Render handlers | `src/handlers/render.mjs` |
| Multi-render | `src/handlers/many.mjs` |
| Download handler | `src/handlers/download.mjs` |
| Meta handlers (health, docs, catalog) | `src/handlers/meta.mjs` |
| Shared state | `src/state.mjs` |
| Endpoint list | `src/endpoints.mjs` |
| Single render + cache | `src/run.mjs` |
| Catalog lookups | `src/catalog-helpers.mjs` |
| Route table and dispatch | `src/router.mjs` |
| Catalog loading | `src/load-catalog.mjs` |
| Catalog hot-reload | `src/reload.mjs` |
| Auth | `src/auth.mjs` |
| Rate limit | `src/rate-limit.mjs` |
| Error mapping | `src/errors.mjs` |
| Download / zip helpers | `src/download.mjs` |
| Static demo page | `src/static.mjs` |
| Readiness | `src/ready.mjs` |
| Render cache | `src/cache.mjs` |
| Client SDK | `client/` |
| Browser example | `examples/client.html` |
| AI / contributor rules | `AGENTS.md` (this file) |
| Human docs | `README.md` |

## When you add an endpoint

1. Put the handler in a file under `src/handlers/` that stays under 90 lines.
2. Re-export it from `src/handlers.mjs`.
3. Register the route in `router.mjs`.
4. Document it in the README table.
5. Add a one-line description to the `/docs` endpoint if it exists.
6. Decide if it should be rate-limited and auth-protected (default: yes).
7. Return a `reqId` on errors.
8. Prefer JSON unless the consumer is an iframe (`/render-preview`).

## Related repos

- [@llazyemail/generate-template](https://github.com/LLazyEmail/generate-template) — generation contract
- [email-template-workflows](https://github.com/LLazyEmail/email-template-workflows) — CI adapter (v3 = Render Static Artifacts)

Keep the organization schema in `generate-template/docs/organization-schema.md` in sync when the surface changes.
