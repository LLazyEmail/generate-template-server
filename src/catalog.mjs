/**
 * Example catalog. In production the server loads a project catalog
 * (same way the CLI does) or receives render functions from a mounted module.
 *
 * This demo catalog shows the contract the HTTP layer wraps.
 */
export const demoCatalog = [
  {
    ids: ['welcome', 'Welcome'],
    render: (p) => `<!DOCTYPE html>
<html>
<head><title>Welcome</title></head>
<body>
  <h1>Welcome, ${escapeHtml(p?.name ?? 'friend')}</h1>
  <p>This was rendered by the callable server.</p>
</body>
</html>`,
  },
  {
    ids: ['invoice'],
    render: (p) => `<!DOCTYPE html>
<html>
<head><title>Invoice ${escapeHtml(p?.id ?? '')}</title></head>
<body>
  <h1>Invoice</h1>
  <p>Amount: ${escapeHtml(String(p?.amount ?? 0))}</p>
</body>
</html>`,
  },
];

export const samplePayloads = {
  welcome: { name: 'Alex' },
  invoice: { id: 'INV-1', amount: 42 },
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}
