import { Fragment, useState } from 'react';
import { LazyCodeEditor as CodeEditor } from '../components/LazyCodeEditor.tsx';
import { RunOptions } from '../components/RunOptions.tsx';
import { RunPanel } from '../components/RunPanel.tsx';
import { commandFlags } from '../compiler/flags.ts';
import { useCompileOptions } from '../hooks/useCompileOptions.ts';
import { useRunner } from '../hooks/useRunner.ts';
import { Button } from '../components/arc/button/button.tsx';

const SAMPLE = `#include <climits>
#include <print>
#include <vector>

int main() {
    std::vector<int> v{1, 2, 3};
    std::println("sum of {} elements", v.size());

    int big = INT_MAX;
    big += static_cast<int>(v.size());  // signed overflow: UB, caught in Debug
    std::println("{}", big);
}
`;

export function Playground() {
  const [source, setSource] = useState(SAMPLE);
  const [options, setOptions] = useCompileOptions();
  const runner = useRunner();
  const run = () => void runner.run(source, options);

  return (
    <article className="page wide playground">
      <header className="title-row">
        <h1>Playground</h1>
        <p className="subtitle">
          Any C++ program, compiled with clang and run as WebAssembly in your browser. <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Enter</kbd> runs it.
        </p>
      </header>
      <div className="toolbar">
        <RunOptions options={options} onChange={setOptions} />
        <Button onClick={run} loading={runner.running}>
          Run
        </Button>
      </div>
      <div className="playground-grid">
        <div className="editor-block">
          <CodeEditor value={source} onChange={setSource} onRun={run} label="Playground source" />
        </div>
        <RunPanel
          state={runner}
          empty={
            <>
              <p className="run-note">Output appears here. Each run compiles your program with:</p>
              <pre className="command">
                clang++
                {[...commandFlags(options), 'main.cpp'].map((flag) => (
                  <Fragment key={flag}>
                    {' '}
                    <span className="flag">{flag}</span>
                  </Fragment>
                ))}
              </pre>
            </>
          }
        />
      </div>
    </article>
  );
}
