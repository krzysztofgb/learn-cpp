import { Suspense, use, useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { RunOptions } from '../components/RunOptions.tsx';
import { InlineMarkdown, Markdown } from '../components/Markdown.tsx';
import { ExerciseCard, PredictCard, QuestionDrill, UbCard } from '../components/ModuleSections.tsx';
import { allModules, findModule, type ModuleInfo, type Phase } from '../course/course.ts';
import { loadModule } from '../course/content.ts';
import type { LayoutSection } from '../course/types.ts';
import { useCompileOptions } from '../hooks/useCompileOptions.ts';
import { actions, isModuleDone, useModuleProgress } from '../progress/store.ts';
import { NotFound } from './NotFound.tsx';

const PHASE_NOTES: Record<number, string> = {
  5: "Threads don't run in the browser yet: threaded examples open in Compiler Explorer with ThreadSanitizer. Single-threaded atomics run here.",
  6: 'Timings from WebAssembly in a browser are not representative of native code. Run measurement exercises on your machine.',
  7: 'Operating-system and networking APIs are not available in the browser. Most examples here are for reading or for Compiler Explorer.',
};

export function ModulePage() {
  const found = findModule(useParams().slug);
  if (!found) return <NotFound />;
  return (
    <Suspense
      fallback={
        <article className="page">
          <p className="muted">Loading module…</p>
        </article>
      }
    >
      <ModuleView key={found.module.slug} module={found.module} phase={found.phase} />
    </Suspense>
  );
}

function ModuleView({ module, phase }: { module: ModuleInfo; phase: Phase }) {
  const content = use(loadModule(module.slug));
  const progress = useModuleProgress(module.slug);
  const [options, setOptions] = useCompileOptions();
  const index = allModules.findIndex((m) => m.slug === module.slug);
  const previous = allModules[index - 1];
  const next = allModules[index + 1];

  const done = content !== undefined && isModuleDone(progress, content.questions.items.map((q) => q.id));
  // Remember the done state so the sidebar can show it without loading every module's content.
  useEffect(() => {
    if (content && (progress.done ?? false) !== done) actions.setDone(module.slug, done);
  }, [content, done, progress.done, module.slug]);

  if (!content) {
    return (
      <article className="page">
        <h1>
          Module {module.number}: {module.title}
        </h1>
        <p className="muted">This module's content hasn't been imported yet.</p>
      </article>
    );
  }

  const sectionId = (section: LayoutSection, index: number) => (section.kind === 'extra' ? `section-${index + 1}` : section.kind);
  const counts: Partial<Record<LayoutSection['kind'], number>> = {
    predict: content.predict.items.length,
    ub: content.ub.items.length,
    exercises: content.exercises.items.length,
    questions: content.questions.items.length,
  };
  const shortLabel = (section: LayoutSection) =>
    ({ notes: 'Notes', predict: 'Predict', ub: 'Spot the bug', exercises: 'Exercises', questions: 'Interview', extra: section.heading.split(':')[0]! })[
      section.kind
    ];

  const renderSection = (section: LayoutSection, index: number) => {
    const id = sectionId(section, index);
    switch (section.kind) {
      case 'notes':
      case 'extra':
        return (
          <section key={id} id={id} className="module-section">
            <h2>{section.heading}</h2>
            <Markdown text={section.body ?? ''} />
          </section>
        );
      case 'predict':
        return (
          <section key={id} id={id} className="module-section">
            <h2>{section.heading}</h2>
            {content.predict.intro && <Markdown text={content.predict.intro} />}
            {content.predict.items.map((item) => (
              <PredictCard key={item.id} slug={module.slug} item={item} />
            ))}
          </section>
        );
      case 'ub':
        return (
          <section key={id} id={id} className="module-section">
            <h2>{section.heading}</h2>
            {content.ub.intro && <Markdown text={content.ub.intro} />}
            {content.ub.items.map((item) => (
              <UbCard key={item.id} slug={module.slug} item={item} />
            ))}
          </section>
        );
      case 'exercises':
        return (
          <section key={id} id={id} className="module-section">
            <h2>{section.heading}</h2>
            {content.exercises.intro && <Markdown text={content.exercises.intro} />}
            {content.exercises.items.map((item) => (
              <ExerciseCard key={item.id} slug={module.slug} item={item} />
            ))}
          </section>
        );
      case 'questions':
        return (
          <section key={id} id={id} className="module-section">
            <h2>{section.heading}</h2>
            {content.questions.intro && <Markdown text={content.questions.intro} />}
            <p className="muted">The module counts as done once every question is graded Good or Easy.</p>
            <QuestionDrill slug={module.slug} questions={content.questions.items} />
          </section>
        );
    }
  };

  return (
    <article className="page module-page">
      <p className="eyebrow">
        Phase {phase.number} · {phase.title}
      </p>
      <h1>
        Module {module.number}: {module.title}
        {done && <span className="badge ok done-badge">Done</span>}
      </h1>
      <p className="lede">
        <InlineMarkdown text={module.topics} />
      </p>
      {content.intro && <Markdown text={content.intro} />}
      {PHASE_NOTES[phase.number] && <p className="callout">{PHASE_NOTES[phase.number]}</p>}

      <nav className="section-nav" aria-label="Module sections">
        {content.layout.map((section, index) => (
          <a key={sectionId(section, index)} href={`#${sectionId(section, index)}`}>
            {shortLabel(section)}
            {counts[section.kind] ? <span className="count">{counts[section.kind]}</span> : null}
          </a>
        ))}
        {content.answerKey.length > 0 && <a href="#answer-key">Answer key</a>}
        <div className="section-nav-options">
          <RunOptions options={options} onChange={setOptions} />
        </div>
      </nav>

      {content.layout.map(renderSection)}

      {content.answerKey.length > 0 && (
        <section id="answer-key" className="module-section">
          <h2>Answer key</h2>
          <p className="muted">Work through the problems first.</p>
          {content.answerKey.map((part, index) => (
            <details key={index} className="card answer-reveal">
              <summary>{part.heading || 'Show answers'}</summary>
              <Markdown text={part.body} />
            </details>
          ))}
        </section>
      )}

      <nav className="pager" aria-label="Modules">
        {previous ? (
          <Link to={`/modules/${previous.slug}`}>
            ← {previous.number}. {previous.title}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link to={`/modules/${next.slug}`}>
            {next.number}. {next.title} →
          </Link>
        )}
      </nav>
    </article>
  );
}
