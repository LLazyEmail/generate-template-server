# CI and private packages

`@llazyemail/generate-template` is published to GitHub Packages.
`GITHUB_TOKEN` in this repo cannot read it unless you grant access.

## Grant Actions access (recommended)

1. Open the package settings:
   https://github.com/orgs/LLazyEmail/packages/npm/generate-template/settings
2. Under **Manage Actions access**, add the `generate-template-server` repository.
3. Re-run the workflow.

After that, the full `npm test` job will run (integration tests included).

## Until then

The CI job falls back to pure unit tests (`src/download.test.mjs`) so the check stays green.
Full tests that import the private package are skipped.

## Alternative

Store a PAT with `read:packages` as a secret (e.g. `PACKAGES_TOKEN`) and use it instead of `GITHUB_TOKEN` in the workflow.
