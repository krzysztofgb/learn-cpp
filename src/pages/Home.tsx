import { Suspense, use, useState } from 'react';
import { Link } from 'react-router';
import { Progress } from '../components/arc/progress/progress.tsx';
import { Markdown } from '../components/Markdown.tsx';
import { allModules, course, type ModuleInfo } from '../course/course.ts';
import { loadModule, loadOverview } from '../course/content.ts';
import { dueQuestions, useProgress, type ModuleProgress, type Progress as Learner } from '../progress/store.ts';
import { PageTitle } from '../components/PageTitle.tsx';

type State = 'done' | 'started' | 'new';

const stateOf = (progress: Learner, slug: string): State => (progress.modules[slug]?.done ? 'done' : progress.modules[slug] ? 'started' : 'new');

/** The first module that isn't done, in course order. */
function nextModule(progress: Learner): ModuleInfo | undefined {
  return allModules.find((module) => !progress.modules[module.slug]?.done);
}

/** What is left in a module, from its content and the learner's answers, as "Predict: 3 of 5 left". */
function NextStep({ module, state }: { module: ModuleInfo; state: ModuleProgress | undefined }) {
  const content = use(loadModule(module.slug));
  if (!content) return null;
  const parts: [string, string, number, number][] = [
    ['predict', 'Predict', content.predict.items.filter((item) => state?.predictions[item.id]).length, content.predict.items.length],
    ['ub', 'Spot the bug', content.ub.items.filter((item) => state?.ub[item.id]).length, content.ub.items.length],
    ['exercises', 'Exercises', content.exercises.items.filter((item) => state?.exercises[item.id]?.done).length, content.exercises.items.length],
    ['interview', 'Interview', content.questions.items.filter((q) => ['good', 'easy'].includes(state?.questions[q.id]?.grade ?? '')).length, content.questions.items.length],
  ];
  const open = parts.find(([, , done, total]) => total > 0 && done < total);
  if (!state || !open) return <p className="panel-note">Start with the notes, then work through each part.</p>;
  const [hash, label, done, total] = open;
  return (
    <p className="panel-note">
      <Link to={`/modules/${module.slug}#${hash}`}>{label}</Link>: {total - done} of {total} left
    </p>
  );
}

function ContinuePanel({ progress }: { progress: Learner }) {
  const next = nextModule(progress);
  if (!next) {
    return (
      <section className="panel continue">
        <h2>Course complete</h2>
        <p className="panel-note">Every module is done. Keep the questions fresh in Review.</p>
      </section>
    );
  }
  const started = Boolean(progress.modules[next.slug]);
  return (
    <section className="panel continue">
      <h2>{started ? 'Continue' : 'Start here'}</h2>
      <p className="continue-title">
        <span className="module-number">{next.number}</span> {next.title}
      </p>
      <Suspense fallback={<p className="panel-note">&nbsp;</p>}>
        <NextStep module={next} state={progress.modules[next.slug]} />
      </Suspense>
      <Link to={`/modules/${next.slug}`} className="link-button primary">
        {started ? 'Continue' : 'Start'}
      </Link>
    </section>
  );
}

function ReviewPanel({ progress }: { progress: Learner }) {
  const [now] = useState(() => Date.now());
  const due = dueQuestions(progress, now).length;
  const upcoming = Object.values(progress.modules)
    .flatMap((module) => Object.values(module.questions).map((state) => state.due))
    .filter((time) => time > now)
    .sort((a, b) => a - b)[0];
  return (
    <section className="panel review">
      <h2>Review</h2>
      <p className="figure">
        {due} <span className="unit">{due === 1 ? 'question due' : 'questions due'}</span>
      </p>
      {due > 0 ? (
        <Link to="/review" className="link-button">
          Start review
        </Link>
      ) : (
        <p className="panel-note">
          {upcoming ? `Next on ${new Date(upcoming).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.` : 'Graded interview questions come back here.'}
        </p>
      )}
    </section>
  );
}

/** Every module as one cell, grouped by phase: where you are in the course at a glance. */
function CourseMap({ progress }: { progress: Learner }) {
  const done = allModules.filter((module) => stateOf(progress, module.slug) === 'done').length;
  const started = allModules.filter((module) => stateOf(progress, module.slug) === 'started').length;
  return (
    <section className="panel course-map">
      <header className="panel-header">
        <h2>Course</h2>
        <p className="panel-meta">{started} in progress</p>
      </header>
      <Progress value={done} max={allModules.length} label={`${done} of ${allModules.length} modules done`} />
      <ol className="map">
        {course.phases.map((phase) => (
          <li key={phase.number} className="map-row">
            <span className="map-phase">{phase.title}</span>
            <ol className="map-cells">
              {phase.modules.map((module) => {
                const state = stateOf(progress, module.slug);
                return (
                  <li key={module.slug}>
                    <Link to={`/modules/${module.slug}`} className="map-cell" data-state={state} title={`${module.number}. ${module.title}`} aria-label={`${module.number}. ${module.title}, ${state === 'new' ? 'not started' : state}`}>
                      {module.number}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>
      <ul className="map-legend" aria-hidden="true">
        <li>
          <span className="map-cell" data-state="done" /> Done
        </li>
        <li>
          <span className="map-cell" data-state="started" /> Started
        </li>
        <li>
          <span className="map-cell" data-state="new" /> Not started
        </li>
      </ul>
    </section>
  );
}

function Overview() {
  return <Markdown text={use(loadOverview())} />;
}

export function Home() {
  const progress = useProgress();
  return (
    <article className="page home">
      <PageTitle>{course.title}</PageTitle>
      <header className="title-row">
        <h1>{course.title}</h1>
        <p className="subtitle">30 modules in 8 phases. Every code sample compiles and runs here, with undefined behavior caught by a sanitizer.</p>
      </header>
      <div className="home-grid">
        <ContinuePanel progress={progress} />
        <ReviewPanel progress={progress} />
      </div>
      <CourseMap progress={progress} />
      <section className="overview">
        <Suspense fallback={null}>
          <Overview />
        </Suspense>
      </section>
    </article>
  );
}
