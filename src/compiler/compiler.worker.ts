/// <reference lib="webworker" />
// Compiles and links one C++ translation unit per request with clang running as WebAssembly.
// Programs run in a separate runner worker, so a runaway program never takes the compiler down.
import { compileProgram } from './compile.ts';
import { preludeVariant, type Profile } from './flags.ts';
import type { ToolchainManifest } from './manifest.ts';
import { decodePack, type Tree } from './pack.ts';
import type { CompileRequest, CompilerMessage, Stage } from './protocol.ts';

declare const self: DedicatedWorkerGlobalScope;

const BASE = `${import.meta.env.BASE_URL}toolchain/`;

const post = (message: CompilerMessage, transfer: Transferable[] = []) => self.postMessage(message, transfer);

let manifest: Promise<ToolchainManifest> | undefined;
let sysroot: Promise<Tree> | undefined;
const preludes = new Map<Profile, Promise<Tree>>();

/** Downloads a pack with progress. Caching for offline use is the service worker's job. */
async function fetchPack(name: string, onProgress: (loaded: number, total: number) => void): Promise<Tree> {
  const response = await fetch(BASE + name);
  if (!response.ok || !response.body) throw new Error(`Failed to download ${name}: HTTP ${response.status}`);
  const total = Number(response.headers.get('content-length')) || 0;
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress(loaded, Math.max(total, loaded));
  }
  const buffer = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  return decodePack(buffer.buffer);
}

function loadManifest(): Promise<ToolchainManifest> {
  manifest ??= fetch(BASE + 'manifest.json', { cache: 'no-cache' }).then((response) => {
    if (!response.ok) throw new Error(`Failed to load the toolchain manifest: HTTP ${response.status}`);
    return response.json() as Promise<ToolchainManifest>;
  });
  manifest.catch(() => (manifest = undefined));
  return manifest;
}

/** Memoizes a load, but forgets a failure so the next request retries. */
function memo(load: () => Promise<Tree>, get: () => Promise<Tree> | undefined, set: (value: Promise<Tree> | undefined) => void) {
  const existing = get();
  if (existing) return existing;
  const pending = load();
  set(pending);
  pending.catch(() => set(undefined));
  return pending;
}

function compilerMessages(id: number) {
  let lastPost = 0;
  const parts = new Map<string, [number, number]>();
  return {
    stage: (stage: Stage) => post({ type: 'stage', id, stage }),
    progress: (part: string) => (loaded: number, total: number) => {
      parts.set(part, [loaded, total]);
      const now = performance.now();
      if (now - lastPost < 100 && loaded < total) return;
      lastPost = now;
      let sumLoaded = 0;
      let sumTotal = 0;
      for (const [l, t] of parts.values()) {
        sumLoaded += l;
        sumTotal += t;
      }
      post({ type: 'download', id, loaded: sumLoaded, total: sumTotal });
    },
  };
}

async function compile({ id, source, options }: CompileRequest): Promise<void> {
  const messages = compilerMessages(id);
  messages.stage('loading');
  const variant = preludeVariant(options);
  const clangProgress = messages.progress('clang');
  const current = await loadManifest();
  const [base, prelude] = await Promise.all([
    memo(() => fetchPack(current.sysroot, messages.progress('sysroot')), () => sysroot, (value) => (sysroot = value)),
    variant
      ? memo(
          () => fetchPack(current.preludes[variant], messages.progress('prelude')),
          () => preludes.get(variant),
          (value) => (value ? preludes.set(variant, value) : preludes.delete(variant)),
        )
      : undefined,
  ]);

  messages.stage('compiling');
  const result = await compileProgram(source, options, { base, ...(prelude ? { prelude } : {}) }, {
    onLinking: () => messages.stage('linking'),
    fetchProgress: ({ doneLength, totalLength }) => clangProgress(doneLength, totalLength),
  });
  if (!result.ok) {
    post({ type: 'compiled', id, ok: false, diagnostics: result.diagnostics, timings: result.timings });
    return;
  }
  const wasm = result.wasm.slice();
  post({ type: 'compiled', id, ok: true, wasm, diagnostics: result.diagnostics, timings: result.timings }, [wasm.buffer]);
}

self.onmessage = (event: MessageEvent<CompileRequest>) => {
  compile(event.data).catch((error: unknown) => {
    post({ type: 'failed', id: event.data.id, error: error instanceof Error ? error.message : String(error) });
  });
};
