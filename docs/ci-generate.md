# See a real template from GitHub Actions

Workflow: `.github/workflows/generate.yml`

On every push to `main`, every pull request, and on manual **Run workflow**, CI:

1. Installs dependencies (needs `@llazyemail/generate-template` from GitHub Packages).
2. Starts the server on port 8787.
3. Waits for `/ready`.
4. Renders two real templates:
   - `welcome` with `{ "name": "CI" }` — must contain `Welcome, CI`
   - `invoice` with `{ "id": "INV-CI", "amount": 99 }` — must contain `Amount: 99`
5. Uploads `artifacts/` as the **generated-templates** artifact.

## How to look

1. Open the Actions tab.
2. Open the **Generate** run.
3. Scroll to **Artifacts**.
4. Download **generated-templates**.
5. Open `welcome.html` and `invoice.html`.

The step summary on the run also lists what was generated.

## Local

```bash
npm install
bash scripts/ci-render.sh
open artifacts/welcome.html
```
