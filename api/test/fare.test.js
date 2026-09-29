import { describe, expect, it } from 'vitest';
import { calculateFare } from '../src/domain/fare.js';
import { tripDistanceMetres } from '../src/domain/geo.js';
import { DHAKA_AREAS } from '../src/domain/areas.js';

const area = (id) => DHAKA_AREAS.find((a) => a.id === id);

describe('trip distances (rounded to 100 m)', () => {
  it('matches the table in docs/domain.md', () => {
    expect(tripDistanceMetres(area('banani'), area('mohakhali'))).toBe(1900);
    expect(tripDistanceMetres(area('banani'), area('gulshan-1'))).toBe(1800);
    expect(tripDistanceMetres(area('mohakhali'), area('gulshan-1'))).toBe(1700);
    expect(tripDistanceMetres(area('banani'), area('uttara'))).toBe(9500);
  });

  it('is the same in both directions', () => {
    expect(tripDistanceMetres(area('farmgate'), area('dhanmondi'))).toBe(
      tripDistanceMetres(area('dhanmondi'), area('farmgate')),
    );
  });
});

describe('calculateFare - Nusrat and Rafiq share Bullet', () => {
  it('Nusrat, Banani -> Mohakhali (1,900 m), pooled: ৳80.25', () => {
    // (5,000 + 1,900 x 3) x 1 = 10,700; 25% = 2,675; 10,700 - 2,675 = 8,025
    expect(calculateFare({ distanceM: 1900, seats: 1, pooled: true })).toEqual({
      baseFarePaisa: 5000,
      distanceChargePaisa: 5700,
      poolDiscountPaisa: 2675,
      farePaisa: 8025,
    });
  });

  it('Rafiq, Banani -> Gulshan 1 (1,800 m), pooled: ৳78.00', () => {
    // (5,000 + 1,800 x 3) x 1 = 10,400; 25% = 2,600; 10,400 - 2,600 = 7,800
    expect(calculateFare({ distanceM: 1800, seats: 1, pooled: true })).toEqual({
      baseFarePaisa: 5000,
      distanceChargePaisa: 5400,
      poolDiscountPaisa: 2600,
      farePaisa: 7800,
    });
  });

  it('the same trips alone cost more: ৳107.00 and ৳104.00', () => {
    expect(calculateFare({ distanceM: 1900, seats: 1, pooled: false }).farePaisa).toBe(10700);
    expect(calculateFare({ distanceM: 1800, seats: 1, pooled: false }).farePaisa).toBe(10400);
  });
});

describe('calculateFare - rules', () => {
  it('charges per seat', () => {
    const one = calculateFare({ distanceM: 1900, seats: 1, pooled: false });
    const two = calculateFare({ distanceM: 1900, seats: 2, pooled: false });
    expect(two.farePaisa).toBe(one.farePaisa * 2);
  });

  it('breakdown always adds up to the fare', () => {
    for (const distanceM of [100, 1900, 4400, 9500]) {
      for (const seats of [1, 2, 3]) {
        for (const pooled of [true, false]) {
          const f = calculateFare({ distanceM, seats, pooled });
          expect(f.baseFarePaisa + f.distanceChargePaisa - f.poolDiscountPaisa).toBe(f.farePaisa);
          expect(Number.isInteger(f.farePaisa)).toBe(true);
        }
      }
    }
  });

  it('rounds the discount down, in the passenger\'s favour', () => {
    // subtotal 5,003 -> 25% = 1,250.75 -> discount 1,250 -> fare 3,753
    expect(calculateFare({ distanceM: 1, seats: 1, pooled: true }).poolDiscountPaisa).toBe(1250);
  });

  it('rejects impossible input', () => {
    expect(() => calculateFare({ distanceM: 0, seats: 1, pooled: false })).toThrow(RangeError);
    expect(() => calculateFare({ distanceM: 1900, seats: 0, pooled: false })).toThrow(RangeError);
    expect(() => calculateFare({ distanceM: 19.5, seats: 1, pooled: false })).toThrow(RangeError);
  });
});
