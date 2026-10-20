import { useCallback, useRef, useState } from 'react';
import { compileAndRun, type RunResult, type RunSettings } from '../compiler/client.ts';
import type { CompileOptions } from '../compiler/flags.ts';
import type { Stage } from '../compiler/protocol.ts';

export interface OutputChunk {
  stream: 'stdout' | 'stderr';
  text: string;
}

export interface RunnerState {
  running: boolean;
  stage?: Stage;
  download?: { loaded: number; total: number };
  output: OutputChunk[];
  result?: RunResult;
}

export function useRunner() {
  const [state, setState] = useState<RunnerState>({ running: false, output: [] });
  const generation = useRef(0);

  const run = useCallback(async (source: string, options: CompileOptions, settings?: RunSettings) => {
    const current = ++generation.current;
    const update = (patch: (previous: RunnerState) => Partial<RunnerState>) => {
      if (generation.current === current) setState((previous) => ({ ...previous, ...patch(previous) }));
    };
    setState({ running: true, stage: 'loading', output: [] });
    const result = await compileAndRun(
      source,
      options,
      {
        onStage: (stage) => update(() => (stage === 'loading' ? { stage } : { stage, download: undefined })),
        onDownload: (loaded, total) => update(() => ({ download: { loaded, total } })),
        onOutput: (stream, text) =>
          update((previous) => {
            const last = previous.output.at(-1);
            if (last?.stream === stream) return { output: [...previous.output.slice(0, -1), { stream, text: last.text + text }] };
            return { output: [...previous.output, { stream, text }] };
          }),
      },
      settings,
    );
    update(() => ({ running: false, stage: undefined, download: undefined, result }));
    return result;
  }, []);

  const reset = useCallback(() => {
    generation.current++;
    setState({ running: false, output: [] });
  }, []);

  return { ...state, run, reset };
}
