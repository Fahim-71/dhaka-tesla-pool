import { useCallback } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { usePolling } from '../../hooks/usePolling';
import { EmptyState, ErrorMessage } from '../../components/Feedback';
import Loading from '../../components/Loading';
import ActiveRidePanel from '../../components/driver/ActiveRidePanel';
import AvailabilityCard from '../../components/driver/AvailabilityCard';
import WaitingRequests from '../../components/driver/WaitingRequests';

export default function DriverDashboardPage() {
  const { user } = useAuth();

  // Dashboard and feed are loaded together so the screen is always consistent.
  const load = useCallback(async () => {
    const [dashboard, feed] = await Promise.all([api.get('/driver/me'), api.get('/driver/requests')]);
    return { ...dashboard, requests: feed.requests };
  }, []);
  const { data, error, loading, refresh } = usePolling(load);

  if (loading) return <Loading label="Loading your dashboard..." />;
  if (!data) return <ErrorMessage error={error} onRetry={refresh} />;

  const { vehicle, activeRide, requests } = data;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Salam, {user.name}</h1>
          <p className="muted">Who's riding, and what's next.</p>
        </div>
      </div>

      <ErrorMessage error={error} onRetry={refresh} />

      <div className="grid grid--two">
        <div className="stack">
          {activeRide ? (
            <ActiveRidePanel ride={activeRide} onChanged={refresh} />
          ) : (
            <section className="card">
              <h2>No active ride</h2>
              <EmptyState title={vehicle.isOnline ? 'Accept a waiting passenger to start a ride' : 'You are offline'}>
                {vehicle.isOnline
                  ? 'Once you accept one, others heading the same way can join until you start the trip.'
                  : 'Go online to start receiving ride requests.'}
              </EmptyState>
            </section>
          )}
        </div>

        <div className="stack">
          <AvailabilityCard vehicle={vehicle} hasActiveRide={Boolean(activeRide)} onChanged={refresh} />
          <WaitingRequests
            requests={requests}
            isOnline={vehicle.isOnline}
            rideStarted={activeRide?.status === 'STARTED'}
            onChanged={refresh}
          />
        </div>
      </div>
    </>
  );
}
