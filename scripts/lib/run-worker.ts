import { parentPort, workerData } from 'node:worker_threads';
import { execute } from '../../src/compiler/execute.ts';

const output = { stdout: '', stderr: '' };
const result = await execute(workerData.wasm as Uint8Array, {
  args: [],
  outputLimit: 256 * 1024,
  onOutput: (stream, text) => (output[stream] += text),
  onTruncated: () => (output.stdout += '\n[output truncated]'),
});
parentPort!.postMessage({ result, ...output });
