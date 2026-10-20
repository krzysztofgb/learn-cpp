import { Menu } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router';
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
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const firstRender = useRef(true);
  const restoreFocus = useRef(false);
  // Escape and the close button hand focus back to the menu button; following a link moves it to the new page.
  const closeNav = () => {
    restoreFocus.current = true;
    setNavOpen(false);
  };

  // A new page moves focus to its content, so keyboard and screen-reader users start there, not on the old link.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    main.current?.focus({ preventScroll: true });
  }, [pathname]);

  useEffect(() => {
    if (!navOpen) {
      // Runs after the frame stops being inert, so the button can take focus.
      if (restoreFocus.current) toggle.current?.focus();
      restoreFocus.current = false;
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      restoreFocus.current = true;
      setNavOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navOpen]);

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Sidebar id="course-nav" open={navOpen} onNavigate={() => setNavOpen(false)} onClose={closeNav} />
      {navOpen && <div className="scrim" onClick={closeNav} aria-hidden="true" />}
      {/* While the drawer is open, the page behind it can't be reached. */}
      <div className="frame" inert={navOpen}>
        <header className="topbar">
          <Button
            ref={toggle}
            variant="ghost"
            size="sm"
            className="nav-toggle icon-only"
            aria-label="Open menu"
            aria-expanded={navOpen}
            aria-controls="course-nav"
            onClick={() => setNavOpen(true)}
          >
            <Menu size={18} strokeWidth={1.75} aria-hidden="true" />
          </Button>
          <Breadcrumb />
          <ThemeToggle />
        </header>
        <main className="sheet" id="main" ref={main} tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <ScrollRestoration />
    </div>
  );
}
