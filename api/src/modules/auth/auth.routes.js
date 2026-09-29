import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { notFound } from '../../lib/errors.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import * as authService from './auth.service.js';

export const authRouter = Router();

// Slow down password guessing: 20 attempts per 15 minutes per IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skip: () => env.isTest,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts, try again in a few minutes' } },
});

authRouter.post('/register', authLimiter, validate({ body: registerSchema }), async (req, res) => {
  const result = await authService.registerPassenger(req.valid.body);
  req.log.info({ userId: result.user.id }, 'Passenger registered');
  res.status(201).json(result);
});

authRouter.post('/login', authLimiter, validate({ body: loginSchema }), async (req, res) => {
  const result = await authService.login(req.valid.body);
  res.json(result);
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await authService.getUserById(req.user.id);
  if (!user) throw notFound('Account not found');
  res.json({ user });
});
