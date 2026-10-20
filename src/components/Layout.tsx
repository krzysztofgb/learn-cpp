import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Outlet, ScrollRestoration } from 'react-router';
import { Button } from './arc/button/button.tsx';
import { Breadcrumb } from './Breadcrumb.tsx';
import { Sidebar } from './Sidebar.tsx';
import { ThemeToggle } from './ThemeToggle.tsx';

/**
 * The framed sheet: the sidebar and the top bar share one tinted frame with no rule between them,
 * and each page sits on a white sheet inset from the window's right and bottom edges.
 */
export function Layout() {
  const [navOpen, setNavOpen] = useState(false);
  return (
    <div className="app">
      <Sidebar id="course-nav" open={navOpen} onNavigate={() => setNavOpen(false)} />
      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />}
      <div className="frame">
        <header className="topbar">
          <Button
            variant="ghost"
            size="sm"
            className="nav-toggle icon-only"
            aria-label={navOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={navOpen}
            aria-controls="course-nav"
            onClick={() => setNavOpen((open) => !open)}
          >
            {navOpen ? <X size={18} strokeWidth={1.75} aria-hidden="true" /> : <Menu size={18} strokeWidth={1.75} aria-hidden="true" />}
          </Button>
          <Breadcrumb />
          <ThemeToggle />
        </header>
        <main className="sheet" id="main">
          <Outlet />
        </main>
      </div>
      <ScrollRestoration />
    </div>
  );
}
