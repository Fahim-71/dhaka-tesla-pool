import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { areaId } from '../areas/areas.routes.js';
import { RIDE_ACTIONS, getRideForDriver, transitionRide } from '../rides/rides.service.js';
import * as driverService from './driver.service.js';

const idParams = z.object({ id: z.coerce.number().int().positive() });

// Driver endpoints: /api/driver
export const driverRouter = Router();
driverRouter.use(requireAuth, requireRole('DRIVER'));

// Bullet's status and the current ride. Jashim's screen polls this.
driverRouter.get('/me', async (req, res) => {
  res.json(await driverService.getDashboard(req.user.id));
});

// Go online (in an area) or offline.
driverRouter.patch(
  '/availability',
  validate({ body: z.object({ online: z.boolean(), areaId: areaId.optional() }) }),
  async (req, res) => {
    const dashboard = await driverService.setAvailability(req.user.id, req.valid.body);
    req.log.info({ driverId: req.user.id, ...req.valid.body }, 'Driver availability changed');
    res.json(dashboard);
  },
);

// Waiting requests in the driver's area.
driverRouter.get('/requests', async (req, res) => {
  res.json({ requests: await driverService.listWaitingRequests(req.user.id) });
});

driverRouter.post('/requests/:id/accept', validate({ params: idParams }), async (req, res) => {
  const dashboard = await driverService.acceptRequest(req.user.id, req.valid.params.id);
  req.log.info({ driverId: req.user.id, requestId: req.valid.params.id }, 'Request accepted');
  res.json(dashboard);
});

driverRouter.get('/rides', async (req, res) => {
  res.json({ rides: await driverService.listRideHistory(req.user.id) });
});

// Ride endpoints for the driver: /api/rides/:id and /api/rides/:id/{arrive,start,complete,cancel}
export const ridesRouter = Router();
ridesRouter.use(requireAuth, requireRole('DRIVER'));

ridesRouter.get('/:id', validate({ params: idParams }), async (req, res) => {
  res.json({ ride: await getRideForDriver(req.user.id, req.valid.params.id) });
});

for (const action of Object.keys(RIDE_ACTIONS)) {
  ridesRouter.post(`/:id/${action}`, validate({ params: idParams }), async (req, res) => {
    const ride = await transitionRide(req.user.id, req.valid.params.id, action);
    req.log.info({ rideId: ride.id, status: ride.status }, `Ride ${action}`);
    res.json({ ride });
  });
}
