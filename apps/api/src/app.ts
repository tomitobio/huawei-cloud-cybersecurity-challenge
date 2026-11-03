import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { isOriginAllowed } from './env';
import { ApiError } from './lib/http';
import { authRouter } from './routes/auth';
import { joinRouter } from './routes/join';
import { scenarioRouter } from './routes/scenarios';
import { catalogRouter } from './routes/catalog';
import { sessionRouter } from './routes/sessions';
import { teamRouter } from './routes/teams';
import { audienceRouter } from './routes/audience';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(cors({ origin: (origin, cb) => cb(null, isOriginAllowed(origin)), credentials: true }));
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());

  // General API rate limit
  app.use(
    '/api',
    rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: true, legacyHeaders: false }),
  );

  app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

  app.use('/api/auth', authRouter);
  app.use('/api', joinRouter);
  app.use('/api', scenarioRouter);
  app.use('/api', catalogRouter);
  app.use('/api', sessionRouter);
  app.use('/api', teamRouter);
  app.use('/api', audienceRouter);

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ApiError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    if (err && typeof err === 'object' && 'issues' in err) {
      return res.status(400).json({ error: 'Validation failed', code: 'VALIDATION', issues: (err as { issues: unknown }).issues });
    }
    // eslint-disable-next-line no-console
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
