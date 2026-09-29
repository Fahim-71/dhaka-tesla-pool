import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { ErrorMessage } from '../Feedback';

// Bullet's details and the online / offline switch (with the area Jashim is in).
export default function AvailabilityCard({ vehicle, hasActiveRide, onChanged }) {
  const [areas, setAreas] = useState([]);
  const [areaId, setAreaId] = useState(vehicle.currentArea?.id ?? 'banani');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get('/areas')
      .then((data) => setAreas(data.areas))
      .catch(setError);
  }, []);

  async function save(online, nextAreaId = areaId) {
    setSaving(true);
    setError(null);
    try {
      await api.patch('/driver/availability', { online, areaId: nextAreaId });
      await onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  function changeArea(event) {
    setAreaId(event.target.value);
    // Moving while online updates the feed straight away.
    if (vehicle.isOnline) save(true, event.target.value);
  }

  return (
    <section className="card vehicle-card">
      <div className="card__header">
        <div>
          <h2>
            {vehicle.name} <span className="muted small">· {vehicle.plateNumber}</span>
          </h2>
          <p className="muted small">{vehicle.capacity} seats · battery-powered · entirely unaffiliated</p>
        </div>
        <span className={`badge ${vehicle.isOnline ? 'badge--done' : 'badge--cancelled'}`}>
          {vehicle.isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      <div className="availability">
        <label className="field">
          <span>You are in</span>
          <select value={areaId} onChange={changeArea} disabled={saving || hasActiveRide}>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </label>
        {vehicle.isOnline ? (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => save(false)}
            disabled={saving || hasActiveRide}
            title={hasActiveRide ? 'Finish or cancel your ride first' : undefined}
          >
            Go offline
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => save(true)} disabled={saving}>
            Go online
          </button>
        )}
      </div>
      {hasActiveRide && <p className="muted small">You can't change area or go offline during a ride.</p>}
      <ErrorMessage error={error} />
    </section>
  );
}
