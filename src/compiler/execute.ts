// Runs a compiled program under the WASI shim. Shared by the browser runner worker and Node scripts.
import { ConsoleStdout, File, OpenFile, WASI } from '@bjorn3/browser_wasi_shim';
import { UNCAUGHT_EXCEPTION } from './protocol.ts';

export type Stream = 'stdout' | 'stderr';

export type Execution = { type: 'exit'; code: number } | { type: 'trap'; message: string };

export interface ExecuteOptions {
  args: string[];
  outputLimit: number;
  onOutput: (stream: Stream, text: string) => void;
  onTruncated: () => void;
}

export async function execute(wasm: Uint8Array, { args, outputLimit, onOutput, onTruncated }: ExecuteOptions): Promise<Execution> {
  let written = 0;
  let truncated = false;
  const sink = (stream: Stream) => {
    const decoder = new TextDecoder();
    return new ConsoleStdout((bytes) => {
      if (truncated) return;
      written += bytes.length;
      if (written > outputLimit) {
        truncated = true;
        onTruncated();
        return;
      }
      onOutput(stream, decoder.decode(bytes, { stream: true }));
    });
  };
  const wasi = new WASI(['main', ...args], [], [new OpenFile(new File([])), sink('stdout'), sink('stderr')]);
  const module = await WebAssembly.compile(wasm as Uint8Array<ArrayBuffer>);
  const instance = await WebAssembly.instantiate(module, { wasi_snapshot_preview1: wasi.wasiImport });
  try {
    return { type: 'exit', code: wasi.start(instance as { exports: { memory: WebAssembly.Memory; _start: () => unknown } }) };
  } catch (error) {
    if (error instanceof WebAssembly.Exception) {
      // A C++ exception escaped main(); report it the way native libc++'s std::terminate does.
      onOutput('stderr', `libc++abi: terminating due to uncaught exception of type ${describeException(instance, error)}\n`);
      return { type: 'trap', message: UNCAUGHT_EXCEPTION };
    }
    // Wasm traps are RuntimeErrors; stack exhaustion surfaces as a RangeError (or InternalError in Firefox).
    return { type: 'trap', message: error instanceof Error ? error.message : String(error) };
  }
}

function describeException(instance: WebAssembly.Instance, error: WebAssembly.Exception): string {
  const { __cpp_exception: tag, learn_cpp_describe_exception: describe, memory } = instance.exports as unknown as {
    __cpp_exception?: WebAssembly.Tag;
    learn_cpp_describe_exception?: (pointer: number) => number;
    memory: WebAssembly.Memory;
  };
  if (!tag || !describe || !error.is(tag)) return 'unknown';
  try {
    const start = describe(error.getArg(tag, 0) as number);
    const bytes = new Uint8Array(memory.buffer);
    let end = start;
    while (end < bytes.length && bytes[end] !== 0) end++;
    return new TextDecoder().decode(bytes.subarray(start, end)) || 'unknown';
  } catch {
    return 'unknown';
  }
}
