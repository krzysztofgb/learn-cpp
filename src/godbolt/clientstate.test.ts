import { describe, expect, it } from 'vitest';
import { godboltUrl, standaloneSource } from './clientstate.ts';

function decode(url: string) {
  const encoded = decodeURIComponent(url.split('/clientstate/')[1]!);
  const binary = atob(encoded);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
}

describe('godboltUrl', () => {
  it('round-trips a fragment into a full program with clang and GCC executors', () => {
    const url = godboltUrl('cout << "π";', 'fragment');
    expect(url.startsWith('https://godbolt.org/clientstate/')).toBe(true);
    const session = decode(url).sessions[0];
    expect(session.source).toBe('#include <bits/stdc++.h>\nusing namespace std;\nint main() {\ncout << "π";\n}\n');
    expect(session.executors.map((e: { compiler: { id: string } }) => e.compiler.id)).toEqual(['clang_trunk', 'gsnapshot']);
    expect(session.executors[0].compiler.options).toContain('-fsanitize=address,undefined');
    expect(session.compilers[0].options).toBe('-std=c++23 -O2');
  });

  it('uses ThreadSanitizer for threaded code and keeps programs verbatim', () => {
    const program = '#include <thread>\nint main() { std::jthread t([] {}); }';
    const session = decode(godboltUrl(program, 'program', 'threads')).sessions[0];
    expect(session.source).toBe(program);
    expect(session.executors[0].compiler.options).toContain('-fsanitize=thread');
  });

  it('omits #line directives for Compiler Explorer', () => {
    expect(standaloneSource('struct S {};\nS s;', 'fragment')).not.toContain('#line');
  });
});
