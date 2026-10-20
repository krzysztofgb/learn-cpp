import type { RunResult } from '../compiler/client.ts';
import type { RunnerState } from '../hooks/useRunner.ts';

const STAGE_LABELS = {
  loading: 'Loading compiler…',
  compiling: 'Compiling…',
  linking: 'Linking…',
  running: 'Running…',
} as const;

function formatMB(bytes: number) {
  return `${(bytes / 1e6).toFixed(0)} MB`;
}

function Status({ result }: { result: RunResult }) {
  switch (result.status) {
    case 'exited':
      return <span className={`badge ${result.exitCode === 0 ? 'ok' : 'warn'}`}>Exit code {result.exitCode}</span>;
    case 'compile-error':
      return <span className="badge error">Compile error</span>;
    case 'trapped':
      return <span className={`badge ${result.trap?.kind === 'ub' ? 'ub' : 'error'}`}>{result.trap?.label}</span>;
    case 'timeout':
      return <span className="badge error">Timed out</span>;
    case 'error':
      return <span className="badge error">Couldn't run</span>;
  }
}

export function RunPanel({ state }: { state: RunnerState }) {
  const { running, stage, download, output, result } = state;
  if (!running && !result) return null;
  const firstLoad = stage === 'loading' && download && download.total > 0;
  return (
    <section className="run-panel" aria-live="polite" aria-busy={running}>
      <header className="run-panel-header">
        {running && stage && (
          <span className="stage">
            <span className="spinner" aria-hidden="true" />
            {firstLoad
              ? `Downloading the compiler: ${formatMB(download.loaded)} of ~${formatMB(Math.max(download.total, download.loaded))} (one time)`
              : STAGE_LABELS[stage]}
          </span>
        )}
        {!running && result && <Status result={result} />}
        {!running && result?.timings && (
          <span className="timings">
            compile {Math.round(result.timings.compileMs)} ms · link {Math.round(result.timings.linkMs)} ms · run{' '}
            {Math.round(result.timings.runMs)} ms
          </span>
        )}
      </header>
      {result?.diagnostics && <pre className="diagnostics">{result.diagnostics}</pre>}
      {output.length > 0 && (
        <pre className="output" data-testid="program-output">
          {output.map((chunk, i) => (
            <span key={i} className={chunk.stream}>
              {chunk.text}
            </span>
          ))}
        </pre>
      )}
      {!running && result && output.length === 0 && result.status !== 'compile-error' && <p className="muted">No output.</p>}
      {result?.truncated && <p className="muted">Output truncated at 256 KB.</p>}
      {result?.status === 'timeout' && <p className="muted">The program ran longer than the time limit and was stopped.</p>}
      {result?.status === 'error' && <p className="muted">{result.error}</p>}
      {result?.trap && !['abort', 'terminate'].includes(result.trap.kind) && (
        <p className="muted">
          WebAssembly trap: <code>{result.trap.message}</code>
        </p>
      )}
    </section>
  );
}
