import { CheckCheck } from 'lucide-react';
import { memo, Suspense, use, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/arc/button/button.tsx';
import { EmptyState } from '../components/arc/empty-state/empty-state.tsx';
import { Select } from '../components/arc/select/select.tsx';
import { Switch } from '../components/arc/switch/switch.tsx';
import { UbCard } from '../components/ModuleSections.tsx';
import { loadAllModules } from '../course/content.ts';
import { useProgress } from '../progress/store.ts';
import { PageTitle } from '../components/PageTitle.tsx';
import { PageSkeleton } from '../components/PageSkeleton.tsx';

// Filters re-render the list; cards whose props didn't change are skipped.
const CatalogCard = memo(UbCard);

/** Average rendered card height (measured at 1440 px), used to reserve space for cards not yet rendered. */
const CARD_HEIGHT = 650;

/**
 * Renders its cards once the section comes within a screen or so of the viewport, and keeps them
 * after that. 154 cards at once blocked a mid-range phone for over half a second.
 */
function LazySection({ count, children }: { count: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (near || !ref.current) return;
    const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && setNear(true), { rootMargin: '1200px 0px' });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [near]);
  return (
    <div ref={ref} style={near ? undefined : { minHeight: count * CARD_HEIGHT }}>
      {near ? children : null}
    </div>
  );
}

export function UbCatalogPage() {
  return (
    <article className="page">
      <PageTitle>UB catalog</PageTitle>
      <header className="title-row">
        <h1>UB catalog</h1>
        <p className="subtitle">Every "spot the bug" item from all modules in one place, for drilling before an interview.</p>
      </header>
      <Suspense fallback={<PageSkeleton label="Loading the catalog…" blocks={[40, 420, 420]} />}>
        <Catalog />
      </Suspense>
    </article>
  );
}

function Catalog() {
  const modules = use(loadAllModules()).filter((module) => module.ub.items.length > 0);
  const progress = useProgress();
  const [moduleFilter, setModuleFilter] = useState('all');
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const total = modules.reduce((n, module) => n + module.ub.items.length, 0);
  const answered = modules.reduce((n, module) => n + Object.keys(progress.modules[module.slug]?.ub ?? {}).length, 0);
  const shown = modules
    .filter((module) => moduleFilter === 'all' || module.slug === moduleFilter)
    .map((module) => ({ module, items: module.ub.items.filter((item) => !unansweredOnly || !progress.modules[module.slug]?.ub[item.id]) }))
    .filter(({ items }) => items.length > 0);

  return (
    <>
      <div className="toolbar">
        <Select
          className="filter-select"
          label="Module"
          value={moduleFilter}
          onValueChange={setModuleFilter}
          options={[{ value: 'all', label: 'All modules' }, ...modules.map((module) => ({ value: module.slug, label: `${module.number}. ${module.title}` }))]}
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
        <section key={module.slug} className="module-section">
          <h2>
            <Link to={`/modules/${module.slug}#ub`}>
              {module.number}. {module.title}
            </Link>
          </h2>
          <LazySection count={items.length}>
            {items.map((item) => (
              <CatalogCard key={item.id} slug={module.slug} item={item} />
            ))}
          </LazySection>
        </section>
      ))}
    </>
  );
}
