import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ErrorMessage } from '../components/Feedback';

// The story cast, so evaluators can try every role in one click.
const DEMO_ACCOUNTS = [
  { name: 'Nusrat', email: 'nusrat@teslapool.test', role: 'Passenger' },
  { name: 'Rafiq', email: 'rafiq@teslapool.test', role: 'Passenger' },
  { name: 'Shirin', email: 'shirin@teslapool.test', role: 'Passenger' },
  { name: 'Jashim', email: 'jashim@teslapool.test', role: 'Driver of Bullet' },
];
const DEMO_PASSWORD = 'teslapool123';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function signIn(email, password) {
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    signIn(form.email, form.password);
  }

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  return (
    <div className="auth">
      <section className="card auth__card">
        <h1>Sign in</h1>
        <p className="muted">Passengers and drivers use the same sign-in.</p>

        <form onSubmit={handleSubmit} className="form" noValidate>
          <label className="field">
            <span>Email</span>
            <input type="email" autoComplete="email" value={form.email} onChange={update('email')} required />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={update('password')}
              required
            />
          </label>
          <ErrorMessage error={error} />
          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="muted auth__switch">
          New passenger? <Link to="/register">Create an account</Link>
        </p>
      </section>

      <section className="card auth__demo">
        <h2>Try the story</h2>
        <p className="muted">
          Demo accounts from the brief (password <code>{DEMO_PASSWORD}</code>). Open the driver in one browser and a
          passenger in another (or a private window) to watch a pool form.
        </p>
        <div className="demo-list">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              className="demo-account"
              disabled={submitting}
              onClick={() => signIn(account.email, DEMO_PASSWORD)}
            >
              <strong>{account.name}</strong>
              <span>{account.role}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
