// Compiles and runs C++ in Node with the same toolchain assets and pipeline the browser uses.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { compileProgram, type CompileResult, type Toolchain } from '../../src/compiler/compile.ts';
import { preludeVariant, type CompileOptions, type Profile } from '../../src/compiler/flags.ts';
import type { ToolchainManifest } from '../../src/compiler/manifest.ts';
import { decodePack, type Tree } from '../../src/compiler/pack.ts';
import type { Execution } from '../../src/compiler/execute.ts';

const TOOLCHAIN = join(dirname(fileURLToPath(import.meta.url)), '../../public/toolchain');

function readPack(name: string): Tree {
  const bytes = readFileSync(join(TOOLCHAIN, name));
  return decodePack(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
}

let manifest: ToolchainManifest | undefined;
let base: Tree | undefined;
const preludes = new Map<Profile, Tree>();

export function loadToolchain(options: CompileOptions): Toolchain {
  manifest ??= JSON.parse(readFileSync(join(TOOLCHAIN, 'manifest.json'), 'utf8')) as ToolchainManifest;
  base ??= readPack(manifest.sysroot);
  const variant = preludeVariant(options);
  if (!variant) return { base };
  if (!preludes.has(variant)) preludes.set(variant, readPack(manifest.preludes[variant]));
  return { base, prelude: preludes.get(variant)! };
}

export function compile(source: string, options: CompileOptions): Promise<CompileResult> {
  return compileProgram(source, options, loadToolchain(options), { fetchProgress: () => {} });
}

export interface NodeRun {
  result: Execution | { type: 'timeout' };
  stdout: string;
  stderr: string;
}

/** Runs a program in a worker thread so an infinite loop can be stopped. */
export function run(wasm: Uint8Array, timeoutMs = 5000): Promise<NodeRun> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./run-worker.ts', import.meta.url), { workerData: { wasm } });
    const timer = setTimeout(() => {
      void worker.terminate();
      resolve({ result: { type: 'timeout' }, stdout: '', stderr: '' });
    }, timeoutMs);
    worker.once('message', (message: NodeRun) => {
      clearTimeout(timer);
      void worker.terminate();
      resolve(message);
    });
    worker.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}
