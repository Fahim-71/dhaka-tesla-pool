import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ErrorMessage } from '../components/Feedback';

// Passenger sign-up. Drivers are registered by the operator, not here.
export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Quick checks in the browser; the API validates everything again.
  function validate() {
    const errors = {};
    if (form.name.trim().length < 2) errors.name = 'Name must be at least 2 characters';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.email = 'Enter a valid email address';
    if (form.phone && !/^(\+?880)?01[3-9]\d{8}$/.test(form.phone.trim())) {
      errors.phone = 'Enter a Bangladeshi mobile number, e.g. 01711234567';
    }
    if (form.password.length < 8) errors.password = 'Password must be at least 8 characters';
    return errors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setError(null);
    try {
      await register(form);
      navigate('/ride', { replace: true });
    } catch (err) {
      // Show the API's field errors next to the fields they belong to.
      if (err.code === 'VALIDATION_ERROR' && err.details) {
        setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      } else {
        setError(err);
      }
      setSubmitting(false);
    }
  }

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  return (
    <div className="auth auth--single">
      <section className="card auth__card">
        <h1>Create a passenger account</h1>
        <p className="muted">Book a seat, share the ride, split the fare.</p>

        <form onSubmit={handleSubmit} className="form" noValidate>
          <Field label="Name" error={fieldErrors.name}>
            <input value={form.name} onChange={update('name')} autoComplete="name" />
          </Field>
          <Field label="Email" error={fieldErrors.email}>
            <input type="email" value={form.email} onChange={update('email')} autoComplete="email" />
          </Field>
          <Field label="Mobile number (optional)" error={fieldErrors.phone}>
            <input type="tel" value={form.phone} onChange={update('phone')} placeholder="01711234567" />
          </Field>
          <Field label="Password" error={fieldErrors.password}>
            <input type="password" value={form.password} onChange={update('password')} autoComplete="new-password" />
          </Field>
          <ErrorMessage error={error} />
          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="muted auth__switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <label className={`field ${error ? 'field--invalid' : ''}`}>
      <span>{label}</span>
      {children}
      {error && <small className="field__error">{error}</small>}
    </label>
  );
}
