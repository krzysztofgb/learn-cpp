import { Suspense, use, useState } from 'react';
import { Link } from 'react-router';
import { Flashcard } from '../components/ModuleSections.tsx';
import { loadAllModules } from '../course/content.ts';
import { actions, dueQuestions, useProgress } from '../progress/store.ts';

export function ReviewPage() {
  return (
    <article className="page">
      <h1>Review</h1>
      <p className="lede">Interview questions you've graded come back here when they're due: sooner if you struggled, later if they were easy.</p>
      <Suspense fallback={<p className="muted">Loading questions…</p>}>
        <Review />
      </Suspense>
    </article>
  );
}

function Review() {
  const modules = use(loadAllModules());
  const progress = useProgress();
  // A fixed "now" for this session: a graded card moves into the future and leaves the queue.
  const [now] = useState(() => Date.now());
  const [reviewed, setReviewed] = useState(0);

  const queue = dueQuestions(progress, now)
    .sort((a, b) => a.due - b.due)
    .flatMap(({ slug, id }) => {
      const module = modules.find((m) => m.info.slug === slug);
      const question = module?.content.questions.items.find((q) => q.id === id);
      return module && question ? [{ module, question }] : [];
    });

  if (queue.length === 0) {
    const upcoming = Object.values(progress.modules)
      .flatMap((module) => Object.values(module.questions).map((state) => state.due))
      .filter((due) => due > now)
      .sort((a, b) => a - b)[0];
    return (
      <div className="card">
        <p>
          <strong>{reviewed > 0 ? `Reviewed ${reviewed}. ` : ''}Nothing is due right now.</strong>
        </p>
        <p className="muted">
          {upcoming
            ? `Next review: ${new Date(upcoming).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}.`
            : 'Grade interview questions in a module to schedule them here.'}{' '}
          <Link to="/">Pick a module</Link>.
        </p>
      </div>
    );
  }

  const [{ module, question }] = queue as [(typeof queue)[number]];
  return (
    <>
      <p className="muted">
        {queue.length} due · from <Link to={`/modules/${module.info.slug}#interview`}>Module {module.info.number}: {module.info.title}</Link>
      </p>
      <Flashcard
        key={`${module.info.slug}:${question.id}:${reviewed}`}
        question={question}
        position={`Module ${module.info.number}, question ${question.id.slice(1)}`}
        onGrade={(grade) => {
          actions.gradeQuestion(module.info.slug, question.id, grade);
          setReviewed((count) => count + 1);
        }}
      />
    </>
  );
}
