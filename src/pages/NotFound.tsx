import { Link } from 'react-router';

export function NotFound() {
  return (
    <article className="page">
      <h1>Page not found</h1>
      <p>
        That page doesn't exist. <Link to="/">Back to the course</Link>.
      </p>
    </article>
  );
}
