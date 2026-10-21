import { describe, expect, it } from 'vitest';
import { compileCourse, ContentError, type Reader } from './compile.ts';

const FILES: Record<string, string> = {
  'course.yaml': `title: Test course
phases:
  - title: Basics
    modules: [alpha, beta]
`,
  'modules/alpha/module.yaml': `title: Alpha
topics: Integer \`promotion\`
intro: Builds toward :mod[beta].
`,
  'modules/alpha/notes.md': `### Promotion

Text.

\`\`\`cpp
// ### not a heading inside code
int x = 1;
\`\`\`

### Conversions

See :sec[beta/arrays] and Modules :mod[alpha]{bare} and :mod[beta]{bare}.
`,
  'modules/alpha/predict.md': `Assume headers.

:::predict{#sum}
\`\`\`cpp kind=fragment run=local
cout << 1 + 1;
\`\`\`
::answer
\`2\`

Plain int arithmetic.
:::

:::predict{#faults}
How many page faults?
::answer
One per page touched.
:::
`,
  'modules/alpha/bugs.md': `:::bug{#B1}
~~~cpp run=none note="An \`excerpt\`"
void f() { g(); }
~~~
::answer
Calls an undeclared function.
:::
`,
  'modules/alpha/exercises.md': `:::exercise{#warmup level=warm-up title='extern "C"'}
Write it.
::hint
Use a lambda.
:::
`,
  'modules/alpha/interview.md': `:::question{#Q1}
Why?
::answer
Because.
:::
`,
  'modules/alpha/answers.md': `Before.

## Reference solution

Code.
`,
  'modules/beta/module.yaml': `title: Beta
topics: Arrays
numberSections: true
`,
  'modules/beta/notes.md': `### Arrays

Decay.
`,
};

const reader =
  (overrides: Record<string, string | undefined> = {}): Reader =>
  (path) =>
    path in overrides ? overrides[path] : FILES[path];

function problems(overrides: Record<string, string | undefined>): string[] {
  try {
    compileCourse(reader(overrides));
  } catch (error) {
    if (error instanceof ContentError) return error.problems;
    throw error;
  }
  return [];
}

describe('compileCourse', () => {
  const { course, modules } = compileCourse(reader());
  const alpha = modules[0]!;

  it('numbers modules by their order in course.yaml', () => {
    expect(course.phases[0]!.modules.map((m) => [m.number, m.slug, m.title])).toEqual([
      [1, 'alpha', 'Alpha'],
      [2, 'beta', 'Beta'],
    ]);
  });

  it('numbers notes sections and resolves references to modules and sections', () => {
    expect(alpha.intro).toBe('Builds toward [Module 2](/modules/beta).');
    expect(alpha.reading?.body).toContain('### 1.1 Promotion');
    expect(alpha.reading?.body).toContain('### 1.2 Conversions');
    expect(alpha.reading?.body).toContain('// ### not a heading inside code');
    expect(alpha.reading?.body).toContain('See 2.1 and Modules [1](/modules/alpha) and [2](/modules/beta).');
  });

  it('keeps ids, derives labels from position, and splits each block at its markers', () => {
    expect(alpha.predict.intro).toBe('Assume headers.');
    expect(alpha.predict.items.map((item) => [item.id, item.label])).toEqual([
      ['sum', 'P1'],
      ['faults', 'P2'],
    ]);
    expect(alpha.predict.items[0]).toMatchObject({
      prompt: '',
      snippet: { code: 'cout << 1 + 1;', kind: 'fragment', run: 'local' },
      answer: { output: '`2`', why: 'Plain int arithmetic.' },
    });
    expect(alpha.predict.items[1]).toMatchObject({ prompt: 'How many page faults?', answer: { output: 'One per page touched.', why: '' } });
    expect(alpha.ub.items[0]).toMatchObject({ id: 'B1', label: 'U1', snippet: { run: 'none', note: 'An `excerpt`' }, answer: 'Calls an undeclared function.' });
    expect(alpha.exercises.items[0]).toMatchObject({ label: 'E1', level: 'warm-up', title: 'extern "C"', body: 'Write it.', hint: 'Use a lambda.' });
    expect(alpha.questions.items[0]).toMatchObject({ id: 'Q1', question: 'Why?', answer: 'Because.' });
    expect(alpha.answerKey).toEqual([
      { heading: '', body: 'Before.' },
      { heading: 'Reference solution', body: 'Code.' },
    ]);
  });

  it('renumbers everything when modules are reordered, without touching ids', () => {
    const swapped = compileCourse(reader({ 'course.yaml': FILES['course.yaml']!.replace('[alpha, beta]', '[beta, alpha]') }));
    const moved = swapped.modules.find((m) => m.slug === 'alpha')!;
    expect(moved.number).toBe(2);
    expect(moved.reading?.body).toContain('### 2.1 Promotion');
    expect(moved.intro).toBe('Builds toward [Module 1](/modules/beta).');
    expect(moved.predict.items[0]!.id).toBe('sum');
  });

  it('reports every problem with its file and line', () => {
    expect(
      problems({
        'modules/alpha/predict.md': `:::predict{#sum}
Missing its answer.
:::

:::predict{#sum}
x
::answer
y
::because
z
:::

Loose text.
`,
        'modules/alpha/exercises.md': `:::exercise{#e level=easy}
Body.
:::
`,
        'modules/alpha/module.yaml': 'title: Alpha\ntopics: x\nintro: See :mod[gamma].\n',
      }),
    ).toEqual([
      'modules/alpha/exercises.md:1: #e needs level=warm-up|standard|interview-hard',
      'modules/alpha/exercises.md:1: #e needs a title="…"',
      'modules/alpha/module.yaml:1: :mod[gamma] names no module in course.yaml',
      'modules/alpha/predict.md:1: #sum has no ::answer',
      'modules/alpha/predict.md:5: duplicate id #sum',
      'modules/alpha/predict.md:9: unknown marker ::because (expected ::answer)',
      'modules/alpha/predict.md:13: text after a block: move it inside a :::predict block, or before the first one',
    ]);
  });

  it('reports a module listed in course.yaml without its folder', () => {
    expect(problems({ 'course.yaml': FILES['course.yaml']!.replace('[alpha, beta]', '[alpha, beta, gamma]') })).toEqual(['modules/gamma/module.yaml: missing']);
  });
});
