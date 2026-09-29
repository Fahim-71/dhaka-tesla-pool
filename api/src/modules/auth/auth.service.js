import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { AppError, conflict } from '../../lib/errors.js';

const BCRYPT_ROUNDS = 10;

// Only these fields ever leave the API - never the password hash.
export function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role };
}

export function signToken(user) {
  return jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: String(user.id),
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

// Public sign-up is for passengers only. Drivers (and their Teslas) are
// onboarded separately - in this MVP, by the seed.
export async function registerPassenger({ name, email, phone, password }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  try {
    const user = await prisma.user.create({
      data: { name, email, phone, passwordHash, role: 'PASSENGER' },
    });
    return { user: publicUser(user), token: signToken(user) };
  } catch (err) {
    // P2002 = unique constraint violated (email already used).
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('EMAIL_TAKEN', 'An account with this email already exists');
    }
    throw err;
  }
}

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Same message whether the email or the password is wrong, so the
  // response doesn't reveal which emails have accounts.
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  return { user: publicUser(user), token: signToken(user) };
}

export async function getUserById(id) {
  const user = await prisma.user.findUnique({ where: { id } });
  return user && publicUser(user);
}
