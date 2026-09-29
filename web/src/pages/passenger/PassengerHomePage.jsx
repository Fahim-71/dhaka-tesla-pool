import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { usePolling } from '../../hooks/usePolling';
import { ErrorMessage } from '../../components/Feedback';
import Loading from '../../components/Loading';
import ActiveRideCard from '../../components/passenger/ActiveRideCard';
import RideRequestForm from '../../components/passenger/RideRequestForm';

export default function PassengerHomePage() {
  const { user } = useAuth();
  // The last ride that finished while this page was open, so we can show
  // "you have arrived" instead of silently jumping back to the form.
  const [finished, setFinished] = useState(null);
  const lastActiveId = useRef(null);

  const loadActive = useCallback(async () => {
    const { request } = await api.get('/ride-requests/active');
    if (request) {
      lastActiveId.current = request.id;
    } else if (lastActiveId.current) {
      const id = lastActiveId.current;
      lastActiveId.current = null;
      const detail = await api.get(`/ride-requests/${id}`);
      setFinished(detail.request);
    }
    return request;
  }, []);

  const { data: active, error, loading, refresh } = usePolling(loadActive);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Hi {user.name}</h1>
          <p className="muted">Share a seat. Split the fare. Survive Dhaka traffic.</p>
        </div>
        <Link to="/ride/history" className="btn btn--ghost btn--small">
          Ride history
        </Link>
      </div>

      <ErrorMessage error={error} onRetry={refresh} />

      {loading ? (
        <Loading label="Checking for an active ride..." />
      ) : active ? (
        <ActiveRideCard request={active} onChanged={refresh} />
      ) : (
        <div className="grid grid--two">
          <section className="card">
            <h2>Where are you going?</h2>
            <p className="muted">We'll put you in a Tesla with others heading the same way.</p>
            <RideRequestForm
              onRequested={(request) => {
                setFinished(null);
                lastActiveId.current = request.id;
                refresh();
              }}
            />
          </section>

          {finished ? (
            <div className="stack">
              <ActiveRideCard request={finished} onChanged={refresh} />
              <button type="button" className="btn btn--ghost" onClick={() => setFinished(null)}>
                Dismiss
              </button>
            </div>
          ) : (
            <HowItWorks />
          )}
        </div>
      )}
    </>
  );
}

function HowItWorks() {
  return (
    <section className="card how">
      <h2>How pooling works</h2>
      <ol>
        <li>Request a seat from your area.</li>
        <li>If a Tesla is already picking up there and heading your way (drop-offs within 2 km), you join it.</li>
        <li>Otherwise you wait for the next driver in your area.</li>
        <li>When the ride starts, everyone sharing gets 25% off. You only ever see your own fare.</li>
      </ol>
    </section>
  );
}
