import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="card narrow center">
      <h1>Wrong turn</h1>
      <p className="muted">This page doesn't exist - even Bullet can't find it.</p>
      <Link to="/" className="btn btn--primary">
        Back home
      </Link>
    </div>
  );
}
