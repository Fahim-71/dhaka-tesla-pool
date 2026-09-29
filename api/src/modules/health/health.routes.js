import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';

export const healthRouter = Router();

// Used by the Docker and Render health checks.
// Returns 503 when the database is unreachable, so the container is
// reported unhealthy instead of silently failing every real request.
healthRouter.get('/', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'up', uptimeSeconds: Math.round(process.uptime()) });
  } catch (err) {
    req.log.error({ err }, 'Health check: database unreachable');
    res.status(503).json({ status: 'error', database: 'down' });
  }
});
