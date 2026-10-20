import { useEffect, useState } from 'react';
import { Link, Outlet, ScrollRestoration } from 'react-router';
import { dueQuestions, useProgress } from '../progress/store.ts';
import { Sidebar } from './Sidebar.tsx';
import { ThemeToggle } from './ThemeToggle.tsx';

export function Layout() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="app">
      <header className="topbar">
        <button
          type="button"
          className="icon-button nav-toggle"
          aria-label={navOpen ? 'Close course menu' : 'Open course menu'}
          aria-expanded={navOpen}
          aria-controls="course-nav"
          onClick={() => setNavOpen((open) => !open)}
        >
          <span aria-hidden="true">☰</span>
        </button>
        <Link to="/" className="brand">
          learn<span>-cpp</span>
        </Link>
        <nav className="topnav" aria-label="Primary">
          <ReviewLink />
          <Link to="/catalog" className="wide-only">
            UB catalog
          </Link>
          <Link to="/playground" className="wide-only">
            Playground
          </Link>
          <Link to="/progress" className="wide-only">
            Progress
          </Link>
          <ThemeToggle />
        </nav>
      </header>
      <Sidebar id="course-nav" open={navOpen} onNavigate={() => setNavOpen(false)} />
      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />}
      <main className="content" id="main">
        <Outlet />
      </main>
      <ScrollRestoration />
    </div>
  );
}

function ReviewLink() {
  const progress = useProgress();
  // Re-checked every minute so cards graded "Again" (due in 10 minutes) show up without a reload.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const due = dueQuestions(progress, now).length;
  return (
    <Link to="/review" aria-label={due > 0 ? `Review, ${due} due` : 'Review'}>
      Review{due > 0 && <span className="due-count">{due}</span>}
    </Link>
  );
}
