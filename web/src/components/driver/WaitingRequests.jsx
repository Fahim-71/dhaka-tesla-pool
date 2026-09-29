import { useState } from 'react';
import { api } from '../../api/client';
import { EmptyState, ErrorMessage } from '../Feedback';
import { formatDistance, formatTaka, formatTime } from '../../utils/format';

// Passengers waiting in the driver's area. Accepting creates a ride, or adds
// the passenger to the current ride if they fit (the API decides).
export default function WaitingRequests({ requests, isOnline, rideStarted, onChanged }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  async function accept(id) {
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/driver/requests/${id}/accept`);
    } catch (err) {
      // e.g. someone else got the seat first, or the passenger cancelled.
      setError(err);
    } finally {
      await onChanged();
      setBusyId(null);
    }
  }

  return (
    <section className="card">
      <h2>Waiting passengers</h2>
      <ErrorMessage error={error} />

      {!isOnline ? (
        <EmptyState title="You are offline">Go online to see passengers waiting in your area.</EmptyState>
      ) : requests.length === 0 ? (
        <EmptyState title="Nobody waiting right now">New requests in your area appear here automatically.</EmptyState>
      ) : (
        <ul className="list">
          {requests.map((r) => {
            const blocked = rideStarted || !r.poolFit.ok;
            const reason = rideStarted ? 'Finish your current trip first' : r.poolFit.message;
            return (
              <li key={r.id} className="list__item">
                <div>
                  <strong>
                    {r.passenger.name} → {r.destination.name}
                  </strong>
                  <span className="muted small">
                    {r.seats} {r.seats === 1 ? 'seat' : 'seats'} · {formatDistance(r.distanceM)} · solo{' '}
                    {formatTaka(r.estimatedFarePaisa)} · waiting since {formatTime(r.createdAt)}
                  </span>
                  {blocked && <span className="small reason">{reason}</span>}
                </div>
                <button
                  type="button"
                  className="btn btn--primary btn--small"
                  onClick={() => accept(r.id)}
                  disabled={busyId !== null || blocked}
                >
                  {r.poolFit.joinsRide ? 'Add to ride' : 'Accept'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
