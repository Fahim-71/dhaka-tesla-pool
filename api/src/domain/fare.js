// Fare model - all amounts are integer paisa (1 taka = 100 paisa).
//
//   subtotal     = (baseFare + distance_m x 3) x seats
//   poolDiscount = floor(subtotal x 25 / 100)   only if the ride is shared
//   fare         = subtotal - poolDiscount
//
// Worked example (docs/domain.md): Nusrat, Banani -> Mohakhali, 1,900 m, 1 seat,
// shared with Rafiq: (5,000 + 5,700) x 1 = 10,700; discount 2,675; fare 8,025 = ৳80.25.

export const FARE_RULES = Object.freeze({
  baseFarePaisa: 5000, // ৳50 per seat
  perMetrePaisa: 3, // ৳30 per km per seat
  poolDiscountPercent: 25,
});

/**
 * @param {{ distanceM: number, seats: number, pooled: boolean }} trip
 * @returns breakdown in paisa. base + distance charge - discount === fare,
 *          so every stored fare can be re-explained line by line.
 */
export function calculateFare({ distanceM, seats, pooled }) {
  if (!Number.isInteger(distanceM) || distanceM <= 0) {
    throw new RangeError('distanceM must be a positive integer');
  }
  if (!Number.isInteger(seats) || seats < 1) {
    throw new RangeError('seats must be a positive integer');
  }

  const baseFarePaisa = FARE_RULES.baseFarePaisa * seats;
  const distanceChargePaisa = distanceM * FARE_RULES.perMetrePaisa * seats;
  const subtotal = baseFarePaisa + distanceChargePaisa;
  // Rounded down: any fraction of a paisa goes to the passenger.
  const poolDiscountPaisa = pooled ? Math.floor((subtotal * FARE_RULES.poolDiscountPercent) / 100) : 0;

  return {
    baseFarePaisa,
    distanceChargePaisa,
    poolDiscountPaisa,
    farePaisa: subtotal - poolDiscountPaisa,
  };
}
