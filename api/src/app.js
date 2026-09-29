import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler, routeNotFound } from './lib/errors.js';
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';

export function createApp() {
  const app = express();

  // Render and nginx sit in front of the app; trust the first proxy so
  // req.ip is the real client (needed by the rate limiter).
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins }));
  app.use(express.json({ limit: '10kb' }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: !env.isTest,
      // One short line per request: id, method, url, status, time.
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);

  app.use(routeNotFound);
  app.use(errorHandler);

  return app;
}
