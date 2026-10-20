import { Suspense, use, useState } from 'react';
import { Link } from 'react-router';
import { Select } from '../components/arc/select/select.tsx';
import { Switch } from '../components/arc/switch/switch.tsx';
import { UbCard } from '../components/ModuleSections.tsx';
import { loadAllModules } from '../course/content.ts';
import { useProgress } from '../progress/store.ts';

export function UbCatalogPage() {
  return (
    <article className="page">
      <header className="title-row">
        <h1>UB catalog</h1>
        <p className="subtitle">Every "spot the bug" item from all modules in one place, for drilling before an interview.</p>
      </header>
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
      <div className="toolbar">
        <Select
          className="filter-select"
          label="Module"
          value={moduleFilter}
          onValueChange={setModuleFilter}
          options={[{ value: 'all', label: 'All modules' }, ...modules.map((module) => ({ value: module.info.slug, label: `${module.info.number}. ${module.info.title}` }))]}
        />
        <Switch label="Unanswered only" checked={unansweredOnly} onCheckedChange={setUnansweredOnly} />
        <p className="toolbar-count">
          {answered} of {total} answered
        </p>
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
