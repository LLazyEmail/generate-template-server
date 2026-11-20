# Catalog

The server does not own templates. It loads a catalog and calls `run()`.

## Priority

1. `CATALOG_PATH` — ESM module that default-exports `{ catalog, samplePayloads? }`.
2. Built-in demo in `src/catalog.mjs`.

## Shape

```js
export default {
  catalog: [
    { ids: ['welcome', 'Welcome'], render: (p) => `...` },
  ],
  samplePayloads: { welcome: { name: 'Alex' } },
};
```

## Hot reload

`POST /reload` re-reads the catalog and rebuilds the generator without a restart. See `src/reload.mjs`.

## Do not

- Edit the demo catalog for a real project. Point `CATALOG_PATH` at the real module.
- Resolve payloads here. That belongs in `generate-template`.
