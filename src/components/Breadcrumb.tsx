import { ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { findModule } from '../course/course.ts';

const PAGES: Record<string, string> = {
  '/': 'Course',
  '/review': 'Review',
  '/playground': 'Playground',
  '/catalog': 'UB catalog',
  '/progress': 'Progress',
};

/** Where you are, in the top bar: the phase and module on a module page, the page's name elsewhere. */
export function Breadcrumb() {
  const { pathname } = useLocation();
  const slug = /^\/modules\/([^/]+)/.exec(pathname)?.[1];
  const found = slug ? findModule(slug) : undefined;
  if (found) {
    return (
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li className="crumb-parent">
            <Link to="/">Phase {found.phase.number} · {found.phase.title}</Link>
          </li>
          <li aria-current="page">
            <ChevronRight size={14} strokeWidth={1.6} aria-hidden="true" />
            <span>
              {found.module.number}. {found.module.title}
            </span>
          </li>
        </ol>
      </nav>
    );
  }
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol>
        <li aria-current="page">{PAGES[pathname] ?? 'learn-cpp'}</li>
      </ol>
    </nav>
  );
}
