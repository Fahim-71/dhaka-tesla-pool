import { useState } from 'react';
import { api } from '../../api/client';
import { ErrorMessage } from '../Feedback';
import StatusBadge from '../StatusBadge';
import SeatMap from './SeatMap';
import { formatDistance, formatTaka } from '../../utils/format';

// The next step(s) the driver can take from each ride status.
const NEXT_ACTIONS = {
  ACCEPTED: [
    { action: 'arrive', label: 'I have arrived at pickup', style: 'primary' },
    { action: 'cancel', label: 'Cancel ride', style: 'danger', confirm: 'Cancel this ride? Passengers go back to the queue.' },
  ],
  DRIVER_ARRIVED: [
    { action: 'start', label: 'Start trip', style: 'primary', confirm: 'Start the trip? No one else can join after this.' },
    { action: 'cancel', label: 'Cancel ride', style: 'danger', confirm: 'Cancel this ride? Passengers go back to the queue.' },
  ],
  STARTED: [{ action: 'complete', label: 'Complete trip', style: 'primary' }],
};

export default function ActiveRidePanel({ ride, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function run({ action, confirm }) {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/rides/${ride.id}/${action}`);
    } catch (err) {
      setError(err);
    } finally {
      await onChanged();
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-live="polite">
      <div className="card__header">
        <div>
          <h2>Ride #{ride.id} from {ride.pickup.name}</h2>
          <p className="muted small">
            {ride.seatsBooked} of {ride.capacity} seats booked
            {ride.isPooled && ' · shared ride'}
          </p>
        </div>
        <StatusBadge status={ride.status} kind="ride" />
      </div>

      <SeatMap capacity={ride.capacity} members={ride.members} />

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Passenger</th>
              <th>Drop-off</th>
              <th>Seats</th>
              <th>Pays</th>
              <th className="num">{ride.fareIsFinal ? 'Fare' : 'Fare (est.)'}</th>
            </tr>
          </thead>
          <tbody>
            {ride.members.map((m) => (
              <tr key={m.requestId}>
                <td>
                  <strong>{m.passenger.name}</strong>
                  {m.passenger.phone && <span className="muted small block">{m.passenger.phone}</span>}
                </td>
                <td>
                  {m.destination.name}
                  <span className="muted small block">{formatDistance(m.distanceM)}</span>
                </td>
                <td>{m.seats}</td>
                <td>{m.paymentMethod === 'TESLAPAY' ? 'TeslaPay' : 'Cash'}</td>
                <td className="num">
                  {formatTaka(m.fare.farePaisa)}
                  {m.fare.poolDiscountPaisa > 0 && <span className="muted small block">-25% pool</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="4">Total{ride.fareIsFinal ? '' : ' (solo prices until the trip starts)'}</td>
              <td className="num">{formatTaka(ride.totalFarePaisa)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {ride.status !== 'STARTED' && ride.seatsFree > 0 && (
        <p className="alert alert--info">
          {ride.seatsFree} {ride.seatsFree === 1 ? 'seat' : 'seats'} free - passengers heading the same way are added
          automatically until you start the trip.
        </p>
      )}

      <ErrorMessage error={error} />

      <div className="actions">
        {(NEXT_ACTIONS[ride.status] ?? []).map((step) => (
          <button
            key={step.action}
            type="button"
            className={`btn btn--${step.style}`}
            disabled={busy}
            onClick={() => run(step)}
          >
            {step.label}
          </button>
        ))}
      </div>
    </section>
  );
}
