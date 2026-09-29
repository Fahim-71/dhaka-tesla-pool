// Bullet's seats, filled in order with the passengers who booked them.
// Shows at a glance who is riding and how many seats are free.
export default function SeatMap({ capacity, members }) {
  const seats = members.flatMap((m) => Array.from({ length: m.seats }, () => m.passenger.name));
  return (
    <div className="seats" aria-label={`${seats.length} of ${capacity} seats booked`}>
      {Array.from({ length: capacity }, (_, i) => (
        <div key={i} className={`seat ${seats[i] ? 'seat--taken' : ''}`}>
          <span className="seat__number">Seat {i + 1}</span>
          <strong>{seats[i] ?? 'Free'}</strong>
        </div>
      ))}
    </div>
  );
}
