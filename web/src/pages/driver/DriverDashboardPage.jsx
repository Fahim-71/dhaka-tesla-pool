import { useAuth } from '../../context/AuthContext';

export default function DriverDashboardPage() {
  const { user } = useAuth();
  return (
    <div className="card">
      <h1>Hi {user.name}</h1>
      <p className="muted">The driver dashboard is coming next.</p>
    </div>
  );
}
