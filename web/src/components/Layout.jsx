import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = {
  PASSENGER: [
    { to: '/ride', label: 'Ride', end: true },
    { to: '/ride/history', label: 'History' },
  ],
  DRIVER: [
    { to: '/driver', label: 'Dashboard', end: true },
    { to: '/driver/history', label: 'History' },
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const serverWaking = useSlowServer();

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__inner">
          <Link to="/" className="brand">
            <img src="/favicon.svg" alt="" width="28" height="28" />
            <span>
              Dhaka Tesla Pool
              <small>Share a seat. Split the fare.</small>
            </span>
          </Link>

          {user && (
            <nav className="topbar__nav" aria-label="Main">
              {NAV[user.role].map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className="topbar__link">
                  {item.label}
                </NavLink>
              ))}
              <span className="topbar__user">
                {user.name}
                <span className="topbar__role">{user.role === 'DRIVER' ? 'Driver' : 'Passenger'}</span>
              </span>
              <button type="button" className="btn btn--ghost btn--small" onClick={logout}>
                Sign out
              </button>
            </nav>
          )}
        </div>
      </header>

      {serverWaking && (
        <div className="wake-banner" role="status">
          Waking up the server... the free hosting sleeps when idle, this can take up to a minute.
        </div>
      )}

      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}

// True while any API request has been pending for more than a few seconds.
function useSlowServer() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const onSlow = (event) => setSlow(event.detail);
    window.addEventListener('api:slow', onSlow);
    return () => window.removeEventListener('api:slow', onSlow);
  }, []);
  return slow;
}
