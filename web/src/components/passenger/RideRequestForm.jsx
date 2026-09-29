import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { ErrorMessage } from '../Feedback';
import Loading from '../Loading';
import { formatDistance, formatTaka } from '../../utils/format';

const SEAT_OPTIONS = [1, 2, 3];

// Pick pickup, destination, seats and payment; shows a live fare estimate.
export default function RideRequestForm({ onRequested }) {
  const [areas, setAreas] = useState(null);
  const [areasError, setAreasError] = useState(null);
  const [form, setForm] = useState({
    pickupAreaId: 'banani',
    destinationAreaId: '',
    seats: 1,
    paymentMethod: 'CASH',
  });
  const [estimate, setEstimate] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadAreas = useCallback(() => {
    setAreasError(null);
    api
      .get('/areas')
      .then((data) => setAreas(data.areas))
      .catch(setAreasError);
  }, []);
  useEffect(loadAreas, [loadAreas]);

  // Re-quote whenever the trip changes.
  const { pickupAreaId, destinationAreaId, seats } = form;
  const canQuote = pickupAreaId && destinationAreaId && pickupAreaId !== destinationAreaId;
  useEffect(() => {
    if (!canQuote) return undefined;
    let cancelled = false;
    const query = new URLSearchParams({ pickupAreaId, destinationAreaId, seats });
    api
      .get(`/fares/estimate?${query}`)
      .then((data) => !cancelled && setEstimate(data.estimate))
      .catch(() => !cancelled && setEstimate(null));
    return () => {
      cancelled = true;
    };
  }, [canQuote, pickupAreaId, destinationAreaId, seats]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canQuote) {
      setError(new Error('Choose a destination different from your pickup area.'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const data = await api.post('/ride-requests', form);
      onRequested(data.request);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  const update = (field, toValue = (v) => v) => (event) => setForm({ ...form, [field]: toValue(event.target.value) });

  if (areasError) return <ErrorMessage error={areasError} onRetry={loadAreas} />;
  if (!areas) return <Loading label="Loading Dhaka areas..." />;

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form__row">
        <label className="field">
          <span>Pickup</span>
          <select value={pickupAreaId} onChange={update('pickupAreaId')}>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Destination</span>
          <select value={destinationAreaId} onChange={update('destinationAreaId')}>
            <option value="">Where to?</option>
            {areas
              .filter((area) => area.id !== pickupAreaId)
              .map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
          </select>
        </label>
      </div>

      <div className="form__row">
        <fieldset className="field">
          <legend>Seats</legend>
          <div className="choices">
            {SEAT_OPTIONS.map((n) => (
              <label key={n} className="choice">
                <input type="radio" name="seats" value={n} checked={seats === n} onChange={update('seats', Number)} />
                <span>{n}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="field">
          <legend>Payment</legend>
          <div className="choices">
            {[
              ['CASH', 'Cash'],
              ['TESLAPAY', 'TeslaPay'],
            ].map(([value, label]) => (
              <label key={value} className="choice">
                <input
                  type="radio"
                  name="paymentMethod"
                  value={value}
                  checked={form.paymentMethod === value}
                  onChange={update('paymentMethod')}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {canQuote && estimate && (
        <div className="quote" aria-live="polite">
          <div>
            <span className="quote__label">Shared ride</span>
            <strong className="quote__price">{formatTaka(estimate.pooled.farePaisa)}</strong>
          </div>
          <div>
            <span className="quote__label">If you ride alone</span>
            <strong>{formatTaka(estimate.solo.farePaisa)}</strong>
          </div>
          <div>
            <span className="quote__label">Distance</span>
            <strong>{formatDistance(estimate.distanceM)}</strong>
          </div>
          <p className="quote__note">
            The final fare is set when the ride starts: 25% off if you end up sharing the Tesla.
          </p>
        </div>
      )}

      <ErrorMessage error={error} />
      <button type="submit" className="btn btn--primary btn--block" disabled={submitting || !canQuote}>
        {submitting ? 'Finding you a seat...' : 'Request a seat'}
      </button>
    </form>
  );
}
