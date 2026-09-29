import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import * as areasService from './areas.service.js';

export const areasRouter = Router();
export const faresRouter = Router();

export const areaId = z.string().trim().min(1).max(40);
export const seats = z.coerce.number().int().min(1, 'At least 1 seat').max(3, 'At most 3 seats');

// GET /api/areas - the predefined Dhaka areas for the pickup/destination pickers.
areasRouter.get('/', async (req, res) => {
  res.json({ areas: await areasService.listAreas() });
});

// GET /api/fares/estimate?pickupAreaId=banani&destinationAreaId=mohakhali&seats=1
faresRouter.get(
  '/estimate',
  validate({
    query: z.object({ pickupAreaId: areaId, destinationAreaId: areaId, seats: seats.default(1) }),
  }),
  async (req, res) => {
    res.json({ estimate: await areasService.estimateFare(req.valid.query) });
  },
);
