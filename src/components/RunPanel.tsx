import type { ReactNode } from 'react';
import type { RunResult } from '../compiler/client.ts';
import type { Stage } from '../compiler/protocol.ts';
import type { RunnerState } from '../hooks/useRunner.ts';
import { Badge } from './arc/badge/badge.tsx';

function formatMB(bytes: number) {
  return `${(bytes / 1e6).toFixed(0)} MB`;
}

function Verdict({ result }: { result: RunResult }) {
  switch (result.status) {
    case 'exited':
      return <Badge tone={result.exitCode === 0 ? 'success' : 'warning'}>Exit code {result.exitCode}</Badge>;
    case 'compile-error':
      return <Badge tone="danger">Compile error</Badge>;
    case 'trapped':
      return <Badge tone="danger">{result.trap?.label}</Badge>;
    case 'timeout':
      return <Badge tone="warning">Timed out</Badge>;
    case 'error':
      return <Badge tone="danger">Couldn't run</Badge>;
  }
}

type StepState = 'pending' | 'active' | 'done' | 'failed' | 'skipped';

const STEPS: { stage: Exclude<Stage, 'loading'>; label: string; timing: 'compileMs' | 'linkMs' | 'runMs' }[] = [
  { stage: 'compiling', label: 'Compile', timing: 'compileMs' },
  { stage: 'linking', label: 'Link', timing: 'linkMs' },
  { stage: 'running', label: 'Run', timing: 'runMs' },
];

function stepState(index: number, { running, stage, result }: RunnerState): StepState {
  if (running) {
    const current = STEPS.findIndex((step) => step.stage === stage);
    if (current === -1) return 'pending';
    return index < current ? 'done' : index === current ? 'active' : 'pending';
  }
  if (!result) return 'pending';
  if (result.status === 'compile-error') return index === 0 ? 'failed' : 'skipped';
  if (result.status === 'error' && !result.timings) return index === 0 ? 'failed' : 'skipped';
  return 'done';
}

/**
 * The run as its own pipeline: compile, link and run with their real times, then the verdict.
 * `empty` keeps the panel's frame (with that content) before anything has run.
 */
export function RunPanel({ state, empty }: { state: RunnerState; empty?: ReactNode }) {
  const { running, stage, download, output, result } = state;
  if (!running && !result && !empty) return null;
  const loading = running && stage === 'loading';
  return (
    <section className="run-panel" aria-live="polite" aria-busy={running} aria-label="Program run">
      {(running || result) && (
        <header className="pipeline">
          <ol>
            {loading && (
              <li className="step" data-state="active">
                <span>Load compiler</span>
                <span className="step-time">
                  {download && download.total > 0 ? `${formatMB(download.loaded)} of ~${formatMB(Math.max(download.total, download.loaded))}` : '…'}
                </span>
              </li>
            )}
            {STEPS.map((step, index) => {
              const value = stepState(index, state);
              const ms = !running && result?.timings && value === 'done' ? Math.round(result.timings[step.timing]) : undefined;
              return (
                <li key={step.stage} className="step" data-state={value}>
                  <span>{step.label}</span>
                  <span className="step-time">{ms !== undefined ? `${ms} ms` : value === 'skipped' ? '—' : value === 'active' ? '…' : ''}</span>
                </li>
              );
            })}
          </ol>
          {!running && result && <Verdict result={result} />}
        </header>
      )}
      {loading && <p className="run-note">The compiler downloads once, then works offline.</p>}
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
      {!running && !result && empty && <div className="run-empty">{empty}</div>}
      {!running && result && output.length === 0 && result.status !== 'compile-error' && <p className="run-note">No output.</p>}
      {result?.truncated && <p className="run-note">Output truncated at 256 KB.</p>}
      {result?.status === 'timeout' && <p className="run-note">The program ran longer than the time limit and was stopped.</p>}
      {result?.status === 'error' && <p className="run-note">{result.error}</p>}
      {result?.trap && !['abort', 'terminate'].includes(result.trap.kind) && (
        <p className="run-note">
          WebAssembly trap: <code>{result.trap.message}</code>
        </p>
      )}
    </section>
  );
}
