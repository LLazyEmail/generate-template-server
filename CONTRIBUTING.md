# Contributing

## Setup

```bash
npm install
npm start
npm test
```

For a real catalog:

```bash
CATALOG_PATH=./examples/playing-with-lit-style-catalog.mjs npm start
```

## Rules

Read `AGENTS.md`. The short version:

- Do not reimplement generation. Call `@llazyemail/generate-template`.
- Keep new endpoints thin.
- Add tests.
- Update the README endpoint table.
- Prefer additive changes.

## Pull requests

- One concern per PR when possible.
- Include a short "Why" and "Test plan".
- CI must be green (see `.github/workflows/ci.yml`).
