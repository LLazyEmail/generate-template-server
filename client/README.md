# Node client

Minimal client so other repos can call the server without raw `fetch`.

```js
import { createClient } from './client/index.mjs';

const client = createClient({
  baseUrl: 'http://localhost:8787',
  apiKey: process.env.API_KEY, // optional
});

const { html } = await client.render('welcome', { name: 'Alex' });
const templates = await client.templates();
const zipBlob = await client.renderMany([{ templateId: 'welcome' }]);
```

Errors thrown by the client have `.code` and `.status` set from the server response.
