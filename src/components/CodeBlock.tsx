import { useState } from 'react';
import type { RunSettings } from '../compiler/client.ts';
import { wrapSnippet } from '../compiler/wrap.ts';
import { isCppLang } from '../course/fence.ts';
import type { Snippet } from '../course/types.ts';
import { godboltUrl, type SanitizerSet } from '../godbolt/clientstate.ts';
import { useCompileOptions } from '../hooks/useCompileOptions.ts';
import { useRunner } from '../hooks/useRunner.ts';
import { LazyCodeEditor as CodeEditor } from './LazyCodeEditor.tsx';
import { RunPanel } from './RunPanel.tsx';
import { StaticCode } from './StaticCode.tsx';
import { Button } from './arc/button/button.tsx';
import { CodeSettings } from './CodeSettings.tsx';

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
  const canRun = snippet.run === 'local' && !locked;
  // Course snippets often exist to show code that warns; -Werror is for the learner's own code (exercises, playground),
  // so here the warnings are shown and the program still runs.
  const run = () => void runner.run(wrapSnippet(code, snippet.kind), { ...options, werror: false }, settings);
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
        <StaticCode code={code} cpp={cpp} label={label} />
      )}
      {cpp && (
        <div className="code-actions">
          {canRun && (
            <Button size="sm" onClick={run} loading={runner.running}>
              Run
            </Button>
          )}
          {snippet.run === 'local' && locked && <span className="muted small-text">Answer first to run it.</span>}
          {snippet.run === 'local' && !locked && (
            <Button size="sm" variant="secondary" onClick={() => setEditing((value) => !value)} aria-pressed={editing}>
              {editing ? 'Done editing' : 'Edit'}
            </Button>
          )}
          {snippet.run !== 'none' && !locked && (
            <a className="link-button small" href={godboltUrl(code, snippet.kind, sanitizerSet)} target="_blank" rel="noreferrer">
              Compiler Explorer ↗
            </a>
          )}
          <Button size="sm" variant="ghost" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
          {editing && code !== snippet.code && (
            <Button size="sm" variant="ghost" onClick={() => setCode(snippet.code)}>
              Reset
            </Button>
          )}
          <CodeSettings />
        </div>
      )}
      {snippet.note && <figcaption className="code-note">{snippet.note}</figcaption>}
      <RunPanel state={runner} />
    </figure>
  );
}
