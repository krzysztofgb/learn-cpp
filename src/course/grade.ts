// Grading: what the learner committed against what the content expects. Pure, shared by the app and check:content.
import type { Expectation, Finding } from './types.ts';

/** Outputs match when they're the same apart from runs of whitespace and leading/trailing space. */
export function normalizeOutput(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export type Verdict = 'correct' | 'partly' | 'wrong';

/** The outcome a "predict" form records: what happens, and the output when it prints. */
export type Outcome = 'prints' | 'ub' | 'compile-error' | 'unspecified';

export interface PredictionAnswer {
  outcome?: Outcome;
  output?: string;
  /** Indexes of the chosen options, for multiple choice. */
  choices?: number[];
}

/** Exact output (or the right outcome) is correct; the right outcome with a different output is partly right. */
export function gradePrediction(expect: Expectation, answer: PredictionAnswer): Verdict {
  switch (expect.kind) {
    case 'prints':
      if (answer.outcome !== 'prints') return 'wrong';
      return normalizeOutput(answer.output ?? '') === normalizeOutput(expect.output) ? 'correct' : 'partly';
    case 'ub':
    case 'compile-error':
    case 'unspecified':
      return answer.outcome === expect.kind ? 'correct' : 'wrong';
    case 'choice':
      return gradeSet(new Set(expect.options.flatMap((option, i) => (option.correct ? [i] : []))), new Set(answer.choices ?? []));
  }
}

/** The same findings are correct; some in common is partly right. */
export function gradeFindings(expected: Finding[], chosen: Finding[]): Verdict {
  return gradeSet(new Set(expected), new Set(chosen));
}

function gradeSet<T>(expected: Set<T>, chosen: Set<T>): Verdict {
  const hits = [...chosen].filter((x) => expected.has(x)).length;
  if (hits === expected.size && chosen.size === expected.size) return 'correct';
  return hits > 0 ? 'partly' : 'wrong';
}
