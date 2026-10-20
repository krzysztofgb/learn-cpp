import * as TabsPrimitive from '@radix-ui/react-tabs';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Suspense, use, useEffect, useRef, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { Badge } from '../components/arc/badge/badge.tsx';
import { Button } from '../components/arc/button/button.tsx';
import { InlineMarkdown, Markdown } from '../components/Markdown.tsx';
import { ExerciseCard, PredictCard, QuestionDrill, UbCard } from '../components/ModuleSections.tsx';
import { RunOptions } from '../components/RunOptions.tsx';
import { allModules, findModule, type ModuleInfo, type Phase } from '../course/course.ts';
import { loadModule } from '../course/content.ts';
import type { ModuleContent } from '../course/types.ts';
import { useCompileOptions } from '../hooks/useCompileOptions.ts';
import { actions, isModuleDone, useModuleProgress, type ModuleProgress } from '../progress/store.ts';
import { NotFound } from './NotFound.tsx';
import { PageTitle } from '../components/PageTitle.tsx';

const PHASE_NOTES: Record<number, string> = {
  5: "Threads don't run in the browser yet: threaded examples open in Compiler Explorer with ThreadSanitizer. Single-threaded atomics run here.",
  6: 'Timings from WebAssembly in a browser are not representative of native code. Run measurement exercises on your machine.',
  7: 'Operating-system and networking APIs are not available in the browser. Most examples here are for reading or for Compiler Explorer.',
};

type TabId = 'notes' | 'predict' | 'ub' | 'exercises' | 'interview' | 'answers';

interface Tab {
  id: TabId;
  label: string;
  /** Done and total, shown after the label. */
  count?: [number, number];
  body: ReactNode;
}

export function ModulePage() {
  const found = findModule(useParams().slug);
  if (!found) return <NotFound />;
  return (
    <Suspense fallback={<p className="muted">Loading module…</p>}>
      <ModuleView key={found.module.slug} module={found.module} phase={found.phase} />
    </Suspense>
  );
}

const strong = (module: ModuleProgress, id: string) => ['good', 'easy'].includes(module.questions[id]?.grade ?? '');

/** One tab per part of the module, in reading order. Sections without their own part ("How to use it", "Prompt 1") read in the first tab. */
function buildTabs(content: ModuleContent, slug: string, progress: ModuleProgress): Tab[] {
  const tabs: Tab[] = [];
  const reading = content.layout.filter((section) => section.kind === 'notes' || section.kind === 'extra');
  if (reading.length > 0) {
    const hasNotes = reading.some((section) => section.kind === 'notes');
    tabs.push({
      id: 'notes',
      label: hasNotes ? 'Notes' : 'Guide',
      body: reading.map((section, index) => (
        <section key={index} className="reading-section">
          {section.kind === 'extra' || reading.length > 1 ? <h2>{section.heading}</h2> : <h2 className="sr-only">{section.heading}</h2>}
          <Markdown text={section.body ?? ''} />
        </section>
      )),
    });
  }
  const heading = (kind: string) => content.layout.find((section) => section.kind === kind)?.heading;
  if (content.predict.items.length > 0) {
    tabs.push({
      id: 'predict',
      label: 'Predict',
      count: [content.predict.items.filter((item) => progress.predictions[item.id]).length, content.predict.items.length],
      body: (
        <>
          <h2 className="sr-only">{heading('predict')}</h2>
          {content.predict.intro && <Markdown text={content.predict.intro} />}
          {content.predict.items.map((item) => (
            <PredictCard key={item.id} slug={slug} item={item} />
          ))}
        </>
      ),
    });
  }
  if (content.ub.items.length > 0) {
    tabs.push({
      id: 'ub',
      label: 'Spot the bug',
      count: [content.ub.items.filter((item) => progress.ub[item.id]).length, content.ub.items.length],
      body: (
        <>
          <h2 className="sr-only">{heading('ub')}</h2>
          {content.ub.intro && <Markdown text={content.ub.intro} />}
          {content.ub.items.map((item) => (
            <UbCard key={item.id} slug={slug} item={item} />
          ))}
        </>
      ),
    });
  }
  if (content.exercises.items.length > 0) {
    tabs.push({
      id: 'exercises',
      label: 'Exercises',
      count: [content.exercises.items.filter((item) => progress.exercises[item.id]?.done).length, content.exercises.items.length],
      body: (
        <>
          <h2 className="sr-only">Exercises</h2>
          {content.exercises.intro && <Markdown text={content.exercises.intro} />}
          {content.exercises.items.map((item) => (
            <ExerciseCard key={item.id} slug={slug} item={item} />
          ))}
        </>
      ),
    });
  }
  if (content.questions.items.length > 0) {
    tabs.push({
      id: 'interview',
      label: 'Interview',
      count: [content.questions.items.filter((q) => strong(progress, q.id)).length, content.questions.items.length],
      body: (
        <>
          <h2 className="sr-only">Interview questions</h2>
          {content.questions.intro && <Markdown text={content.questions.intro} />}
          <p className="muted">The module counts as done once every question is graded Good or Easy.</p>
          <QuestionDrill slug={slug} questions={content.questions.items} />
        </>
      ),
    });
  }
  if (content.answerKey.length > 0) {
    tabs.push({
      id: 'answers',
      label: 'Answer key',
      body: (
        <>
          <h2 className="sr-only">Answer key</h2>
          <p className="muted">Work through the problems first.</p>
          {content.answerKey.map((part, index) => (
            <details key={index} className="card answer-reveal">
              <summary>{part.heading || 'Show answers'}</summary>
              <Markdown text={part.body} />
            </details>
          ))}
        </>
      ),
    });
  }
  return tabs;
}

