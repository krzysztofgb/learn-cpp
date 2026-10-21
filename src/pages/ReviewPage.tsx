import { RotateCcw } from 'lucide-react';
import { Suspense, use, useState } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '../components/arc/empty-state/empty-state.tsx';
import { Flashcard } from '../components/ModuleSections.tsx';
import { loadAllModules } from '../course/content.ts';
import { actions, dueQuestions, useProgress } from '../progress/store.ts';
import { PageTitle } from '../components/PageTitle.tsx';

export function ReviewPage() {
  return (
    <article className="page">
      <PageTitle>Review</PageTitle>
      <header className="title-row">
        <h1>Review</h1>
        <p className="subtitle">Graded interview questions come back when they're due: sooner if you struggled, later if they were easy.</p>
      </header>
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
      const module = modules.find((m) => m.slug === slug);
      const question = module?.questions.items.find((q) => q.id === id);
      return module && question ? [{ module, question }] : [];
    });

  if (queue.length === 0) {
    const upcoming = Object.values(progress.modules)
      .flatMap((module) => Object.values(module.questions).map((state) => state.due))
      .filter((due) => due > now)
      .sort((a, b) => a - b)[0];
    return (
      <EmptyState
        icon={<RotateCcw size={20} strokeWidth={1.75} aria-hidden="true" />}
        title={reviewed > 0 ? `Reviewed ${reviewed}. Nothing else is due.` : 'Nothing is due right now'}
        description={
          upcoming
            ? `Next review: ${new Date(upcoming).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}.`
            : 'Grade interview questions in a module to schedule them here.'
        }
        action={
          <Link to="/" className="text-link">
            Pick a module
          </Link>
        }
      />
    );
  }

  const [{ module, question }] = queue as [(typeof queue)[number]];
  return (
    <>
      <p className="muted">
        {queue.length} due · from <Link to={`/modules/${module.slug}#interview`}>Module {module.number}: {module.title}</Link>
      </p>
      <Flashcard
        key={`${module.slug}:${question.id}:${reviewed}`}
        question={question}
        position={`Module ${module.number}, question ${question.label.slice(1)}`}
        onGrade={(grade) => {
          actions.gradeQuestion(module.slug, question.id, grade);
          setReviewed((count) => count + 1);
        }}
      />
    </>
  );
}
