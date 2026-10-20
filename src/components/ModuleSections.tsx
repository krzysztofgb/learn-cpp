import { useEffect, useState, type FormEvent } from 'react';
import type { Exercise, PredictItem, Question, UbItem } from '../course/types.ts';
import { useCompileOptions } from '../hooks/useCompileOptions.ts';
import { useRunner } from '../hooks/useRunner.ts';
import { actions, useModuleProgress, type Grade } from '../progress/store.ts';
import { CodeBlock } from './CodeBlock.tsx';
import { LazyCodeEditor as CodeEditor } from './LazyCodeEditor.tsx';
import { InlineMarkdown, Markdown } from './Markdown.tsx';
import { RunPanel } from './RunPanel.tsx';

const QUICK_ANSWERS = ['UB', "Doesn't compile", 'Implementation-defined', 'Unspecified'];

function CommitForm({ label, placeholder, quick, onCommit }: { label: string; placeholder: string; quick?: string[]; onCommit: (answer: string) => void }) {
  const [draft, setDraft] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (draft.trim()) onCommit(draft.trim());
  };
  return (
    <form className="commit-form" onSubmit={submit}>
      <label>
        <span className="field-label">{label}</span>
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={placeholder} rows={2} />
      </label>
      <div className="commit-row">
        {quick && (
          <div className="chips" role="group" aria-label="Quick answers">
            {quick.map((answer) => (
              <button key={answer} type="button" className="chip" onClick={() => setDraft(answer)}>
                {answer}
              </button>
            ))}
          </div>
        )}
        <button type="submit" className="button primary small" disabled={!draft.trim()}>
          Commit and reveal
        </button>
      </div>
    </form>
  );
}

export function PredictCard({ slug, item }: { slug: string; item: PredictItem }) {
  const attempt = useModuleProgress(slug).predictions[item.id];
  return (
    <article className="card" id={`predict-${item.id}`}>
      <header className="card-header">
        <h3>{item.id}</h3>
        {attempt && <span className="badge ok">Answered</span>}
      </header>
      {item.prompt && <Markdown text={item.prompt} />}
      {item.snippet && <CodeBlock snippet={item.snippet} locked={!attempt} label={`${item.id} code`} />}
      {item.after && <Markdown text={item.after} />}
      {attempt ? (
        <div className="answer">
          <p className="your-answer">
            You said: <span>{attempt.answer}</span>
          </p>
          <p className="answer-output">
            <strong>Answer:</strong> <InlineMarkdown text={item.answer.output} />
          </p>
          {item.answer.why && <Markdown text={item.answer.why} />}
        </div>
      ) : (
        <CommitForm label="What does it print?" placeholder="Exact output, or UB / doesn't compile" quick={QUICK_ANSWERS} onCommit={(answer) => actions.commitPrediction(slug, item.id, answer)} />
      )}
    </article>
  );
}

export function UbCard({ slug, item }: { slug: string; item: UbItem }) {
  const attempt = useModuleProgress(slug).ub[item.id];
  return (
    <article className="card" id={`ub-${item.id}`}>
      <header className="card-header">
        <h3>{item.id}</h3>
        {attempt && <span className="badge ok">Answered</span>}
      </header>
      {item.prompt && <Markdown text={item.prompt} />}
      {item.snippet && <CodeBlock snippet={item.snippet} locked={!attempt} label={`${item.id} code`} />}
      {item.after && <Markdown text={item.after} />}
      {attempt ? (
        <div className="answer">
          <p className="your-answer">
            You said: <span>{attempt.answer}</span>
          </p>
          <Markdown text={item.answer} />
        </div>
      ) : (
        <CommitForm label="What's wrong, which rule does it break, and how would you fix it?" placeholder="e.g. signed overflow when x == INT_MAX; check before adding" onCommit={(answer) => actions.commitUb(slug, item.id, answer)} />
      )}
    </article>
  );
}

const STARTER = '#include <print>\n\nint main() {\n    std::println("hello");\n}\n';

