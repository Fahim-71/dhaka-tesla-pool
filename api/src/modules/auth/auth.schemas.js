import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(120);

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50),
  email,
  // Bangladeshi mobile number, e.g. 01711234567 or +8801711234567. Optional.
  phone: z
    .string()
    .trim()
    .regex(/^(\+?880)?01[3-9]\d{8}$/, 'Enter a Bangladeshi mobile number, e.g. 01711234567')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(72),
});
