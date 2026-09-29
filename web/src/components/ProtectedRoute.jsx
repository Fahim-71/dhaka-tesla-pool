import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from './Loading';

// Only renders the child routes for a signed-in user with the right role.
// The API checks roles too - this just keeps people on the right screens.
export default function ProtectedRoute({ role }) {
  const { user, checking } = useAuth();

  if (checking) return <Loading label="Checking your session..." />;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
}

// Sends "/" to the right home screen for the user's role.
export function HomeRedirect() {
  const { user, checking } = useAuth();
  if (checking) return <Loading label="Checking your session..." />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'DRIVER' ? '/driver' : '/ride'} replace />;
}

// Login / register: skip them when already signed in.
export function GuestOnly({ children }) {
  const { user, checking } = useAuth();
  if (checking) return <Loading label="Checking your session..." />;
  if (user) return <Navigate to="/" replace />;
  return children;
}
