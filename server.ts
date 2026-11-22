import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import authAndUsersRoutes from './src/server/routes/authAndUsers.ts';
import coursesAndAssessmentsRoutes from './src/server/routes/coursesAndAssessments.ts';
import tasksMarketplaceRoutes from './src/server/routes/tasksMarketplace.ts';
import providersAndBookingsRoutes from './src/server/routes/providersAndBookings.ts';
import centersAndProfDevRoutes from './src/server/routes/centersAndProfDev.ts';
import messagingAndAssistantRoutes from './src/server/routes/messagingAndAssistant.ts';
import adminRoutes from './src/server/routes/admin.ts';
import lessonSessionsRoutes from './src/server/routes/lessonSessions.ts';
import curriculumRoutes from './src/server/routes/curriculum.ts';
import { ensureSeeded } from './src/server/seed.ts';

const app = express();
const PORT = Number(process.env.PORT || 3000);

const allowedOrigins = new Set(
  [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    process.env.APP_URL?.trim(),
  ].filter((v): v is string => Boolean(v))
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin) || origin.endsWith('.run.app')) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: false,
  })
);

app.use(express.json({ limit: '2mb' }));

// Simple per-IP in-memory rate limiter for auth endpoints
const authHits = new Map<string, { count: number; resetAt: number }>();
app.use('/api/auth', (req, res, next) => {
  if (req.method === 'GET') return next();
  const key = req.ip || 'unknown';
  const now = Date.now();
  const entry = authHits.get(key);
  if (!entry || now > entry.resetAt) {
    authHits.set(key, { count: 1, resetAt: now + 60_000 });
    return next();
  }
  entry.count += 1;
  if (entry.count > 40) {
    return res
      .status(429)
      .json({ error: 'تم تجاوز حد المحاولات المسموح به. انتظر دقيقة ثم أعد المحاولة.' });
  }
  next();
});

// Ensure database is seeded on first API request (lazy, non-blocking at import time)
app.use('/api', async (_req, _res, next) => {
  try {
    await ensureSeeded();
  } catch (err) {
    console.error('Lazy seed check error:', err);
  }
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'jusoor-api' });
});

app.use('/api', authAndUsersRoutes);
app.use('/api', coursesAndAssessmentsRoutes);
app.use('/api', tasksMarketplaceRoutes);
app.use('/api', providersAndBookingsRoutes);
app.use('/api', centersAndProfDevRoutes);
app.use('/api', messagingAndAssistantRoutes);
app.use('/api', lessonSessionsRoutes);
app.use('/api', curriculumRoutes);
app.use('/api', adminRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'نقطة النهاية المطلوبة غير موجودة.' });
});

// Centralized error handler
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('Unhandled API error:', err);
    res.status(500).json({ error: 'حدث خطأ داخلي في الخادم.' });
  }
);

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
