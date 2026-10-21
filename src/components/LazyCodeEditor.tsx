import { lazy, Suspense, type ComponentProps } from 'react';
import { StaticCode } from './StaticCode.tsx';

// CodeMirror is only needed once someone edits code, so it stays out of the main bundle.
const CodeEditor = lazy(async () => ({ default: (await import('./CodeEditor.tsx')).CodeEditor }));

export function LazyCodeEditor(props: ComponentProps<typeof CodeEditor>) {
  return (
    <Suspense
      fallback={<StaticCode code={props.value} cpp busy />}
    >
      <CodeEditor {...props} />
    </Suspense>
  );
}
