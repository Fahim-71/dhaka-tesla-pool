import { describeEvent, formatTime } from '../utils/format';

// The audit log for a ride or request: "what exactly happened, and when".
export default function EventTimeline({ events }) {
  if (!events?.length) return null;
  return (
    <ol className="timeline">
      {events.map((event) => (
        <li key={event.id} className="timeline__item">
          <time dateTime={event.createdAt}>{formatTime(event.createdAt)}</time>
          <span>{describeEvent(event)}</span>
        </li>
      ))}
    </ol>
  );
}
