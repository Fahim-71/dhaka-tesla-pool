import { useCallback } from 'react';
import { api } from '../../api/client';
import { usePolling } from '../../hooks/usePolling';
import { EmptyState, ErrorMessage } from '../../components/Feedback';
import Loading from '../../components/Loading';
import StatusBadge from '../../components/StatusBadge';
import { formatDateTime, formatTaka } from '../../utils/format';

export default function DriverHistoryPage() {
  const load = useCallback(() => api.get('/driver/rides').then((data) => data.rides), []);
  const { data: rides, error, loading, refresh } = usePolling(load, 15000);

  const completed = rides?.filter((r) => r.status === 'COMPLETED') ?? [];
  const earned = completed.reduce((sum, r) => sum + r.totalFarePaisa, 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Ride history</h1>
          {rides?.length > 0 && (
            <p className="muted">
              {completed.length} completed {completed.length === 1 ? 'ride' : 'rides'} · {formatTaka(earned)} in fares
            </p>
          )}
        </div>
      </div>

      <ErrorMessage error={error} onRetry={refresh} />
      {loading && <Loading />}
      {rides?.length === 0 && <EmptyState title="No finished rides yet">Completed and cancelled rides appear here.</EmptyState>}

      {rides?.length > 0 && (
        <ul className="list">
          {rides.map((ride) => (
            <li key={ride.id} className="list__item">
              <div>
                <strong>
                  Ride #{ride.id} from {ride.pickup.name}
                </strong>
                <span className="muted small">
                  {formatDateTime(ride.createdAt)} ·{' '}
                  {ride.members.length > 0
                    ? ride.members.map((m) => `${m.passenger.name} → ${m.destination.name}`).join(', ')
                    : 'no passengers'}
                </span>
              </div>
              <div className="list__end">
                <StatusBadge status={ride.status} kind="ride" />
                {ride.status === 'COMPLETED' && <strong>{formatTaka(ride.totalFarePaisa)}</strong>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
