import { describe, expect, it } from 'vitest';
import { hasMain, isTopLevelDeclaration, splitTopLevel, stripCommentsAndStrings, wrapSnippet } from './wrap.ts';

const texts = (code: string) => splitTopLevel(code).map((item) => item.text);

describe('stripCommentsAndStrings', () => {
  it('blanks comments and literals but keeps offsets', () => {
    const code = 'f("a;}") ; // x { \n char c = \'}\'; int n = 1\'000;';
    const stripped = stripCommentsAndStrings(code);
    expect(stripped).toHaveLength(code.length);
    expect(stripped).not.toContain('}');
    expect(stripped).toContain("1'000");
  });
});

describe('splitTopLevel', () => {
  it('splits statements and keeps if/else and do/while together', () => {
    expect(texts('int x = 1;\nif (x) { x++; } else { x--; }\ndo { x++; } while (x < 3);\ncout << x;')).toEqual([
      'int x = 1;',
      'if (x) { x++; } else { x--; }',
      'do { x++; } while (x < 3);',
      'cout << x;',
    ]);
  });

  it('keeps struct declarators, initializers and lambdas with their statement', () => {
    expect(texts('struct S { int a; } s{};\nint arr[2] = {1, 2};\nauto f = [] { return 1; };\nstd::vector<int> v{1, 2};')).toEqual([
      'struct S { int a; } s{};',
      'int arr[2] = {1, 2};',
      'auto f = [] { return 1; };',
      'std::vector<int> v{1, 2};',
    ]);
  });

  it('ends a function definition at its closing brace', () => {
    expect(texts('int f(int x) { return x; }\nauto g() -> int { return 2; }\nf(1);')).toEqual([
      'int f(int x) { return x; }',
      'auto g() -> int { return 2; }',
      'f(1);',
    ]);
  });

  it('records the line each item starts on and treats directives as items', () => {
    const items = splitTopLevel('#include <atomic>\n\n  int a;\n// c\nint b;');
    expect(items.map((item) => [item.text, item.line])).toEqual([
      ['#include <atomic>', 1],
      ['int a;', 3],
      ['int b;', 5],
    ]);
  });
});

describe('isTopLevelDeclaration', () => {
  it.each([
    ['struct Counters { int a; };', true],
    ['template <class T> T id(T t) { return t; }', true],
    ['bool will_overflow(int x) {\n    return x + 1 < x;\n}', true],
    ['std::uint32_t mask_for(int bits) {   // called with bits == 32\n    return (1u << bits) - 1;\n}', true],
    ['Node* pop() { return nullptr; }', true],
    ['#include <iostream>', true],
    ['if (x) { y(); }', false],
    ['for (int i = 0; i < 3; ++i) { cout << i; }', false],
    ['std::atomic<int> a{5};', false],
    ['auto f = [] { return 1; };', false],
    ['cout << sizeof(Counters);', false],
  ])('%s → %s', (code, expected) => {
    expect(isTopLevelDeclaration(code)).toBe(expected);
  });
});

describe('wrapSnippet', () => {
  it('leaves whole programs alone apart from line mapping', () => {
    const program = '#include <iostream>\nint main() { std::cout << 1; }';
    expect(hasMain(program)).toBe(true);
    expect(wrapSnippet(program, 'program')).toBe(`#line 1 "main.cpp"\n${program}`);
  });

  it('hoists declarations above main and keeps statements inside it', () => {
    const wrapped = wrapSnippet('struct Counters {\n    alignas(64) long a;\n};\ncout << sizeof(Counters);', 'fragment');
    expect(wrapped).toBe(
      ['using namespace std;', '#line 1 "main.cpp"', 'struct Counters {\n    alignas(64) long a;\n};', 'int main() {', '#line 4 "main.cpp"', 'cout << sizeof(Counters);', '}', ''].join('\n'),
    );
  });

  it('does not treat main in a comment as a program', () => {
    expect(hasMain('// int main() is implied\nint x;')).toBe(false);
  });
});
