// Learner progress, kept in this browser only (localStorage), with JSON export/import.
import { useSyncExternalStore } from 'react';
import { DEFAULT_OPTIONS, type CompileOptions } from '../compiler/flags.ts';

export type Grade = 'again' | 'good' | 'easy';

export interface Attempt {
  /** What the learner committed to before seeing the answer. */
  answer: string;
  at: number;
}

export interface ExerciseState {
  code?: string;
  done?: boolean;
}

export interface QuestionState {
  grade: Grade;
  at: number;
  /** Days until the next review. */
  interval: number;
  /** Epoch ms when the question is due again. */
  due: number;
}

export interface ModuleProgress {
  /** Set by the module page from the done rule, so the sidebar can show it without loading content. */
  done?: boolean;
  predictions: Record<string, Attempt>;
  ub: Record<string, Attempt>;
  exercises: Record<string, ExerciseState>;
  questions: Record<string, QuestionState>;
}

export interface Progress {
  version: 1;
  modules: Record<string, ModuleProgress>;
  options: CompileOptions;
}

const STORAGE_KEY = 'learn-cpp/progress';
const DAY = 24 * 60 * 60 * 1000;

export const emptyModule = (): ModuleProgress => ({ predictions: {}, ub: {}, exercises: {}, questions: {} });
const emptyProgress = (): Progress => ({ version: 1, modules: {}, options: DEFAULT_OPTIONS });

/** Accepts only a well-formed v1 document; anything else is rejected rather than half-loaded. */
export function parseProgress(text: string): Progress {
  const value = JSON.parse(text) as Partial<Progress>;
  if (value?.version !== 1 || typeof value.modules !== 'object' || value.modules === null) {
    throw new Error('This is not a learn-cpp progress file.');
  }
  const modules: Record<string, ModuleProgress> = {};
  for (const [slug, module] of Object.entries(value.modules)) modules[slug] = { ...emptyModule(), ...module };
  return { version: 1, modules, options: { ...DEFAULT_OPTIONS, ...value.options } };
}

function load(): Progress {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return text ? parseProgress(text) : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

let state: Progress = load();
const listeners = new Set<() => void>();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be full or blocked (private mode); progress then lasts for this tab only.
  }
}

function update(recipe: (draft: Progress) => Progress) {
  state = recipe(state);
  save();
  for (const listener of listeners) listener();
}

function updateModule(slug: string, recipe: (module: ModuleProgress) => ModuleProgress) {
  update((current) => ({ ...current, modules: { ...current.modules, [slug]: recipe(current.modules[slug] ?? emptyModule()) } }));
}

// Another tab saved progress: pick it up.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    state = load();
    for (const listener of listeners) listener();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, () => state);
}

export function useModuleProgress(slug: string): ModuleProgress {
  const progress = useProgress();
  return progress.modules[slug] ?? EMPTY_MODULE;
}

const EMPTY_MODULE = emptyModule();

/** Next interval in days: `again` restarts, `good` roughly doubles, `easy` roughly triples. */
export function nextInterval(previous: number | undefined, grade: Grade): number {
  if (grade === 'again') return 0;
  const base = previous && previous > 0 ? previous : 0;
  if (grade === 'good') return Math.max(1, Math.round(base * 2));
  return Math.max(3, Math.round(base * 3));
}

export const actions = {
  setOptions(options: CompileOptions) {
    update((current) => ({ ...current, options }));
  },
  commitPrediction(slug: string, id: string, answer: string) {
    updateModule(slug, (module) => ({ ...module, predictions: { ...module.predictions, [id]: { answer, at: Date.now() } } }));
  },
  commitUb(slug: string, id: string, answer: string) {
    updateModule(slug, (module) => ({ ...module, ub: { ...module.ub, [id]: { answer, at: Date.now() } } }));
  },
  saveExercise(slug: string, id: string, patch: ExerciseState) {
    updateModule(slug, (module) => ({ ...module, exercises: { ...module.exercises, [id]: { ...module.exercises[id], ...patch } } }));
  },
  gradeQuestion(slug: string, id: string, grade: Grade, now = Date.now()) {
    updateModule(slug, (module) => {
      const interval = nextInterval(module.questions[id]?.interval, grade);
      // "Again" comes back after 10 minutes, so it shows up in the same study session.
      const due = now + (interval === 0 ? 10 * 60 * 1000 : interval * DAY);
      return { ...module, questions: { ...module.questions, [id]: { grade, at: now, interval, due } } };
    });
  },
  setDone(slug: string, done: boolean) {
    updateModule(slug, (module) => ({ ...module, done }));
  },
  resetAll() {
    update((current) => ({ ...emptyProgress(), options: current.options }));
  },
  resetModule(slug: string) {
    update((current) => {
      const modules = { ...current.modules };
      delete modules[slug];
      return { ...current, modules };
    });
  },
  exportJson(): string {
    return JSON.stringify(state, null, 2);
  },
  importJson(text: string) {
    const imported = parseProgress(text);
    update(() => imported);
  },
};

/** A module is done once every interview question's latest grade is good or easy (the course's rule). */
/** Questions due for review now, across all modules. */
export function dueQuestions(progress: Progress, now: number): { slug: string; id: string; due: number }[] {
  return Object.entries(progress.modules).flatMap(([slug, module]) =>
    Object.entries(module.questions)
      .filter(([, state]) => state.due <= now)
      .map(([id, state]) => ({ slug, id, due: state.due })),
  );
}

export function isModuleDone(module: ModuleProgress | undefined, questionIds: string[]): boolean {
  if (!module || questionIds.length === 0) return false;
  return questionIds.every((id) => {
    const grade = module.questions[id]?.grade;
    return grade === 'good' || grade === 'easy';
  });
}
