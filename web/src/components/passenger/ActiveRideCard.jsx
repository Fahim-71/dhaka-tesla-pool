import { useState } from 'react';
import { api } from '../../api/client';
import { ErrorMessage } from '../Feedback';
import FareBreakdown from '../FareBreakdown';
import StatusBadge from '../StatusBadge';
import StatusSteps from '../StatusSteps';
import { formatDistance, formatTaka } from '../../utils/format';

const CANCELLABLE = ['WAITING', 'MATCHED', 'DRIVER_ARRIVED'];

const HEADLINES = {
  WAITING: 'Looking for a Tesla with a free seat...',
  MATCHED: 'Your Tesla is on the way',
  DRIVER_ARRIVED: 'Your Tesla is waiting at the pickup',
  IN_PROGRESS: 'Enjoy the ride',
  COMPLETED: 'You have arrived',
  CANCELLED: 'This ride was cancelled',
};

// The passenger's current booking: progress, Tesla, fare, cancel.
export default function ActiveRideCard({ request, onChanged }) {
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState(null);
  const { ride, displayStatus } = request;
  const others = ride ? ride.passengerCount - 1 : 0;

  async function cancel() {
    if (!window.confirm('Cancel this ride request?')) return;
    setCancelling(true);
    setError(null);
    try {
      await api.post(`/ride-requests/${request.id}/cancel`);
      await onChanged();
    } catch (err) {
      setError(err);
      // The ride may have moved on (e.g. just started) - show the latest state.
      await onChanged();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <section className="card ride-card" aria-live="polite">
      <div className="card__header">
        <div>
          <h2>{HEADLINES[displayStatus]}</h2>
          <p className="muted">
            {request.pickup.name} → {request.destination.name} · {formatDistance(request.distanceM)} ·{' '}
            {request.seats} {request.seats === 1 ? 'seat' : 'seats'}
          </p>
        </div>
        <StatusBadge status={displayStatus} />
      </div>

      <StatusSteps status={displayStatus} />

      {ride ? (
        <div className="tesla">
          <div className="tesla__icon" aria-hidden="true">
            ⚡
          </div>
          <div>
            <strong>
              {ride.vehicle.name} · {ride.vehicle.plateNumber}
            </strong>
            <p className="muted small">
              Driver {ride.driver.name}
              {ride.driver.phone && ` · ${ride.driver.phone}`}
            </p>
            <p className="small pool-note">
              {others > 0
                ? `Shared ride - you and ${others} other ${others === 1 ? 'passenger' : 'passengers'}`
                : 'Just you so far - others heading the same way may join before the ride starts'}
            </p>
          </div>
        </div>
      ) : (
        displayStatus === 'WAITING' && (
          <p className="alert alert--warning">
            No Tesla has a free seat for this trip yet. You'll be matched automatically, or picked up by the next driver in{' '}
            {request.pickup.name}.
          </p>
        )
      )}

      <div className="ride-card__fare">
        {request.fare.isFinal ? (
          <>
            <h3>Fare {request.paymentMethod === 'TESLAPAY' ? '(TeslaPay)' : '(cash)'}</h3>
            <FareBreakdown fare={request.fare} seats={request.seats} />
          </>
        ) : (
          <div className="quote quote--compact">
            <div>
              <span className="quote__label">If the ride is shared</span>
              <strong className="quote__price">{formatTaka(request.quote.pooled)}</strong>
            </div>
            <div>
              <span className="quote__label">If you ride alone</span>
              <strong>{formatTaka(request.quote.solo)}</strong>
            </div>
            <p className="quote__note">Your fare is locked when the ride starts.</p>
          </div>
        )}
      </div>

      <ErrorMessage error={error} />

      {CANCELLABLE.includes(displayStatus) && (
        <div className="actions">
          <button type="button" className="btn btn--danger" onClick={cancel} disabled={cancelling}>
            {cancelling ? 'Cancelling...' : 'Cancel request'}
          </button>
        </div>
      )}
    </section>
  );
}
