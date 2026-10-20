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
}

export interface Section<T> {
  intro: string;
  items: T[];
}

export interface PredictItem {
  id: string;
  /** Markdown before the code (the question, when there's no code). */
  prompt: string;
  snippet?: Snippet;
  /** Markdown after the code, if any. */
  after: string;
  answer: { output: string; why: string };
}

export interface UbItem {
  id: string;
  prompt: string;
  snippet?: Snippet;
  after: string;
  answer: string;
}

export interface Exercise {
  id: string;
  stars: number;
  title: string;
  /** Markdown, including any code blocks. */
  body: string;
  hint?: string;
}

export interface Question {
  id: string;
  question: string;
  answer: string;
}

export type SectionKind = 'notes' | 'predict' | 'ub' | 'exercises' | 'questions' | 'extra';

/** A module's `##` sections in document order; `extra` sections (e.g. "How to practice") are plain Markdown. */
export interface LayoutSection {
  kind: SectionKind;
  heading: string;
  /** Markdown body, for `notes` and `extra` sections. */
  body?: string;
}

export interface ModuleContent {
  title: string;
  intro: string;
  layout: LayoutSection[];
  notes: string;
  predict: Section<PredictItem>;
  ub: Section<UbItem>;
  exercises: Section<Exercise>;
  questions: Section<Question>;
  /** Answer-key subsections not tied to a part above (reference solutions, model outlines…), shown on request. */
  answerKey: { heading: string; body: string }[];
}
