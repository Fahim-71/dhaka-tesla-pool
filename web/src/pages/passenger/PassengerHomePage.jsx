import { useAuth } from '../../context/AuthContext';

export default function PassengerHomePage() {
  const { user } = useAuth();
  return (
    <div className="card">
      <h1>Hi {user.name}</h1>
      <p className="muted">Booking a ride is coming next.</p>
    </div>
  );
}
