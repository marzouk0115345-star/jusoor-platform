import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { createApp } from './src/server/app.ts';

const app = createApp();
const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(process.cwd(), 'dist');

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`JUSOOR server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

