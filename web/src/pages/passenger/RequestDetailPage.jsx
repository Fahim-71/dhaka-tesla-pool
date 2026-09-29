import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { usePolling } from '../../hooks/usePolling';
import { ErrorMessage } from '../../components/Feedback';
import Loading from '../../components/Loading';
import EventTimeline from '../../components/EventTimeline';
import ActiveRideCard from '../../components/passenger/ActiveRideCard';

// One booking with its full history ("what exactly happened").
export default function RequestDetailPage() {
  const { id } = useParams();
  const load = useCallback(() => api.get(`/ride-requests/${id}`).then((data) => data.request), [id]);
  const { data: request, error, loading, refresh } = usePolling(load, 8000);

  return (
    <>
      <div className="page-header">
        <h1>Ride #{id}</h1>
        <Link to="/ride/history" className="btn btn--ghost btn--small">
          All rides
        </Link>
      </div>

      {loading && <Loading />}
      {error && <ErrorMessage error={error} onRetry={error.status === 404 ? undefined : refresh} />}

      {request && (
        <div className="grid grid--two">
          <ActiveRideCard request={request} onChanged={refresh} />
          <section className="card">
            <h2>What happened</h2>
            <EventTimeline events={request.events} />
          </section>
        </div>
      )}
    </>
  );
}
