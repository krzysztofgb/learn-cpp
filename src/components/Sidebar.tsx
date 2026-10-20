import { Link, NavLink } from 'react-router';
import { course } from '../course/course.ts';
import { useProgress } from '../progress/store.ts';

export function Sidebar({ id, open, onNavigate }: { id: string; open: boolean; onNavigate: () => void }) {
  const progress = useProgress();
  return (
    <aside id={id} className={`sidebar${open ? ' open' : ''}`} aria-label="Course modules">
      <nav className="sidebar-links" aria-label="Tools">
        <Link to="/catalog" onClick={onNavigate}>
          UB catalog
        </Link>
        <Link to="/playground" onClick={onNavigate}>
          Playground
        </Link>
        <Link to="/progress" onClick={onNavigate}>
          Progress
        </Link>
      </nav>
      {course.phases.map((phase) => (
        <section key={phase.number} className="phase">
          <h2 className="phase-title">
            <span className="phase-number">Phase {phase.number}</span>
            {phase.title}
          </h2>
          <ol className="module-list">
            {phase.modules.map((module) => (
              <li key={module.slug}>
                <NavLink to={`/modules/${module.slug}`} className="module-link" onClick={onNavigate}>
                  <span className="module-number">{String(module.number).padStart(2, '0')}</span>
                  <span className="module-title">{module.title}</span>
                  {progress.modules[module.slug]?.done ? (
                    <span className="module-status" aria-label="done">
                      ✓
                    </span>
                  ) : progress.modules[module.slug] ? (
                    <span className="module-status started" aria-label="started">
                      •
                    </span>
                  ) : null}
                </NavLink>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </aside>
  );
}
