import { parser } from '@lezer/cpp';
import { classHighlighter, highlightCode } from '@lezer/highlight';
import type { ReactNode } from 'react';

/** Highlights C++ into spans with `tok-*` classes (styled in styles.css). */
export function highlightCpp(code: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  highlightCode(
    code,
    parser.parse(code),
    classHighlighter,
    (text, classes) => nodes.push(classes ? <span key={nodes.length} className={classes}>{text}</span> : text),
    () => nodes.push('\n'),
  );
  return nodes;
}
