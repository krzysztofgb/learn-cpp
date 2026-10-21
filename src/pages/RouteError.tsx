import { useEffect } from 'react';
import { Link, useRouteError } from 'react-router';
import { Button } from '../components/arc/button/button.tsx';
import { PageTitle } from '../components/PageTitle.tsx';

/** A page's code that failed to download (Chrome, Firefox and Safari word it differently). */
function isChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message);
}

const RELOADED_KEY = 'learn-cpp/reloaded-for-chunk';

/**
 * Shown in place of a page that failed to render, inside the app frame so navigation still works.
 * A missing chunk usually means a new version was deployed while this tab was open: reload once
 * to pick it up before showing anything.
 */
export function RouteError() {
  const error = useRouteError();
  const chunk = isChunkError(error);

  useEffect(() => {
    if (!chunk) return;
    // At most one automatic reload a minute, so a chunk that is really missing can't loop.
    try {
      if (Date.now() - Number(sessionStorage.getItem(RELOADED_KEY) ?? 0) < 60_000) return;
      sessionStorage.setItem(RELOADED_KEY, String(Date.now()));
    } catch {
      return;
    }
    window.location.reload();
  }, [chunk]);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <article className="page route-error">
      <PageTitle>Page didn't load</PageTitle>
      <header className="title-row">
        <h1>This page didn't load</h1>
        <p className="subtitle">
          {chunk
            ? 'Part of the app couldn’t be downloaded. Check your connection, then reload; pages you’ve opened before also work offline.'
            : 'Something went wrong while showing this page. Reloading usually fixes it, and your progress is saved in this browser.'}
        </p>
      </header>
      <div className="title-actions">
        <Button onClick={() => window.location.reload()}>Reload</Button>
        <Link to="/" className="link-button">
          Go to the course home
        </Link>
      </div>
    </article>
  );
}
