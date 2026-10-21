import { parser } from '@lezer/cpp';
import { classHighlighter, highlightCode } from '@lezer/highlight';
import type { ReactNode } from 'react';

/** Splits code into lines; C++ lines are highlighted into spans with `tok-*` classes (styled in styles.css). */
export function codeLines(code: string, cpp: boolean): ReactNode[][] {
  if (!cpp) return code.split('\n').map((line) => [line]);
  const lines: ReactNode[][] = [[]];
  let key = 0;
  highlightCode(
    code,
    parser.parse(code),
    classHighlighter,
    (text, classes) => lines.at(-1)!.push(classes ? <span key={key++} className={classes}>{text}</span> : text),
    () => lines.push([]),
  );
  return lines;
}
