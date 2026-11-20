# How to see the server generate a real template

Easiest path: start the server and open the demo page.

## 1. Run it

```bash
cd generate-template-server
npm install
npm start
```

Server listens on **http://localhost:8787**. No `API_KEY` means auth is open.

## 2. See a real template in the browser

Open:

**http://localhost:8787/demo**

That serves `examples/client.html`. Defaults are already set:

- Template: `welcome`
- Payload: `{"name":"Alex"}`

Click **Preview**. The HTML appears in the page. Click **Download zip** to get the archive.

## 3. Or one curl that returns HTML

```bash
curl -s -X POST http://localhost:8787/render-preview \
  -H 'content-type: application/json' \
  -d '{"templateId":"welcome","payload":{"name":"Alex"}}' \
  -o welcome.html && open welcome.html
```

`/render-preview` returns raw HTML (good for an iframe). `/render` returns JSON with an `html` field.

## Demo templates already in the catalog

| ID | Sample payload |
|----|----------------|
| `welcome` | `{ "name": "Alex" }` |
| `invoice` | `{ "id": "INV-1", "amount": 42 }` |

Check what is loaded:

```bash
curl -s http://localhost:8787/templates
curl -s http://localhost:8787/samples/welcome
```

## Use a real project catalog

Point at an external module instead of the demo:

```bash
CATALOG_PATH=./examples/external-catalog.mjs npm start
```

Then render `status-report` the same way.

The demo page is the fastest way to see a generated template without writing extra code.
