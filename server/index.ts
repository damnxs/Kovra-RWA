import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { api } from './routes.js';
import { startTimers } from './store.js';
import { startChainData } from './chain.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));
app.use('/api', api);

// Production: serve the built client (Vite copies public/docs into dist/docs).
// Never compress /api/stream (SSE).
if (process.env.NODE_ENV === 'production') {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  app.use(express.static(path.join(root, 'dist')));
  app.get('*', (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
}

startTimers();
startChainData();

app.listen(config.port, () => {
  console.log(`[kovra] server listening on http://localhost:${config.port}`);
});
