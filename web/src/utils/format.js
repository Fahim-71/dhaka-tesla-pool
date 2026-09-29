// Money arrives from the API as integer paisa; we only divide by 100 to display.
export function formatTaka(paisa) {
  if (paisa == null) return '-';
  return `৳${(paisa / 100).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDistance(metres) {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${metres} m`;
}

export function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// Labels for the passenger's combined status (displayStatus from the API).
export const PASSENGER_STATUS = {
  WAITING: { label: 'Waiting for a Tesla', tone: 'waiting' },
  MATCHED: { label: 'Matched', tone: 'active' },
  DRIVER_ARRIVED: { label: 'Driver arrived', tone: 'active' },
  IN_PROGRESS: { label: 'In progress', tone: 'progress' },
  COMPLETED: { label: 'Completed', tone: 'done' },
  CANCELLED: { label: 'Cancelled', tone: 'cancelled' },
};

// Labels for the ride (pool) status the driver sees.
export const RIDE_STATUS = {
  ACCEPTED: { label: 'Accepted - head to pickup', tone: 'active' },
  DRIVER_ARRIVED: { label: 'At pickup', tone: 'active' },
  STARTED: { label: 'Trip in progress', tone: 'progress' },
  COMPLETED: { label: 'Completed', tone: 'done' },
  CANCELLED: { label: 'Cancelled', tone: 'cancelled' },
};

const RIDE_EVENT_LABELS = {
  DRIVER_ARRIVED: 'Driver arrived at the pickup',
  STARTED: 'Trip started',
  COMPLETED: 'Trip completed - paid',
};

// Human wording for the audit log entries.
export function describeEvent(event) {
  const via = event.details?.via;
  switch (event.type) {
    case 'REQUEST_CREATED':
      return 'Ride requested';
    case 'REQUEST_MATCHED':
      if (via === 'AUTO_MATCH') return 'Matched into a shared Tesla automatically';
      if (via === 'DRIVER_ADDED') return 'Driver added you to their ride';
      return 'Driver accepted your request';
    case 'REQUEST_CANCELLED':
      return 'You cancelled the request';
    case 'REQUEST_REQUEUED':
      return 'Driver cancelled - back in the queue for another Tesla';
    case 'FARE_LOCKED':
      return event.details?.pooled
        ? `Fare locked with pool discount (${event.details.passengersInRide} passengers)`
        : 'Fare locked (riding solo)';
    case 'RIDE_ACCEPTED':
      return 'Ride accepted';
    case 'RIDE_CANCELLED':
      return event.details?.reason === 'ALL_PASSENGERS_CANCELLED' ? 'Ride cancelled - no passengers left' : 'Ride cancelled';
    case 'RIDE_STATUS_CHANGED':
      return RIDE_EVENT_LABELS[event.toStatus] ?? event.toStatus;
    default:
      return event.type;
  }
}
