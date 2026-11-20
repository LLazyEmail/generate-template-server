# Glossary

| Term | Meaning |
|------|---------|
| Catalog | List of template ids and their render functions. Injected, not owned here. |
| Sample payload | Example data for a template, used by `/samples` and `/download` when no payload is given. |
| `run()` | The generation call. Lives in `@llazyemail/generate-template`. |
| `runOne` | This server's wrapper: cache, timeout, metrics. |
| Surface | This HTTP server. Adapters only. |
| Adapter | A thin caller of the contract. This server, the CLI, and the CI action are adapters. |
| Barrel | `src/handlers.mjs`. Re-exports only. Do not put logic here. |
| Public path | Open even when `API_KEY` is set. |
| Readiness | `/ready` is 200 only after the catalog is loaded. |
| Liveness | `/health` is 200 if the process is up. |
| Artifact | The zip returned by `/download` or produced by the CI action. |