function ModuleView({ module, phase }: { module: ModuleInfo; phase: Phase }) {
  const content = use(loadModule(module.slug));
  const progress = useModuleProgress(module.slug);
  const [options, setOptions] = useCompileOptions();
  const location = useLocation();
  const navigate = useNavigate();
  const index = allModules.findIndex((m) => m.slug === module.slug);
  const previous = allModules[index - 1];
  const next = allModules[index + 1];

  const done = content !== undefined && isModuleDone(progress, content.questions.items.map((q) => q.id));
  // Remember the done state so the sidebar can show it without loading every module's content.
  useEffect(() => {
    if (content && (progress.done ?? false) !== done) actions.setDone(module.slug, done);
  }, [content, done, progress.done, module.slug]);

  const tabList = useRef<HTMLDivElement>(null);
  // On a narrow screen the tab row scrolls sideways; keep the selected tab in view (horizontally only, never the page).
  useEffect(() => {
    const list = tabList.current;
    const tab = list?.querySelector<HTMLElement>('[data-state="active"]');
    if (!list || !tab) return;
    const box = list.getBoundingClientRect();
    const at = tab.getBoundingClientRect();
    if (at.left < box.left || at.right > box.right) list.scrollLeft += at.left - box.left - (box.width - at.width) / 2;
  }, [location.hash]);

  if (!content) {
    return (
      <article className="page">
        <h1>{module.title}</h1>
        <p className="muted">This module's content hasn't been imported yet.</p>
      </article>
    );
  }

  const tabs = buildTabs(content, module.slug, progress);
  const requested = location.hash.slice(1);
  const active = tabs.find((tab) => tab.id === requested)?.id ?? tabs[0]?.id ?? 'notes';
  const select = (id: string) => navigate({ hash: id }, { replace: true, preventScrollReset: true });
  const position = tabs.findIndex((tab) => tab.id === active);
  const following = tabs[position + 1];

  return (
    <article className="page module-page">
      <PageTitle>{`${module.number}. ${module.title}`}</PageTitle>
      <header className="title-row">
        <h1>
          {module.title}
          {done && <Badge tone="success">Done</Badge>}
        </h1>
        <p className="subtitle">
          Module {module.number} · <InlineMarkdown text={module.topics} />
        </p>
      </header>
      {content.intro && <Markdown text={content.intro} />}
      {PHASE_NOTES[phase.number] && <p className="notice">{PHASE_NOTES[phase.number]}</p>}

      <TabsPrimitive.Root value={active} onValueChange={select} className="module-tabs">
        <div className="tab-bar">
          <TabsPrimitive.List ref={tabList} className="tab-list" aria-label="Module sections">
            {tabs.map((tab) => (
              <TabsPrimitive.Trigger key={tab.id} value={tab.id} className="tab">
                {tab.label}
                {tab.count && (
                  <span className="tab-count">
                    {tab.count[0]}
                    <span className="of">/{tab.count[1]}</span>
                  </span>
                )}
              </TabsPrimitive.Trigger>
            ))}
          </TabsPrimitive.List>
          <RunOptions options={options} onChange={setOptions} />
        </div>
        {tabs.map((tab) => (
          <TabsPrimitive.Content key={tab.id} value={tab.id} className="tab-panel">
            {tab.body}
            <nav className="pager" aria-label="Continue">
              {following ? (
                <Button variant="secondary" onClick={() => select(following.id)}>
                  Next: {following.label}
                  <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                </Button>
              ) : (
                <>
                  {previous ? (
                    <Link to={`/modules/${previous.slug}`} className="pager-link">
                      <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
                      {previous.number}. {previous.title}
                    </Link>
                  ) : (
                    <span />
                  )}
                  {next && (
                    <Link to={`/modules/${next.slug}`} className="pager-link">
                      {next.number}. {next.title}
                      <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                    </Link>
                  )}
                </>
              )}
            </nav>
          </TabsPrimitive.Content>
        ))}
      </TabsPrimitive.Root>
    </article>
  );
}
