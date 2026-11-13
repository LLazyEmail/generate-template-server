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

## Where to put things

| Concern | Location |
|---------|----------|
| HTTP routing & handlers | `src/server.mjs` |
| Catalog loading | `src/load-catalog.mjs` (or equivalent) |
| Auth | `src/auth.mjs` |
| Rate limit | `src/rate-limit.mjs` |
| Error mapping | `src/errors.mjs` |
| Client SDK | `client/` |
| Browser example | `examples/client.html` |
| AI / contributor rules | `AGENTS.md` (this file) |
| Human docs | `README.md` |

## When you add an endpoint

1. Document it in the README table.
2. Add a one-line description to the `/docs` endpoint if it exists.
3. Decide if it should be rate-limited and auth-protected (default: yes).
4. Return a `reqId` on errors.
5. Prefer JSON unless the consumer is an iframe (`/render-preview`).

## Related repos

- [@llazyemail/generate-template](https://github.com/LLazyEmail/generate-template) — generation contract
- [email-template-workflows](https://github.com/LLazyEmail/email-template-workflows) — CI adapter (v3 = Render Static Artifacts)

Keep the organization schema in `generate-template/docs/organization-schema.md` in sync when the surface changes.
