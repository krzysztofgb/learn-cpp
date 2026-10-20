// The compile → link pipeline, shared by the browser compiler worker and Node scripts.
import { commands, Exit } from '@yowasp/clang';
import { compileFlags, languageFlags, LINK_FLAGS, type CompileOptions } from './flags.ts';
import type { Tree } from './pack.ts';
import type { Timings } from './protocol.ts';
import { SOURCE_NAME } from './wrap.ts';

export interface ClangProgress {
  doneLength: number;
  totalLength: number;
}

export interface ClangResult {
  output?: Uint8Array;
  stderr: string;
}

/** Runs clang++ over an in-memory file tree. A non-zero exit returns the diagnostics without output. */
export async function clang(args: string[], files: Tree, output: string, fetchProgress?: (event: ClangProgress) => void): Promise<ClangResult> {
  let stderr = '';
  const decoder = new TextDecoder();
  try {
    const result = await commands['clang++'](args, files, {
      stderr: (bytes: Uint8Array | null) => {
        if (bytes) stderr += decoder.decode(bytes, { stream: true });
      },
      ...(fetchProgress ? { fetchProgress } : {}),
    });
    const data = result?.[output];
    return { output: data instanceof Uint8Array ? data : undefined, stderr };
  } catch (error) {
    if (error instanceof Exit) return { stderr };
    throw error;
  }
}

export interface Toolchain {
  /** The sysroot pack: `sysroot/…` plus `prelude.hpp`. */
  base: Tree;
  /** The prebuilt prelude for these options (`prelude.pch`, `prelude.o`), if there is one. */
  prelude?: Tree;
}

export type CompileResult =
  | { ok: true; wasm: Uint8Array; diagnostics: string; timings: Timings }
  | { ok: false; diagnostics: string; timings: Timings };

const encoder = new TextEncoder();

export async function compileProgram(
  source: string,
  options: CompileOptions,
  { base, prelude }: Toolchain,
  hooks: { onLinking?: () => void; fetchProgress?: (event: ClangProgress) => void } = {},
): Promise<CompileResult> {
  const started = performance.now();
  const include = prelude ? ['-include-pch', 'prelude.pch'] : ['-include', 'prelude.hpp'];
  const compiled = await clang(
    [...compileFlags(options), ...include, '-c', SOURCE_NAME, '-o', 'main.o'],
    { ...base, ...prelude, [SOURCE_NAME]: encoder.encode(source) },
    'main.o',
    hooks.fetchProgress,
  );
  const compileMs = performance.now() - started;
  if (!compiled.output) return { ok: false, diagnostics: compiled.stderr, timings: { compileMs, linkMs: 0 } };

  hooks.onLinking?.();
  const linkStarted = performance.now();
  const objects: Tree = { 'main.o': compiled.output, ...(prelude ? { 'prelude.o': prelude['prelude.o'] as Uint8Array } : {}) };
  const linked = await clang(
    [...languageFlags(options), ...Object.keys(objects), '-o', 'main.wasm', ...LINK_FLAGS],
    { sysroot: base.sysroot as Tree, ...objects },
    'main.wasm',
    hooks.fetchProgress,
  );
  const timings = { compileMs, linkMs: performance.now() - linkStarted };
  const diagnostics = compiled.stderr + linked.stderr;
  return linked.output ? { ok: true, wasm: linked.output, diagnostics, timings } : { ok: false, diagnostics, timings };
}
