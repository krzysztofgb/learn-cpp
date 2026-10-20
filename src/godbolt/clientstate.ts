// Builds Compiler Explorer links that open a snippet with clang and GCC executors and an x86-64 asm pane.
// Compiler Explorer accepts a base64-encoded ClientState document at /clientstate/<base64>.
import { wrapSnippet, type SnippetKind } from '../compiler/wrap.ts';

export const GODBOLT_ORIGIN = 'https://godbolt.org';

/** `threads` uses ThreadSanitizer, which can't be combined with AddressSanitizer. */
export type SanitizerSet = 'memory' | 'threads';

const CLANG = 'clang_trunk';
const GCC = 'gsnapshot';

const RUN_FLAGS: Record<SanitizerSet, string> = {
  memory: '-std=c++23 -O0 -g -Wall -Wextra -fsanitize=address,undefined -fno-omit-frame-pointer',
  threads: '-std=c++23 -O1 -g -Wall -Wextra -fsanitize=thread -pthread',
};
const ASM_FLAGS = '-std=c++23 -O2';

/** A complete program for Compiler Explorer: fragments get the standard headers and a main(). */
export function standaloneSource(code: string, kind: SnippetKind): string {
  if (kind === 'program') return code;
  return `#include <bits/stdc++.h>\n${wrapSnippet(code, kind, { lineDirectives: false })}`;
}

export function clientState(source: string, sanitizers: SanitizerSet) {
  const executor = (id: string) => ({ compiler: { id, libs: [], options: RUN_FLAGS[sanitizers] }, arguments: '', stdin: '' });
  return {
    sessions: [
      {
        id: 1,
        language: 'c++',
        source,
        compilers: [{ id: CLANG, options: ASM_FLAGS, libs: [], filters: { commentOnly: true, directives: true, labels: true, intel: true, demangle: true } }],
        executors: [executor(CLANG), executor(GCC)],
      },
    ],
  };
}

function base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function godboltUrl(code: string, kind: SnippetKind, sanitizers: SanitizerSet = 'memory'): string {
  const state = clientState(standaloneSource(code, kind), sanitizers);
  return `${GODBOLT_ORIGIN}/clientstate/${encodeURIComponent(base64(JSON.stringify(state)))}`;
}
