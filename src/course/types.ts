// The course as the app receives it: compiled at build time from content/ (see content/README.md and
// scripts/content/compile.ts) into one JSON chunk per module plus a small index. Every Markdown string
// here is ready to render: cross-references are resolved and notes sections are numbered.
import type { SnippetKind } from '../compiler/wrap.ts';

/** How a code block can be run: in the browser, only in Compiler Explorer, or not at all (an excerpt). */
export type RunMode = 'local' | 'godbolt' | 'none';

export interface Snippet {
  code: string;
  lang: string;
  kind: SnippetKind;
  run: RunMode;
  /** Why the block can't run in the browser, or what differs there; shown next to it. */
  note?: string;
  /** Clang and GCC disagree on it, so Compiler Explorer runs both. */
  compareGcc?: true;
}

export interface ModuleInfo {
  /** Position in the course, from course.yaml order. */
  number: number;
  slug: string;
  title: string;
  /** Markdown, one line. */
  topics: string;
}

export interface Phase {
  number: number;
  title: string;
  modules: ModuleInfo[];
}

export interface Course {
  title: string;
  phases: Phase[];
}

export interface Section<T> {
  /** Markdown before the first item. */
  intro: string;
  items: T[];
}

/**
 * Every item has a stable `id` (saved progress is keyed by it; it never changes when items move)
 * and a `label` from its position ("P1", "U3"), which is what the learner sees.
 */
interface Item {
  id: string;
  label: string;
}

/** One option of a multiple-choice prediction; `text` is inline Markdown. */
export interface Choice {
  text: string;
  correct: boolean;
}

/**
 * What a prediction's answer is, for grading: an exact output, one of the non-printing outcomes, or a multiple choice
 * (radio buttons when one option is correct, checkboxes when several are).
 */
export type Expectation =
  | { kind: 'prints'; output: string }
  | { kind: 'ub' | 'compile-error' | 'unspecified' }
  | { kind: 'choice'; options: Choice[] };

/** The findings a spot-the-bug answer can name; the form's checkboxes are these. */
export type Finding = 'ub' | 'unspecified' | 'compile-error' | 'defined-bug' | 'none';

export interface PredictItem extends Item {
  /** Markdown before the code (the whole question, when there's no code). */
  prompt: string;
  snippet?: Snippet;
  /** Markdown after the code. */
  after: string;
  /** `output`: the answer's first block (what prints); `why`: the rest. */
  answer: { output: string; why: string };
  expect: Expectation;
}

export interface UbItem extends Item {
  prompt: string;
  snippet?: Snippet;
  after: string;
  answer: string;
  /** The boxes a fully correct answer ticks. */
  findings: Finding[];
}

export type Level = 'warm-up' | 'standard' | 'interview-hard';

export interface Exercise extends Item {
  level: Level;
  title: string;
  /** Markdown, including any code blocks. */
  body: string;
  hint?: string;
}

export interface Question extends Item {
  question: string;
  answer: string;
}

export interface ModuleContent extends ModuleInfo {
  /** Markdown shown above the tabs. */
  intro: string;
  /** The reading tab: "Notes", or "Guide" for modules that are all practice. */
  reading?: { label: string; body: string };
  predict: Section<PredictItem>;
  ub: Section<UbItem>;
  exercises: Section<Exercise>;
  questions: Section<Question>;
  /** Reference material shown on request (model answers, reference solutions), one part per `##` of answers.md. */
  answerKey: { heading: string; body: string }[];
}
