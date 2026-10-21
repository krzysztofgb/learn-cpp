import { describe, expect, it } from 'vitest';
import { emptyModule, isModuleDone, nextInterval, parseProgress } from './store.ts';

describe('parseProgress', () => {
  it('fills in missing parts of a v1 document', () => {
    const progress = parseProgress(JSON.stringify({ version: 1, modules: { a: { predictions: { P1: { answer: '0', at: 1 } } } } }));
    expect(progress.modules.a).toEqual({ ...emptyModule(), predictions: { P1: { answer: '0', at: 1 } } });
    expect(progress.options).toEqual({ profile: 'debug', std: 'c++23', werror: false });
  });

  it('moves v1 modules to slugs without their number', () => {
    const progress = parseProgress(JSON.stringify({ version: 1, modules: { '19-lock-free-programming': { done: true } } }));
    expect(progress.version).toBe(2);
    expect(Object.keys(progress.modules)).toEqual(['lock-free-programming']);
    expect(parseProgress(JSON.stringify(progress)).modules['lock-free-programming']?.done).toBe(true);
  });

  it('rejects anything that is not a progress file', () => {
    expect(() => parseProgress('{"version":3,"modules":{}}')).toThrow(/not a learn-cpp progress file/);
    expect(() => parseProgress('[]')).toThrow();
    expect(() => parseProgress('not json')).toThrow();
  });
});

describe('nextInterval', () => {
  it('restarts on again, grows on good and faster on easy', () => {
    expect(nextInterval(8, 'again')).toBe(0);
    expect(nextInterval(undefined, 'good')).toBe(1);
    expect(nextInterval(4, 'good')).toBe(8);
    expect(nextInterval(undefined, 'easy')).toBe(3);
    expect(nextInterval(4, 'easy')).toBe(12);
  });
});

describe('isModuleDone', () => {
  const graded = (grades: Record<string, 'again' | 'good' | 'easy'>) => ({
    ...emptyModule(),
    questions: Object.fromEntries(Object.entries(grades).map(([id, grade]) => [id, { grade, at: 0, interval: 1, due: 0 }])),
  });

  it('requires every question graded good or easy', () => {
    expect(isModuleDone(graded({ Q1: 'good', Q2: 'easy' }), ['Q1', 'Q2'])).toBe(true);
    expect(isModuleDone(graded({ Q1: 'good', Q2: 'again' }), ['Q1', 'Q2'])).toBe(false);
    expect(isModuleDone(graded({ Q1: 'good' }), ['Q1', 'Q2'])).toBe(false);
  });

  it('is never done without questions or progress', () => {
    expect(isModuleDone(undefined, ['Q1'])).toBe(false);
    expect(isModuleDone(graded({}), [])).toBe(false);
  });
});
