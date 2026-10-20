import { Check, House, ListChecks, RotateCcw, SquareTerminal, TriangleAlert, X, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router';
import { course } from '../course/course.ts';
import { dueQuestions, useProgress } from '../progress/store.ts';
import { Button } from './arc/button/button.tsx';
import { Mark } from './Mark.tsx';

function useDueCount(): number {
  const progress = useProgress();
  // Re-checked every minute so cards graded "Again" (due in 10 minutes) show up without a reload.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return dueQuestions(progress, now).length;
}

function Destination({ to, icon: Icon, label, count, onNavigate }: { to: string; icon: LucideIcon; label: string; count?: number; onNavigate: () => void }) {
  return (
    <li>
      <NavLink to={to} end={to === '/'} className="nav-item" onClick={onNavigate} aria-label={count ? `${label}, ${count} due` : undefined}>
        <Icon size={16} strokeWidth={1.6} aria-hidden="true" />
        <span>{label}</span>
        {count ? <span className="nav-count">{count}</span> : null}
      </NavLink>
    </li>
  );
}

/**
 * The app and course navigation. On wide screens it is part of the frame; on phones it is a drawer,
 * where `onNavigate` closes it after a link and `onClose` closes it from its own button.
 */
export function Sidebar({ id, open, onNavigate, onClose }: { id: string; open: boolean; onNavigate: () => void; onClose: () => void }) {
  const progress = useProgress();
  const due = useDueCount();
  const close = useRef<HTMLButtonElement>(null);
  // Opening the drawer puts focus inside it.
  useEffect(() => {
    if (open) close.current?.focus();
  }, [open]);
  return (
    <aside id={id} className={`sidebar${open ? ' open' : ''}`}>
      <div className="sidebar-head">
        <Link to="/" className="brand" onClick={onNavigate}>
          <Mark />
          <span>learn-cpp</span>
        </Link>
        <Button ref={close} variant="ghost" size="sm" className="nav-close icon-only" aria-label="Close menu" onClick={onClose}>
          <X size={18} strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </div>
      <nav aria-label="App">
        <ul className="nav-list">
          <Destination to="/" icon={House} label="Home" onNavigate={onNavigate} />
          <Destination to="/review" icon={RotateCcw} label="Review" count={due} onNavigate={onNavigate} />
          <Destination to="/playground" icon={SquareTerminal} label="Playground" onNavigate={onNavigate} />
          <Destination to="/catalog" icon={TriangleAlert} label="UB catalog" onNavigate={onNavigate} />
          <Destination to="/progress" icon={ListChecks} label="Progress" onNavigate={onNavigate} />
        </ul>
      </nav>
      <nav aria-label="Course modules" className="course-nav">
        {course.phases.map((phase) => (
          <section key={phase.number} className="nav-group">
            <h2 className="nav-group-label">{phase.title}</h2>
            <ol className="nav-list">
              {phase.modules.map((module) => {
                const state = progress.modules[module.slug];
                return (
                  <li key={module.slug}>
                    <NavLink to={`/modules/${module.slug}`} className="nav-item module-item" onClick={onNavigate}>
                      <span className="module-number">{module.number}</span>
                      <span className="module-title">{module.title}</span>
                      {state?.done ? (
                        <Check className="module-state" size={14} strokeWidth={2} aria-label="done" />
                      ) : state ? (
                        <span className="module-state started" aria-label="started" />
                      ) : null}
                    </NavLink>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </nav>
    </aside>
  );
}
