// How outcomes and findings read in forms and answers.
import type { Outcome } from './grade.ts';
import type { Finding } from './types.ts';

export const OUTCOME_LABELS: Record<Outcome, string> = {
  prints: 'It prints…',
  ub: 'Undefined behavior',
  'compile-error': "It doesn't compile",
  unspecified: 'Unspecified or implementation-defined',
};

export const FINDING_LABELS: Record<Finding, string> = {
  ub: 'Undefined behavior',
  unspecified: 'Unspecified or implementation-defined',
  'compile-error': "Doesn't compile",
  'defined-bug': 'A bug, but defined behavior',
  none: 'Nothing wrong',
};
