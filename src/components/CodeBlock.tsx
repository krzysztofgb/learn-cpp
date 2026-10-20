import { useMemo, useState } from 'react';
import type { RunSettings } from '../compiler/client.ts';
import { wrapSnippet } from '../compiler/wrap.ts';
import { isCppLang } from '../course/parse.ts';
import type { Snippet } from '../course/types.ts';
import { godboltUrl, type SanitizerSet } from '../godbolt/clientstate.ts';
import { useCompileOptions } from '../hooks/useCompileOptions.ts';
import { useRunner } from '../hooks/useRunner.ts';
import { LazyCodeEditor as CodeEditor } from './LazyCodeEditor.tsx';
import { highlightCpp } from './highlight.tsx';
import { RunPanel } from './RunPanel.tsx';

interface CodeBlockProps {
  snippet: Snippet;
  /** Hide the Run button until the learner has committed to an answer. */
  locked?: boolean;
  /** Threaded snippets open Compiler Explorer with ThreadSanitizer. */
  sanitizers?: SanitizerSet;
  settings?: RunSettings;
  label?: string;
}

const THREADS = /\bstd::(?:thread|jthread|async|atomic)|memory_order/;

export function CodeBlock({ snippet, locked = false, sanitizers, settings, label = 'Code' }: CodeBlockProps) {
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState(snippet.code);
  const [copied, setCopied] = useState(false);
  const [options] = useCompileOptions();
  const runner = useRunner();
  const cpp = isCppLang(snippet.lang);
  const highlighted = useMemo(() => (cpp ? highlightCpp(code) : [code]), [code, cpp]);
  const canRun = snippet.run === 'local' && !locked;
  const run = () => void runner.run(wrapSnippet(code, snippet.kind), options, settings);
  const sanitizerSet = sanitizers ?? (THREADS.test(code) ? 'threads' : 'memory');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <figure className="code-block">
      {editing ? (
        <CodeEditor value={code} onChange={setCode} onRun={canRun ? run : undefined} label={`${label} (editable)`} />
      ) : (
        <pre className="code-static" aria-label={label}>
          <code>{highlighted}</code>
        </pre>
      )}
      {cpp && (
        <div className="code-actions">
          {canRun && (
            <button type="button" className="button primary small" onClick={run} disabled={runner.running}>
              {runner.running ? 'Running…' : 'Run'}
            </button>
          )}
          {snippet.run === 'local' && locked && <span className="muted small-text">Answer first to run it.</span>}
          {snippet.run === 'local' && !locked && (
            <button type="button" className="button small" onClick={() => setEditing((value) => !value)} aria-pressed={editing}>
              {editing ? 'Done editing' : 'Edit'}
            </button>
          )}
          {snippet.run !== 'none' && !locked && (
            <a className="button small" href={godboltUrl(code, snippet.kind, sanitizerSet)} target="_blank" rel="noreferrer">
              Compiler Explorer ↗
            </a>
          )}
          <button type="button" className="button small ghost" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy'}
          </button>
          {editing && code !== snippet.code && (
            <button type="button" className="button small ghost" onClick={() => setCode(snippet.code)}>
              Reset
            </button>
          )}
        </div>
      )}
      {snippet.note && <figcaption className="code-note">{snippet.note}</figcaption>}
      <RunPanel state={runner} />
    </figure>
  );
}