export function ExerciseCard({ slug, item }: { slug: string; item: Exercise }) {
  const saved = useModuleProgress(slug).exercises[item.id];
  const [code, setCode] = useState(saved?.code ?? STARTER);
  const [options] = useCompileOptions();
  const runner = useRunner();

  // Save the solution shortly after typing stops.
  useEffect(() => {
    if (code === (saved?.code ?? STARTER)) return;
    const timer = setTimeout(() => actions.saveExercise(slug, item.id, { code }), 500);
    return () => clearTimeout(timer);
  }, [code, saved?.code, slug, item.id]);

  const run = () => void runner.run(`#line 1 "main.cpp"\n${code}`, options, { timeoutMs: 15_000 });
  return (
    <article className="card" id={`exercise-${item.id}`}>
      <header className="card-header">
        <h3>
          {item.id} <span className="stars" aria-label={`${item.stars} of 3 stars`}>{'★'.repeat(item.stars)}</span> {item.title}
        </h3>
        <label className="done-toggle">
          <input type="checkbox" checked={saved?.done ?? false} onChange={(event) => actions.saveExercise(slug, item.id, { done: event.target.checked })} />
          Done
        </label>
      </header>
      <Markdown text={item.body} />
      <details className="solution">
        <summary>Your solution</summary>
        <div className="editor-block">
          <CodeEditor value={code} onChange={setCode} onRun={run} label={`${item.id} solution`} />
          <div className="editor-toolbar">
            <span className="muted small-text">Saved in this browser · 15 s time limit</span>
            <button type="button" className="button primary small" onClick={run} disabled={runner.running}>
              {runner.running ? 'Running…' : 'Run'}
            </button>
          </div>
        </div>
        <RunPanel state={runner} />
      </details>
      {item.hint && (
        <details className="hint">
          <summary>Hint</summary>
          <Markdown text={item.hint} />
        </details>
      )}
    </article>
  );
}

const GRADES: { grade: Grade; label: string; hint: string }[] = [
  { grade: 'again', label: 'Again', hint: "Couldn't answer" },
  { grade: 'good', label: 'Good', hint: 'Got it with effort' },
  { grade: 'easy', label: 'Easy', hint: 'Fluent' },
];

const TARGET_SECONDS = 90;

function useElapsedSeconds(running: boolean): number {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

export function QuestionDrill({ slug, questions }: { slug: string; questions: Question[] }) {
  const progress = useModuleProgress(slug).questions;
  const [index, setIndex] = useState(() => Math.max(0, questions.findIndex((q) => !progress[q.id])));
  // Bumped on every move, so revisiting the same question still starts a fresh card and timer.
  const [visit, setVisit] = useState(0);
  const question = questions[index];
  if (!question) return null;

  const goTo = (next: number) => {
    setIndex((next + questions.length) % questions.length);
    setVisit((value) => value + 1);
  };

  return (
    <div className="drill">
      <ol className="drill-dots" aria-label="Questions">
        {questions.map((q, i) => (
          <li key={q.id}>
            <button
              type="button"
              className={`dot ${progress[q.id]?.grade ?? 'new'}${i === index ? ' current' : ''}`}
              onClick={() => goTo(i)}
              aria-label={`Question ${i + 1}${progress[q.id] ? `, graded ${progress[q.id]!.grade}` : ''}`}
              aria-current={i === index}
            />
          </li>
        ))}
      </ol>
      <Flashcard
        key={visit}
        question={question}
        position={`Question ${index + 1} of ${questions.length}`}
        onGrade={(grade) => {
          actions.gradeQuestion(slug, question.id, grade);
          goTo(index + 1);
        }}
      />
    </div>
  );
}

export function Flashcard({ question, position, onGrade }: { question: Question; position: string; onGrade: (grade: Grade) => void }) {
  const [revealed, setRevealed] = useState(false);
  const elapsed = useElapsedSeconds(!revealed);
  const minutes = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  return (
    <article className="card flashcard">
      <header className="card-header">
        <h3>{position}</h3>
        {!revealed && (
          <span className={`timer${elapsed > TARGET_SECONDS ? ' over' : ''}`} aria-label={`${elapsed} seconds`}>
            {minutes}
          </span>
        )}
      </header>
      <Markdown text={question.question} />
      {revealed ? (
        <>
          <div className="answer">
            <Markdown text={question.answer} />
          </div>
          <div className="grade-row" role="group" aria-label="How did you do?">
            {GRADES.map(({ grade, label, hint }) => (
              <button key={grade} type="button" className={`button small grade-${grade}`} onClick={() => onGrade(grade)} title={hint}>
                {label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="grade-row">
          <span className="muted small-text">Answer out loud in 60–90 seconds, then check.</span>
          <button type="button" className="button primary small" onClick={() => setRevealed(true)}>
            Reveal answer
          </button>
        </div>
      )}
    </article>
  );
}
