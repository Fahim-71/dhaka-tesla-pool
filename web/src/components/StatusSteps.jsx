// Progress bar for a passenger's ride:
// Waiting -> Matched -> Driver arrived -> In progress -> Completed
const STEPS = [
  { key: 'WAITING', label: 'Waiting' },
  { key: 'MATCHED', label: 'Matched' },
  { key: 'DRIVER_ARRIVED', label: 'Driver arrived' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'COMPLETED', label: 'Completed' },
];

export default function StatusSteps({ status }) {
  if (status === 'CANCELLED') return null;
  const current = STEPS.findIndex((step) => step.key === status);

  return (
    <ol className="steps" aria-label="Ride progress">
      {STEPS.map((step, index) => {
        // A finished ride has no "current" step - every step is done.
        const finished = status === 'COMPLETED';
        const state = index < current || finished ? 'done' : index === current ? 'current' : 'todo';
        return (
          <li key={step.key} className={`steps__item steps__item--${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="steps__dot" aria-hidden="true" />
            <span className="steps__label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
