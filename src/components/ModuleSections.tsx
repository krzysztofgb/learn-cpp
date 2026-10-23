import { Check, CircleDot, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { gradeFindings, gradePrediction, type PredictionAnswer, type Verdict } from '../course/grade.ts';
import type { Choice, Exercise, Level, PredictItem, Question, UbItem } from '../course/types.ts';
import { useCompileOptions } from '../hooks/useCompileOptions.ts';
import { useRunner } from '../hooks/useRunner.ts';
import { actions, useModuleProgress, type Grade } from '../progress/store.ts';
import { FINDING_LABELS } from '../course/labels.ts';
import { ChoiceForm, FindingsForm, PredictForm } from './AnswerForms.tsx';
import { CodeBlock } from './CodeBlock.tsx';
import { LazyCodeEditor as CodeEditor } from './LazyCodeEditor.tsx';
import { InlineMarkdown, Markdown } from './Markdown.tsx';
import { RunPanel } from './RunPanel.tsx';
import { Button } from './arc/button/button.tsx';
import { Badge } from './arc/badge/badge.tsx';
import { Checkbox } from './arc/checkbox/checkbox.tsx';
import { CodeSettings } from './CodeSettings.tsx';

/**
 * "Try again" forgets the committed answer; the form comes back with every option and takes focus,
 * so a keyboard user isn't left on a button that no longer exists.
 */
function useRetry(slug: string, part: 'predictions' | 'ub', id: string) {
  const card = useRef<HTMLElement>(null);
  const focusForm = useRef(false);
  // After the render that brings the form back.
  useEffect(() => {
    if (!focusForm.current) return;
    focusForm.current = false;
    card.current?.querySelector<HTMLElement>('.commit-form :is(input, button, textarea, [role="radio"], [role="checkbox"])')?.focus();
  });
  const retry = () => {
    focusForm.current = true;
    actions.retry(slug, part, id);
  };
  return { card, retry };
}

const VERDICTS: Record<Verdict, { label: string; tone: 'success' | 'warning' | 'danger'; Icon: typeof Check }> = {
  correct: { label: 'Correct', tone: 'success', Icon: Check },
  partly: { label: 'Partly right', tone: 'warning', Icon: CircleDot },
  wrong: { label: 'Not quite', tone: 'danger', Icon: X },
};

/** Icon and words, so the result never depends on colour alone. */
function VerdictLine({ verdict }: { verdict: Verdict }) {
  const { label, Icon } = VERDICTS[verdict];
  return (
    <p className="verdict">
      <Icon size={16} strokeWidth={2} aria-hidden="true" />
      {label}
    </p>
  );
}

function CardStatus({ verdict, answered }: { verdict: Verdict | undefined; answered: boolean }) {
  if (verdict) return <Badge size="sm" tone={VERDICTS[verdict].tone}>{VERDICTS[verdict].label}</Badge>;
  return answered ? <Badge size="sm">Answered</Badge> : null;
}

/** After a right answer, answering again is optional; after anything else, it's the next step. */
function AnswerAgain({ verdict, onClick }: { verdict: Verdict | undefined; onClick: () => void }) {
  return (
    <div className="answer-actions">
      <Button size="sm" variant={verdict === 'correct' ? 'ghost' : 'secondary'} onClick={onClick}>
        {verdict === 'correct' ? 'Answer again' : 'Try again'}
      </Button>
    </div>
  );
}

/** The options of a multiple-choice prediction, marking the right ones and the learner's picks. */
function ChoiceKey({ options, picked }: { options: Choice[]; picked: number[] }) {
  return (
    <ul className="choice-key">
      {options.map((option, i) => {
        const chose = picked.includes(i);
        const state = option.correct ? 'right' : chose ? 'wrong-pick' : 'other';
        return (
          <li key={i} data-state={state}>
            {option.correct ? <Check size={14} strokeWidth={2.25} aria-hidden="true" /> : chose ? <X size={14} strokeWidth={2.25} aria-hidden="true" /> : <span className="choice-key-blank" />}
            <span>
              <InlineMarkdown text={option.text} />
              {option.correct && <span className="sr-only"> (correct)</span>}
              {chose && <span className="choice-key-yours">your answer</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function PredictCard({ slug, item }: { slug: string; item: PredictItem }) {
  const attempt = useModuleProgress(slug).predictions[item.id];
  const commit = (answer: string, prediction: PredictionAnswer) => actions.commitPrediction(slug, item.id, answer, prediction);
  const { card, retry } = useRetry(slug, 'predictions', item.id);
  const verdict = attempt?.prediction ? gradePrediction(item.expect, attempt.prediction) : undefined;
  const expect = item.expect;
  return (
    <article className="card" id={`predict-${item.id}`} ref={card}>
      <header className="card-header">
        <h3>{item.label}</h3>
        <CardStatus verdict={verdict} answered={attempt !== undefined} />
      </header>
      {item.prompt && <Markdown text={item.prompt} />}
      {item.snippet && <CodeBlock snippet={item.snippet} locked={!attempt} label={`${item.label} code`} />}
      {item.after && <Markdown text={item.after} />}
      {attempt ? (
        <div className="answer" data-verdict={verdict}>
          {verdict && <VerdictLine verdict={verdict} />}
          {expect.kind === 'choice' ? (
            <>
              <ChoiceKey options={expect.options} picked={attempt.prediction?.choices ?? []} />
              <Markdown text={[item.answer.output, item.answer.why].filter(Boolean).join('\n\n')} />
            </>
          ) : (
            <>
              <p className="your-answer">
                You said: <span>{attempt.answer}</span>
              </p>
              <p className="answer-output">
                <strong>Answer:</strong> <InlineMarkdown text={item.answer.output} />
              </p>
              {item.answer.why && <Markdown text={item.answer.why} />}
            </>
          )}
          <AnswerAgain verdict={verdict} onClick={retry} />
        </div>
      ) : expect.kind === 'choice' ? (
        <ChoiceForm options={expect.options} onCommit={commit} />
      ) : (
        <PredictForm onCommit={commit} />
      )}
    </article>
  );
}

export function UbCard({ slug, item }: { slug: string; item: UbItem }) {
  const attempt = useModuleProgress(slug).ub[item.id];
  const { card, retry } = useRetry(slug, 'ub', item.id);
  const verdict = attempt?.findings ? gradeFindings(item.findings, attempt.findings) : undefined;
  return (
    <article className="card" id={`ub-${item.id}`} ref={card}>
      <header className="card-header">
        <h3>{item.label}</h3>
        <CardStatus verdict={verdict} answered={attempt !== undefined} />
      </header>
      {item.prompt && <Markdown text={item.prompt} />}
      {item.snippet && <CodeBlock snippet={item.snippet} locked={!attempt} label={`${item.label} code`} />}
      {item.after && <Markdown text={item.after} />}
      {attempt ? (
        <div className="answer" data-verdict={verdict}>
          {verdict && <VerdictLine verdict={verdict} />}
          <p className="your-answer">
            You said: <span>{attempt.answer}</span>
          </p>
          <p className="answer-output">
            <strong>Answer:</strong> {item.findings.map((finding) => FINDING_LABELS[finding]).join('; ')}
          </p>
          <Markdown text={item.answer} />
          <AnswerAgain verdict={verdict} onClick={retry} />
        </div>
      ) : (
        <FindingsForm onCommit={(answer, findings) => actions.commitUb(slug, item.id, answer, findings)} />
      )}
    </article>
  );
}

/** Exercise levels as the learner reads them. */
const DIFFICULTY: Record<Level, string> = { 'warm-up': 'Warm-up', standard: 'Standard', 'interview-hard': 'Interview-hard' };

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
          {item.label} {item.title}
        </h3>
        <Badge size="sm">{DIFFICULTY[item.level]}</Badge>
        <Checkbox className="done-toggle" label="Done" checked={saved?.done ?? false} onCheckedChange={(checked) => actions.saveExercise(slug, item.id, { done: checked === true })} />
      </header>
      <Markdown text={item.body} />
      <details className="solution">
        <summary>Your solution</summary>
        <div className="editor-block">
          <CodeEditor value={code} onChange={setCode} onRun={run} label={`${item.label} solution`} />
          <div className="editor-toolbar">
            <span className="muted small-text">Saved in this browser · 15 s time limit</span>
            <span className="toolbar-end">
              <CodeSettings />
              <Button size="sm" onClick={run} loading={runner.running}>
                Run
              </Button>
            </span>
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

/** `headingLevel` follows the page: h3 under a module's tab heading, h2 directly under Review's h1. */
export function Flashcard({ question, position, onGrade, headingLevel = 3 }: { question: Question; position: string; onGrade: (grade: Grade) => void; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const [revealed, setRevealed] = useState(false);
  const elapsed = useElapsedSeconds(!revealed);
  const minutes = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  return (
    <article className="card flashcard">
      <header className="card-header">
        <Heading>{position}</Heading>
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
              <Button key={grade} size="sm" variant="secondary" onClick={() => onGrade(grade)} title={hint}>
                {label}
              </Button>
            ))}
          </div>
        </>
      ) : (
        <div className="grade-row">
          <span className="muted small-text">Answer out loud in 60–90 seconds, then check.</span>
          <Button size="sm" onClick={() => setRevealed(true)}>
            Reveal answer
          </Button>
        </div>
      )}
    </article>
  );
}
