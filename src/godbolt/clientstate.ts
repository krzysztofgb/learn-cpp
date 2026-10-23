// Builds Compiler Explorer links for what the in-browser compiler can't show: x86-64 assembly, a native run with
// AddressSanitizer or ThreadSanitizer, and (when a snippet asks) a GCC run next to Clang. The snippet compiles and runs
// with the learner's own build settings. Compiler Explorer accepts a base64 ClientState document at /clientstate/<base64>.
import type { CompileOptions } from '../compiler/flags.ts';
import { wrapSnippet, type SnippetKind } from '../compiler/wrap.ts';

export const GODBOLT_ORIGIN = 'https://godbolt.org';

/** `threads` uses ThreadSanitizer, which can't be combined with AddressSanitizer. */
export type SanitizerSet = 'memory' | 'threads';

const CLANG = 'clang_trunk';
const GCC = 'gsnapshot';

/** The app's Debug/Release and standard, as native flags: Debug adds the sanitizers the browser build only traps. */
export function nativeFlags(options: Pick<CompileOptions, 'profile' | 'std'>, sanitizers: SanitizerSet): string {
  const std = `-std=${options.std}`;
  if (sanitizers === 'threads') return `${std} ${options.profile === 'release' ? '-O2' : '-O1'} -g -Wall -Wextra -fsanitize=thread -pthread`;
  return options.profile === 'release' ? `${std} -O2 -Wall -Wextra` : `${std} -O0 -g -Wall -Wextra -fsanitize=address,undefined -fno-omit-frame-pointer`;
}

/** A complete program for Compiler Explorer: fragments get the standard headers and a main(). */
export function standaloneSource(code: string, kind: SnippetKind): string {
  if (kind === 'program') return code;
  return `#include <bits/stdc++.h>\n${wrapSnippet(code, kind, { lineDirectives: false })}`;
}

export interface GodboltOptions {
  options: Pick<CompileOptions, 'profile' | 'std'>;
  sanitizers?: SanitizerSet;
  /** Add GCC beside Clang, for snippets where the two compilers disagree. */
  gcc?: boolean;
}

export function clientState(source: string, { options, sanitizers = 'memory', gcc = false }: GodboltOptions) {
  const flags = nativeFlags(options, sanitizers);
  // Three panes: the source, Clang's x86-64 assembly, and one output panel (warnings, exit code and the program's own
  // output: `execute` runs it and `compilerOutput` opens the panel). A GCC run joins them only when asked for.
  const clang = {
    id: CLANG,
    options: flags,
    libs: [],
    specialoutputs: ['compilerOutput'],
    filters: { execute: true, commentOnly: true, directives: true, labels: true, intel: true, demangle: true },
  };
  const gccRun = { compiler: { id: GCC, libs: [], options: flags }, arguments: '', stdin: '' };
  return {
    sessions: [{ id: 1, language: 'c++', source, compilers: [clang], executors: gcc ? [gccRun] : [] }],
  };
}

function base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function godboltUrl(code: string, kind: SnippetKind, settings: GodboltOptions): string {
  const state = clientState(standaloneSource(code, kind), settings);
  return `${GODBOLT_ORIGIN}/clientstate/${encodeURIComponent(base64(JSON.stringify(state)))}`;
}
