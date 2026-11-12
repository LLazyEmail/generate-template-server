/**
 * Example catalog that mirrors the shape used by `_playing_with_lit`.
 *
 * In a real deployment you would:
 *   1. Import the project's createLitGenerator / buildCatalogFromRegistry
 *   2. Export the resulting catalog + samplePayloads
 *
 * This file is a self-contained stand-in so you can run:
 *   CATALOG_PATH=./examples/playing-with-lit-style-catalog.mjs npm start
 *
 * without depending on the sibling repo.
 */

function finalize(html) {
  return html.includes('<!DOCTYPE')
    ? html
    : `<!DOCTYPE html>\n<html><body>\n${html}\n</body></html>`;
}

const registry = {
  WelcomeEmail: {
    render: (p) => finalize(`<h1>Welcome ${p?.name ?? 'friend'}</h1><p>From the lit-style catalog.</p>`),
  },
  InvoiceEmail: {
    render: (p) =>
      finalize(`<h1>Invoice ${p?.id ?? ''}</h1><p>Amount: ${p?.amount ?? 0}</p>`),
  },
};

export default {
  catalog: Object.entries(registry).map(([name, entry]) => ({
    ids: [name, name.replace(/Email$/, '')],
    render: entry.render,
  })),
  samplePayloads: {
    WelcomeEmail: { name: 'Alex' },
    InvoiceEmail: { id: 'INV-42', amount: 99 },
  },
};
