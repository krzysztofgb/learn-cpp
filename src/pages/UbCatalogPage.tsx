import { CheckCheck } from 'lucide-react';
import { Suspense, use, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/arc/button/button.tsx';
import { EmptyState } from '../components/arc/empty-state/empty-state.tsx';
import { Select } from '../components/arc/select/select.tsx';
import { Switch } from '../components/arc/switch/switch.tsx';
import { UbCard } from '../components/ModuleSections.tsx';
import { loadAllModules } from '../course/content.ts';
import { useProgress } from '../progress/store.ts';
import { PageTitle } from '../components/PageTitle.tsx';

export function UbCatalogPage() {
  return (
    <article className="page">
      <PageTitle>UB catalog</PageTitle>
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
  const shown = modules
    .filter((module) => moduleFilter === 'all' || module.info.slug === moduleFilter)
    .map((module) => ({ module, items: module.content.ub.items.filter((item) => !unansweredOnly || !progress.modules[module.info.slug]?.ub[item.id]) }))
    .filter(({ items }) => items.length > 0);

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
      {shown.length === 0 && (
        <EmptyState
          icon={<CheckCheck size={20} strokeWidth={1.75} aria-hidden="true" />}
          title="Every item here is answered"
          description="Turn off “Unanswered only” to go over them again, or pick another module."
          action={
            <Button variant="secondary" size="sm" onClick={() => setUnansweredOnly(false)}>
              Show answered items
            </Button>
          }
        />
      )}
      {shown.map(({ module, items }) => (
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
      ))}
    </>
  );
}
