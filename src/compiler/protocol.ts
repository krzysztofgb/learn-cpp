import type { CompileOptions } from './flags.ts';

/** Trap message the runner reports when a C++ exception escapes main(). */
export const UNCAUGHT_EXCEPTION = 'uncaught C++ exception';

export type Stage = 'loading' | 'compiling' | 'linking' | 'running';

export interface CompileRequest {
  id: number;
  source: string;
  options: CompileOptions;
}

export interface Timings {
  compileMs: number;
  linkMs: number;
}

export type CompilerMessage =
  | { type: 'stage'; id: number; stage: Stage }
  | { type: 'download'; id: number; loaded: number; total: number }
  | { type: 'compiled'; id: number; ok: true; wasm: Uint8Array; diagnostics: string; timings: Timings }
  | { type: 'compiled'; id: number; ok: false; diagnostics: string; timings: Timings }
  | { type: 'failed'; id: number; error: string };

export interface RunRequest {
  wasm: Uint8Array;
  args: string[];
  outputLimit: number;
}

export type RunnerMessage =
  | { type: 'output'; stream: 'stdout' | 'stderr'; text: string }
  | { type: 'truncated' }
  | { type: 'exit'; code: number }
  | { type: 'trap'; message: string }
  | { type: 'failed'; error: string };
