# Agent checklist

Use this before opening a PR.

1. Branch from current `main`. Name it `feat/`, `fix/`, or `docs/`.
2. One concern per PR. Do not mix a feature with a refactor.
3. New code goes in its own module. Do not grow `server.mjs` or `handlers.mjs`.
4. Stay under 90 lines per file in `src/**/*.mjs`.
5. Re-export from `src/handlers.mjs` if you add a handler.
6. Register the route in `src/router.mjs`.
7. Add the path to `src/endpoints.mjs` so `/docs` stays accurate.
8. Document it in `README.md` and `docs/endpoints.md`.
9. Add a pure unit test if the module does not need the private package.
10. Do not reimplement generation. Call `runOne`.
11. If the same file is edited in most PRs, split it.
12. If the branch goes dirty, recreate it from `main`. Do not stack conflict commits.

## What not to do

- Commit to `main`.
- Put helpers, routing, and handlers in one file.
- Invent new error shapes. Use `src/errors.mjs`.
- Hard-code secrets.
