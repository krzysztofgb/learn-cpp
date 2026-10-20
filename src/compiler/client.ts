// Main-thread API for compiling and running C++: one shared compiler worker, a fresh runner per run.
import type { CompileOptions } from './flags.ts';
import type { CompilerMessage, RunnerMessage, Stage, Timings } from './protocol.ts';
import { classifyTrap, type Trap } from './traps.ts';

export interface RunHandlers {
  onStage?: (stage: Stage) => void;
  onDownload?: (loaded: number, total: number) => void;
  onOutput?: (stream: 'stdout' | 'stderr', text: string) => void;
}

export interface RunSettings {
  /** Wall-clock limit for the program itself (not compilation). */
  timeoutMs?: number;
  args?: string[];
}

export type RunStatus = 'exited' | 'compile-error' | 'trapped' | 'timeout' | 'error';

export interface RunResult {
  status: RunStatus;
  exitCode?: number;
  trap?: Trap;
  error?: string;
  diagnostics: string;
  stdout: string;
  stderr: string;
  truncated: boolean;
  timings?: Timings & { runMs: number };
}

const DEFAULT_TIMEOUT_MS = 5000;
const COMPILE_TIMEOUT_MS = 180_000;
const OUTPUT_LIMIT = 256 * 1024;

let compiler: Worker | undefined;
let nextId = 1;
let queue: Promise<unknown> = Promise.resolve();

function compilerWorker(): Worker {
  compiler ??= new Worker(new URL('./compiler.worker.ts', import.meta.url), { type: 'module', name: 'cpp-compiler' });
  return compiler;
}

function resetCompiler(): void {
  compiler?.terminate();
  compiler = undefined;
}

type Compiled = Extract<CompilerMessage, { type: 'compiled' }>;

function compile(source: string, options: CompileOptions, handlers: RunHandlers): Promise<Compiled> {
  const id = nextId++;
  const worker = compilerWorker();
  return new Promise<Compiled>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resetCompiler();
      reject(new Error('The compiler did not respond in time.'));
    }, COMPILE_TIMEOUT_MS);
    const onMessage = (event: MessageEvent<CompilerMessage>) => {
      const message = event.data;
      if (message.id !== id) return;
      if (message.type === 'stage') handlers.onStage?.(message.stage);
      else if (message.type === 'download') handlers.onDownload?.(message.loaded, message.total);
      else {
        cleanup();
        if (message.type === 'compiled') resolve(message);
        else reject(new Error(message.error));
      }
    };
    const onError = (event: ErrorEvent) => {
      cleanup();
      resetCompiler();
      reject(new Error(event.message || 'The compiler worker crashed.'));
    };
    const cleanup = () => {
      clearTimeout(timer);
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
    };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    worker.postMessage({ id, source, options });
  });
}

interface Execution {
  status: 'exited' | 'trapped' | 'timeout' | 'error';
  exitCode?: number;
  trapMessage?: string;
  error?: string;
  stdout: string;
  stderr: string;
  truncated: boolean;
  runMs: number;
}

function execute(wasm: Uint8Array, settings: RunSettings, handlers: RunHandlers): Promise<Execution> {
  const worker = new Worker(new URL('./runner.worker.ts', import.meta.url), { type: 'module', name: 'cpp-runner' });
  const started = performance.now();
  const state = { stdout: '', stderr: '', truncated: false };
  return new Promise<Execution>((resolve) => {
    const finish = (result: Omit<Execution, 'stdout' | 'stderr' | 'truncated' | 'runMs'>) => {
      clearTimeout(timer);
      worker.terminate();
      resolve({ ...result, ...state, runMs: performance.now() - started });
    };
    const timer = setTimeout(() => finish({ status: 'timeout' }), settings.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    worker.onmessage = (event: MessageEvent<RunnerMessage>) => {
      const message = event.data;
      switch (message.type) {
        case 'output':
          state[message.stream] += message.text;
          handlers.onOutput?.(message.stream, message.text);
          break;
        case 'truncated':
          state.truncated = true;
          break;
        case 'exit':
          finish({ status: 'exited', exitCode: message.code });
          break;
        case 'trap':
          finish({ status: 'trapped', trapMessage: message.message });
          break;
        case 'failed':
          finish({ status: 'error', error: message.error });
          break;
      }
    };
    worker.onerror = (event) => finish({ status: 'error', error: event.message || 'The program runner crashed.' });
    worker.postMessage({ wasm, args: settings.args ?? [], outputLimit: OUTPUT_LIMIT }, [wasm.buffer]);
  });
}

async function compileAndRunNow(source: string, options: CompileOptions, handlers: RunHandlers, settings: RunSettings): Promise<RunResult> {
  const empty = { stdout: '', stderr: '', truncated: false };
  let compiled: Compiled;
  try {
    compiled = await compile(source, options, handlers);
  } catch (error) {
    return { status: 'error', error: error instanceof Error ? error.message : String(error), diagnostics: '', ...empty };
  }
  if (!compiled.ok) return { status: 'compile-error', diagnostics: compiled.diagnostics, timings: { ...compiled.timings, runMs: 0 }, ...empty };
  handlers.onStage?.('running');
  const run = await execute(compiled.wasm, settings, handlers);
  const timings = { ...compiled.timings, runMs: run.runMs };
  const common = { diagnostics: compiled.diagnostics, stdout: run.stdout, stderr: run.stderr, truncated: run.truncated, timings };
  switch (run.status) {
    case 'exited':
      return { status: 'exited', exitCode: run.exitCode, ...common };
    case 'trapped':
      return { status: 'trapped', trap: classifyTrap(run.trapMessage ?? '', run.stderr, options.profile), ...common };
    default:
      return { status: run.status, error: run.error, ...common };
  }
}

/** Compiles and runs one program. Requests are serialized: the compiler handles one at a time. */
export function compileAndRun(source: string, options: CompileOptions, handlers: RunHandlers = {}, settings: RunSettings = {}): Promise<RunResult> {
  const result = queue.then(() => compileAndRunNow(source, options, handlers, settings));
  queue = result.catch(() => undefined);
  return result;
}
