import { useState } from 'react';
import { LazyCodeEditor as CodeEditor } from '../components/LazyCodeEditor.tsx';
import { RunOptions } from '../components/RunOptions.tsx';
import { RunPanel } from '../components/RunPanel.tsx';
import { useCompileOptions } from '../hooks/useCompileOptions.ts';
import { useRunner } from '../hooks/useRunner.ts';

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
    <article className="page wide">
      <h1>Playground</h1>
      <p className="lede">
        Write any C++23 program. It compiles with clang and runs as WebAssembly in your browser. Press{' '}
        <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Enter</kbd> to run.
      </p>
      <div className="editor-block">
        <CodeEditor value={source} onChange={setSource} onRun={run} label="Playground source" />
        <div className="editor-toolbar">
          <RunOptions options={options} onChange={setOptions} />
          <button type="button" className="button primary" onClick={run} disabled={runner.running}>
            {runner.running ? 'Running…' : 'Run'}
          </button>
        </div>
      </div>
      <RunPanel state={runner} />
    </article>
  );
}
