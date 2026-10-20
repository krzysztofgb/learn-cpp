import { Suspense, use, useState } from 'react';
import { Link } from 'react-router';
import { UbCard } from '../components/ModuleSections.tsx';
import { loadAllModules } from '../course/content.ts';
import { useProgress } from '../progress/store.ts';

export function UbCatalogPage() {
  return (
    <article className="page">
      <h1>UB and bug catalog</h1>
      <p className="lede">Every "spot the bug" item from all modules in one place, for drilling before an interview.</p>
      <Suspense fallback={<p className="muted">Loading the catalog…</p>}>
        <Catalog />
      </Suspense>
    </article>
  );
}

function Catalog() {
  const modules = use(loadAllModules()).filter((module) => module.content.ub.items.length > 0);
  const progress = useProgress();
  const [moduleFilter, setModuleFilter] = useState('all');
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const total = modules.reduce((n, module) => n + module.content.ub.items.length, 0);
  const answered = modules.reduce((n, module) => n + Object.keys(progress.modules[module.info.slug]?.ub ?? {}).length, 0);

  return (
    <>
      <div className="filters">
        <label>
          <span className="sr-only">Module</span>
          <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
            <option value="all">All modules</option>
            {modules.map((module) => (
              <option key={module.info.slug} value={module.info.slug}>
                {module.info.number}. {module.info.title}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={unansweredOnly} onChange={(event) => setUnansweredOnly(event.target.checked)} />
          Unanswered only
        </label>
        <span className="muted small-text">
          {answered} of {total} answered
        </span>
      </div>
      {modules
        .filter((module) => moduleFilter === 'all' || module.info.slug === moduleFilter)
        .map((module) => {
          const items = module.content.ub.items.filter((item) => !unansweredOnly || !progress.modules[module.info.slug]?.ub[item.id]);
          if (items.length === 0) return null;
          return (
            <section key={module.info.slug} className="module-section">
              <h2>
                <Link to={`/modules/${module.info.slug}#ub`}>
                  {module.info.number}. {module.info.title}
                </Link>
              </h2>
              {items.map((item) => (
                <UbCard key={item.id} slug={module.info.slug} item={item} />
              ))}
            </section>
          );
        })}
    </>
  );
}
