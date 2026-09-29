import { Router } from 'express';

export const healthRouter = Router();

// Used by the Docker and Render health checks.
healthRouter.get('/', (req, res) => {
  res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
});
