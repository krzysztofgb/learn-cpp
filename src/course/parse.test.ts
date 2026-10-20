import { describe, expect, it } from 'vitest';
import { parseFenceInfo, parseModule, snippetFromFence, tableCells } from './parse.ts';

const FIXTURE = `# Module 9: Example

Intro paragraph.

## Notes

### 9.1 Basics

Text with \`code\`.

\`\`\`cpp
// ## not a heading inside code
int x = 1;
\`\`\`

## Predict

Write your answers first.

**P1**

\`\`\`cpp kind=fragment run=local
cout << 1 + 1;
\`\`\`

**P2** (prose only) How many page faults?

## Spot the bug

**B1**

\`\`\`cpp run=none note="An excerpt"
void f() { g(); }
\`\`\`

## Exercises

**E1 ★★ Ring buffer.** Implement it.

\`\`\`cpp
template <class T> struct Ring;
\`\`\`

**E2 ★ Warm-up:** Print sizes.

## Interview questions

1. What is UB?
2. Why \`noexcept\`?

## Answer key

### Predict

| # | Answer | Why |
| --- | --- | --- |
| P1 | \`2\` | Integer arithmetic. |
| **P2** | About 262,144 | One per page; \`a \\| b\` stays one cell. |

### Spot the bug

- **B1:** Calls \`g\` before it's declared.
  Second line of the answer.

### Exercise hints

- **E1:** Use a power of two.

### Interview questions

1. Undefined behavior.
2. It enables
   move optimizations.
`;

describe('parseModule', () => {
  const module = parseModule(FIXTURE);

  it('reads the title, intro and notes, ignoring headings inside code', () => {
    expect(module.title).toBe('Module 9: Example');
    expect(module.intro).toBe('Intro paragraph.');
    expect(module.notes).toContain('// ## not a heading inside code');
    expect(module.notes.startsWith('### 9.1 Basics')).toBe(true);
  });

  it('pairs predictions with their snippets and answer-table rows', () => {
    expect(module.predict.intro).toBe('Write your answers first.');
    const [p1, p2] = module.predict.items;
    expect(p1).toMatchObject({ id: 'P1', prompt: '', answer: { output: '`2`', why: 'Integer arithmetic.' } });
    expect(p1!.snippet).toEqual({ code: 'cout << 1 + 1;', lang: 'cpp', kind: 'fragment', run: 'local' });
    expect(p2).toMatchObject({ id: 'P2', prompt: '(prose only) How many page faults?', answer: { output: 'About 262,144' } });
    expect(p2!.snippet).toBeUndefined();
    expect(p2!.answer.why).toBe('One per page; `a | b` stays one cell.');
  });

  it('reads B-labeled bug items with fence metadata and multi-line answers', () => {
    const [b1] = module.ub.items;
    expect(b1!.id).toBe('B1');
    expect(b1!.snippet).toMatchObject({ run: 'none', note: 'An excerpt' });
    expect(b1!.answer).toBe("Calls `g` before it's declared.\nSecond line of the answer.");
  });

  it('reads exercises with stars, titles, bodies and hints', () => {
    expect(module.exercises.items.map(({ id, stars, title, hint }) => ({ id, stars, title, hint }))).toEqual([
      { id: 'E1', stars: 2, title: 'Ring buffer', hint: 'Use a power of two.' },
      { id: 'E2', stars: 1, title: 'Warm-up', hint: undefined },
    ]);
    expect(module.exercises.items[0]!.body).toContain('template <class T> struct Ring;');
  });

  it('pairs interview questions with answers by position', () => {
    expect(module.questions.items).toEqual([
      { id: 'Q1', question: 'What is UB?', answer: 'Undefined behavior.' },
      { id: 'Q2', question: 'Why `noexcept`?', answer: 'It enables\nmove optimizations.' },
    ]);
  });
});

describe('parseModule on non-standard modules', () => {
  const gauntlet = parseModule(`# Module 27: Gauntlet

## How to use it

Mix rounds.

## Round 1: Predict the output

**Q1**

\`\`\`cpp
cout << 1;
\`\`\`

## Round 3: Rapid fire

1. True or false?

## Answer key

### Round 1

| # | Output | Why | Module |
| --- | --- | --- | --- |
| Q1 | \`1\` | Trivially. | 1 |

### Round 3

1. True.

### Reference solution: LRU

Code here.
`);

  it('keeps sections in document order and treats unknown ones as Markdown', () => {
    expect(gauntlet.layout.map(({ kind, heading }) => [kind, heading])).toEqual([
      ['extra', 'How to use it'],
      ['predict', 'Round 1: Predict the output'],
      ['extra', 'Round 3: Rapid fire'],
    ]);
  });

  it('pairs a "Round N" section with its answer subsection and reads Q markers', () => {
    expect(gauntlet.predict.items[0]).toMatchObject({ id: 'Q1', answer: { output: '`1`', why: 'Trivially.' } });
  });

  it('keeps unmatched answer subsections for a reveal at the end', () => {
    expect(gauntlet.answerKey.map((part) => part.heading)).toEqual(['Round 3', 'Reference solution: LRU']);
  });

  it('keeps an answer key without subsections whole', () => {
    expect(parseModule('# M\n\n## Problems\n\n1. Dice?\n\n## Answer key\n\n| # | Answer |\n| --- | --- |\n| 1 | 6 |\n').answerKey).toEqual([
      { heading: '', body: '| # | Answer |\n| --- | --- |\n| 1 | 6 |' },
    ]);
  });
});

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

  it('splits table cells honoring escaped pipes', () => {
    expect(tableCells('| P1 | `a \\| b` | why |')).toEqual(['P1', '`a | b`', 'why']);
  });
});
