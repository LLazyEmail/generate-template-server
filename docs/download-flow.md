# Download flow

`POST /download` is the online-editor path. It mirrors `email-template-workflows` with `zip-artifact: true`.

1. Resolve ids from `all`, `templateIds`, or `items`.
2. For each id, call `runOne` with the item payload or the sample.
3. Build `{ name, content }` files.
4. Unless `includeIndex: false`, prepend `index.html`.
5. Stream a zip named from `artifactName` (default `rendered.zip`).

## Body

```json
{
  "templateIds": ["welcome"],
  "includeIndex": true,
  "artifactName": "out",
  "productName": "files"
}
```

## What it does not do

- It does not write to disk. The zip is the response.
- It does not invent HTML. Generation stays in `generate-template`.
- CI still uses the action. This endpoint is for callers that want the zip over HTTP.
