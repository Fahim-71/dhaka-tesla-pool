import { describe, expect, it } from 'vitest';
import { checkPoolFit } from '../src/domain/matching.js';
import { DHAKA_AREAS } from '../src/domain/areas.js';

const area = (id) => DHAKA_AREAS.find((a) => a.id === id);

// Bullet, accepted in Banani, with Nusrat (-> Mohakhali) on board.
const bulletWithNusrat = { status: 'ACCEPTED', pickupAreaId: 'banani', capacity: 3, seatsBooked: 1 };
const nusratDestination = [area('mohakhali')];

const rafiq = { pickupAreaId: 'banani', seats: 1, destination: area('gulshan-1') };

describe('checkPoolFit - the matching rule', () => {
  it('Rafiq (Banani -> Gulshan 1) fits with Nusrat (Banani -> Mohakhali): 1,700 m apart', () => {
    expect(checkPoolFit({ ride: bulletWithNusrat, members: nusratDestination, request: rafiq })).toEqual({ ok: true });
  });

  it('refuses a different pickup area', () => {
    const fromGulshan = { ...rafiq, pickupAreaId: 'gulshan-2' };
    expect(checkPoolFit({ ride: bulletWithNusrat, members: nusratDestination, request: fromGulshan }).reason).toBe(
      'DIFFERENT_PICKUP',
    );
  });

  it('refuses a destination more than 2 km from someone already in the pool (Uttara)', () => {
    const toUttara = { ...rafiq, destination: area('uttara') };
    expect(checkPoolFit({ ride: bulletWithNusrat, members: nusratDestination, request: toUttara }).reason).toBe(
      'DESTINATION_TOO_FAR',
    );
  });

  it('checks the destination against every member, not just the first', () => {
    // Gulshan 2 is 1.6 km from Gulshan 1 but 2.4 km from Mohakhali.
    const toGulshan2 = { ...rafiq, destination: area('gulshan-2') };
    const members = [area('gulshan-1'), area('mohakhali')];
    expect(checkPoolFit({ ride: bulletWithNusrat, members, request: toGulshan2 }).reason).toBe('DESTINATION_TOO_FAR');
  });

  it('never goes over capacity', () => {
    const twoSeatsLeft = { ...bulletWithNusrat, seatsBooked: 1 };
    expect(checkPoolFit({ ride: twoSeatsLeft, members: nusratDestination, request: { ...rafiq, seats: 2 } }).ok).toBe(true);
    expect(checkPoolFit({ ride: twoSeatsLeft, members: nusratDestination, request: { ...rafiq, seats: 3 } }).reason).toBe(
      'NOT_ENOUGH_SEATS',
    );
    const full = { ...bulletWithNusrat, seatsBooked: 3 };
    expect(checkPoolFit({ ride: full, members: nusratDestination, request: rafiq }).reason).toBe('NOT_ENOUGH_SEATS');
  });

  it('closes the pool once the ride has started', () => {
    for (const status of ['STARTED', 'COMPLETED', 'CANCELLED']) {
      const ride = { ...bulletWithNusrat, status };
      expect(checkPoolFit({ ride, members: nusratDestination, request: rafiq }).reason).toBe('RIDE_NOT_OPEN');
    }
    const arrived = { ...bulletWithNusrat, status: 'DRIVER_ARRIVED' };
    expect(checkPoolFit({ ride: arrived, members: nusratDestination, request: rafiq }).ok).toBe(true);
  });
});
