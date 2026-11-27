import express, { type Express } from 'express';
import cors from 'cors';
import authAndUsersRoutes from './routes/authAndUsers.ts';
import coursesAndAssessmentsRoutes from './routes/coursesAndAssessments.ts';
import tasksMarketplaceRoutes from './routes/tasksMarketplace.ts';
import providersAndBookingsRoutes from './routes/providersAndBookings.ts';
import centersAndProfDevRoutes from './routes/centersAndProfDev.ts';
import messagingAndAssistantRoutes from './routes/messagingAndAssistant.ts';
import adminRoutes from './routes/admin.ts';
import lessonSessionsRoutes from './routes/lessonSessions.ts';
import curriculumRoutes from './routes/curriculum.ts';
import centerDashboardRoutes from './routes/centerDashboard.ts';
import { ensureSeeded } from './seed.ts';
import { resolveSafeUploadPath } from './uploadStorage.ts';

export interface CreateAppOptions {
  disableAuthRateLimit?: boolean;
}

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();

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

  if (!options.disableAuthRateLimit) {
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
  }

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

  app.get('/uploads/:category/:filename', (req, res) => {
    const category = req.params.category;
    if (category !== 'courses' && category !== 'centers') {
      return res.status(404).end();
    }
    const safePath = resolveSafeUploadPath(category, req.params.filename);
    if (!safePath) {
      return res.status(404).end();
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(safePath, (err) => {
      if (err && !res.headersSent) {
        res.status(404).end();
      }
    });
  });

  app.use('/api', authAndUsersRoutes);
  app.use('/api', coursesAndAssessmentsRoutes);
  app.use('/api', tasksMarketplaceRoutes);
  app.use('/api', providersAndBookingsRoutes);
  app.use('/api', centersAndProfDevRoutes);
  app.use('/api', messagingAndAssistantRoutes);
  app.use('/api', lessonSessionsRoutes);
  app.use('/api', curriculumRoutes);
  app.use('/api', centerDashboardRoutes);
  app.use('/api', adminRoutes);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'نقطة النهاية المطلوبة غير موجودة.' });
  });

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

  return app;
}
