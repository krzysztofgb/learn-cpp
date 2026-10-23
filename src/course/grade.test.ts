import { describe, expect, it } from 'vitest';
import { compareOutput, gradeFindings, gradePrediction, normalizeOutput } from './grade.ts';
import type { Expectation } from './types.ts';

describe('gradePrediction', () => {
  const prints: Expectation = { kind: 'prints', output: '0 5 5' };

  it('needs the right outcome and the exact output, apart from whitespace', () => {
    expect(gradePrediction(prints, { outcome: 'prints', output: ' 0  5\n5 ' })).toBe('correct');
    expect(gradePrediction(prints, { outcome: 'prints', output: '0 5 6' })).toBe('partly');
    expect(gradePrediction(prints, { outcome: 'ub' })).toBe('wrong');
  });

  it('grades non-printing outcomes by the outcome alone', () => {
    expect(gradePrediction({ kind: 'ub' }, { outcome: 'ub' })).toBe('correct');
    expect(gradePrediction({ kind: 'compile-error' }, { outcome: 'prints', output: '1' })).toBe('wrong');
  });

  it('grades multiple choice as a set: all right, some right, or none', () => {
    const one: Expectation = { kind: 'choice', options: [{ text: 'a', correct: false }, { text: 'b', correct: true }] };
    expect(gradePrediction(one, { choices: [1] })).toBe('correct');
    expect(gradePrediction(one, { choices: [0] })).toBe('wrong');
    const two: Expectation = { kind: 'choice', options: [{ text: 'a', correct: true }, { text: 'b', correct: true }, { text: 'c', correct: false }] };
    expect(gradePrediction(two, { choices: [0] })).toBe('partly');
    expect(gradePrediction(two, { choices: [0, 1, 2] })).toBe('partly');
    expect(gradePrediction(two, { choices: [1, 0] })).toBe('correct');
  });
});

describe('gradeFindings', () => {
  it('is correct for the same findings, partly right for an overlap', () => {
    expect(gradeFindings(['ub'], ['ub'])).toBe('correct');
    expect(gradeFindings(['ub'], ['ub', 'defined-bug'])).toBe('partly');
    expect(gradeFindings(['ub', 'unspecified'], ['ub'])).toBe('partly');
    expect(gradeFindings(['ub'], ['defined-bug'])).toBe('wrong');
  });
});

describe('compareOutput', () => {
  it('marks the tokens that differ from the expected output at the same position', () => {
    expect(compareOutput('0 5 6', '0 5 5')).toEqual([
      { token: '0', differs: false },
      { token: '5', differs: false },
      { token: '6', differs: true },
    ]);
    expect(compareOutput('0  5\n5 7', '0 5 5').map((t) => t.differs)).toEqual([false, false, false, true]);
    expect(compareOutput('', '1')).toEqual([]);
  });
});

describe('normalizeOutput', () => {
  it('collapses whitespace runs and trims', () => {
    expect(normalizeOutput('\t1  2\n3 ')).toBe('1 2 3');
  });
});
