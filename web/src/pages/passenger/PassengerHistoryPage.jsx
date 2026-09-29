import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { usePolling } from '../../hooks/usePolling';
import { EmptyState, ErrorMessage } from '../../components/Feedback';
import Loading from '../../components/Loading';
import StatusBadge from '../../components/StatusBadge';
import { formatDateTime, formatTaka } from '../../utils/format';

export default function PassengerHistoryPage() {
  const load = useCallback(() => api.get('/ride-requests').then((data) => data.requests), []);
  const { data: requests, error, loading, refresh } = usePolling(load, 15000);

  return (
    <>
      <div className="page-header">
        <h1>Your rides</h1>
        <Link to="/ride" className="btn btn--ghost btn--small">
          Book a ride
        </Link>
      </div>

      <ErrorMessage error={error} onRetry={refresh} />
      {loading && <Loading />}
      {requests?.length === 0 && (
        <EmptyState title="No rides yet">Your requests and completed trips will show up here.</EmptyState>
      )}

      {requests?.length > 0 && (
        <ul className="list">
          {requests.map((r) => (
            <li key={r.id}>
              <Link to={`/ride/history/${r.id}`} className="list__item">
                <div>
                  <strong>
                    {r.pickup.name} → {r.destination.name}
                  </strong>
                  <span className="muted small">
                    {formatDateTime(r.createdAt)} · {r.seats} {r.seats === 1 ? 'seat' : 'seats'}
                    {r.ride && ` · ${r.ride.vehicle.name}`}
                  </span>
                </div>
                <div className="list__end">
                  <StatusBadge status={r.displayStatus} />
                  {r.status === 'COMPLETED' && <strong>{formatTaka(r.fare.farePaisa)}</strong>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
