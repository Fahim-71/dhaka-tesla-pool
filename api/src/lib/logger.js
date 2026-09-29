import pino from 'pino';
import { env } from '../config/env.js';

// Structured JSON logs in production (easy to search on Render),
// readable coloured logs in development.
export const logger = pino({
  level: env.LOG_LEVEL,
  transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
  redact: ['req.headers.authorization', 'password', 'passwordHash'],
});
