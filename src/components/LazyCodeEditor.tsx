import { lazy, Suspense, type ComponentProps } from 'react';

// CodeMirror is only needed once someone edits code, so it stays out of the main bundle.
const CodeEditor = lazy(async () => ({ default: (await import('./CodeEditor.tsx')).CodeEditor }));

export function LazyCodeEditor(props: ComponentProps<typeof CodeEditor>) {
  return (
    <Suspense
      fallback={
        <pre className="code-static" aria-busy="true">
          <code>{props.value}</code>
        </pre>
      }
    >
      <CodeEditor {...props} />
    </Suspense>
  );
}
