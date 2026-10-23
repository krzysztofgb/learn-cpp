import { describe, expect, it } from 'vitest';
import { parseFenceInfo, snippetFromFence } from './fence.ts';

describe('fence metadata', () => {
  it('parses quoted and bare attributes', () => {
    expect(parseFenceInfo('cpp kind=program run=godbolt note="Uses std::thread"')).toEqual({
      lang: 'cpp',
      attrs: { kind: 'program', run: 'godbolt', note: 'Uses std::thread' },
    });
  });

  it('infers the kind from main() and never runs non-C++ blocks', () => {
    expect(snippetFromFence('cpp', 'int main() {}')).toMatchObject({ kind: 'program', run: 'local' });
    expect(snippetFromFence('bash', 'clang++ x.cpp').run).toBe('none');
  });

  it('marks snippets to compare with GCC', () => {
    expect(snippetFromFence('cpp compare=gcc', 'int x;').compareGcc).toBe(true);
    expect(snippetFromFence('cpp', 'int x;')).not.toHaveProperty('compareGcc');
  });
});
