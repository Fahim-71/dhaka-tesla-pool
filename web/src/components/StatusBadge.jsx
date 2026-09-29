import { PASSENGER_STATUS, RIDE_STATUS } from '../utils/format';

// Coloured pill for a status. `kind` is 'passenger' (displayStatus) or 'ride'.
export default function StatusBadge({ status, kind = 'passenger' }) {
  const info = (kind === 'ride' ? RIDE_STATUS : PASSENGER_STATUS)[status] ?? { label: status, tone: 'waiting' };
  return <span className={`badge badge--${info.tone}`}>{info.label}</span>;
}
