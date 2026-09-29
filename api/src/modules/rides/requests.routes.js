import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { areaId, seats } from '../areas/areas.routes.js';
import * as requestsService from './requests.service.js';

// Passenger endpoints: /api/ride-requests
export const requestsRouter = Router();
requestsRouter.use(requireAuth, requireRole('PASSENGER'));

const idParams = z.object({ id: z.coerce.number().int().positive() });

const createRequestSchema = z.object({
  pickupAreaId: areaId,
  destinationAreaId: areaId,
  seats: seats.default(1),
  paymentMethod: z.enum(['CASH', 'TESLAPAY']).default('CASH'),
});

// Book a ride.
requestsRouter.post('/', validate({ body: createRequestSchema }), async (req, res) => {
  const request = await requestsService.createRequest(req.user.id, req.valid.body);
  req.log.info({ requestId: request.id, status: request.status }, 'Ride requested');
  res.status(201).json({ request });
});

// Ride history, newest first.
requestsRouter.get('/', async (req, res) => {
  res.json({ requests: await requestsService.listRequests(req.user.id) });
});

// The current request, or null. The passenger screen polls this.
requestsRouter.get('/active', async (req, res) => {
  res.json({ request: await requestsService.getActiveRequest(req.user.id) });
});

// One request with its full event history.
requestsRouter.get('/:id', validate({ params: idParams }), async (req, res) => {
  res.json({ request: await requestsService.getRequestForPassenger(req.user.id, req.valid.params.id) });
});

requestsRouter.post('/:id/cancel', validate({ params: idParams }), async (req, res) => {
  const request = await requestsService.cancelRequest(req.user.id, req.valid.params.id);
  req.log.info({ requestId: request.id }, 'Ride request cancelled');
  res.json({ request });
});
