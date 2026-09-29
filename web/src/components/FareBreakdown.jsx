import { formatTaka } from '../utils/format';

// The fare line by line, so the passenger (and the evaluator) can check it:
// base + distance - pool discount = fare.
export default function FareBreakdown({ fare, seats }) {
  const perSeat = seats > 1 ? ` (${seats} seats)` : '';
  return (
    <dl className="fare">
      <div>
        <dt>Base fare{perSeat}</dt>
        <dd>{formatTaka(fare.baseFarePaisa)}</dd>
      </div>
      <div>
        <dt>Distance{perSeat}</dt>
        <dd>{formatTaka(fare.distanceChargePaisa)}</dd>
      </div>
      {fare.poolDiscountPaisa > 0 && (
        <div className="fare__discount">
          <dt>Pool discount (25%)</dt>
          <dd>-{formatTaka(fare.poolDiscountPaisa)}</dd>
        </div>
      )}
      <div className="fare__total">
        <dt>Your fare</dt>
        <dd>{formatTaka(fare.farePaisa)}</dd>
      </div>
    </dl>
  );
}
