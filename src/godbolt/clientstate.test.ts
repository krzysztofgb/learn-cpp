import { describe, expect, it } from 'vitest';
import { godboltUrl, standaloneSource } from './clientstate.ts';

function decode(url: string) {
  const encoded = decodeURIComponent(url.split('/clientstate/')[1]!);
  const binary = atob(encoded);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
}

const debug = { profile: 'debug', std: 'c++23' } as const;

describe('godboltUrl', () => {
  it('round-trips a fragment into one Clang pane that runs it with the learner\'s settings', () => {
    const url = godboltUrl('cout << "π";', 'fragment', { options: debug });
    expect(url.startsWith('https://godbolt.org/clientstate/')).toBe(true);
    const session = decode(url).sessions[0];
    expect(session.source).toBe('#include <bits/stdc++.h>\nusing namespace std;\nint main() {\ncout << "π";\n}\n');
    expect(session.compilers).toHaveLength(1);
    expect(session.compilers[0]).toMatchObject({ id: 'clang_trunk', specialoutputs: ['compilerOutput'], filters: { execute: true } });
    expect(session.compilers[0].options).toBe('-std=c++23 -O0 -g -Wall -Wextra -fsanitize=address,undefined -fno-omit-frame-pointer');
    expect(session.executors).toEqual([]);
  });

  it('follows Release and the C++ standard', () => {
    const session = decode(godboltUrl('int x;', 'fragment', { options: { profile: 'release', std: 'c++2c' } })).sessions[0];
    expect(session.compilers[0].options).toBe('-std=c++2c -O2 -Wall -Wextra');
  });

  it('adds a GCC run only when asked', () => {
    const session = decode(godboltUrl('int x;', 'fragment', { options: debug, gcc: true })).sessions[0];
    expect(session.executors.map((e: { compiler: { id: string; options: string } }) => e.compiler)).toEqual([
      expect.objectContaining({ id: 'gsnapshot', options: session.compilers[0].options }),
    ]);
  });

  it('uses ThreadSanitizer for threaded code and keeps programs verbatim', () => {
    const program = '#include <thread>\nint main() { std::jthread t([] {}); }';
    const session = decode(godboltUrl(program, 'program', { options: debug, sanitizers: 'threads' })).sessions[0];
    expect(session.source).toBe(program);
    expect(session.compilers[0].options).toContain('-fsanitize=thread');
  });

  it('omits #line directives for Compiler Explorer', () => {
    expect(standaloneSource('struct S {};\nS s;', 'fragment')).not.toContain('#line');
  });
});
