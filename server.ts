/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import apiRouter from './server/routes/api.ts';

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Parse JSON bodies (up to 50mb for large batch autosaves)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Mount REST API routes
app.use('/api', apiRouter);

async function startServer() {
  if (!isProd) {
    // Development mode: Mount Vite middleware
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: Serve built static assets from dist/
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));

    // Fallback to index.html for SPA routing
    app.get('*', (_req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build artifacts not found. Please run npm run build.');
      }
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Blinded Review Portal] Server active on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Blinded Review Portal] Startup error:', err);
  process.exit(1);
});
