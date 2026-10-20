import { Link } from 'react-router';
import { PageTitle } from '../components/PageTitle.tsx';

export function NotFound() {
  return (
    <article className="page">
      <PageTitle>Page not found</PageTitle>
      <h1>Page not found</h1>
      <p>
        That page doesn't exist. <Link to="/">Back to the course</Link>.
      </p>
    </article>
  );
}
