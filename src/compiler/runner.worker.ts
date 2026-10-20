/// <reference lib="webworker" />
// Runs one compiled program. The client terminates this worker on timeout,
// which is the only way to stop a program stuck in an infinite loop.
import { execute } from './execute.ts';
import type { RunnerMessage, RunRequest } from './protocol.ts';

declare const self: DedicatedWorkerGlobalScope;

const post = (message: RunnerMessage) => self.postMessage(message);

self.onmessage = (event: MessageEvent<RunRequest>) => {
  const { wasm, args, outputLimit } = event.data;
  execute(wasm, {
    args,
    outputLimit,
    onOutput: (stream, text) => post({ type: 'output', stream, text }),
    onTruncated: () => post({ type: 'truncated' }),
  })
    .then((result) => post(result.type === 'exit' ? { type: 'exit', code: result.code } : { type: 'trap', message: result.message }))
    .catch((error: unknown) => post({ type: 'failed', error: error instanceof Error ? error.message : String(error) }));
};
