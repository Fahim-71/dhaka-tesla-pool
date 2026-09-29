import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { forbidden, unauthorized } from '../lib/errors.js';

/**
 * Requires a valid "Authorization: Bearer <token>" header.
 * Sets req.user = { id, role } for the handlers that follow.
 */
export function requireAuth(req, res, next) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(unauthorized());
  }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = { id: Number(payload.sub), role: payload.role };
    return next();
  } catch {
    return next(unauthorized('Your session has expired, please sign in again'));
  }
}

/**
 * Only lets the given role(s) through. Use after requireAuth.
 * e.g. router.post('/accept', requireAuth, requireRole('DRIVER'), handler)
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return next(forbidden(`Only ${roles.join(' or ').toLowerCase()}s can do this`));
    }
    return next();
  };
}
