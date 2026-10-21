import { useMemo, type CSSProperties } from 'react';
import { FONT_SIZE_PX, useCodeSettings } from '../settings/codeSettings.ts';
import { codeLines } from './highlight.tsx';

/**
 * Read-only code, drawn to the same code settings as the editor: wrapping, line numbers (a CSS counter,
 * so they aren't selected or copied), syntax colours, font size and tab width.
 */
export function StaticCode({ code, cpp, label, busy = false }: { code: string; cpp: boolean; label?: string; busy?: boolean }) {
  const settings = useCodeSettings();
  const lines = useMemo(() => codeLines(code, cpp && settings.highlight), [code, cpp, settings.highlight]);
  const style = { fontSize: FONT_SIZE_PX[settings.fontSize], tabSize: settings.tabSize, '--line-digits': String(lines.length).length } as CSSProperties;
  return (
    <pre className={['code-static', settings.wrap && 'wrap', settings.lineNumbers && 'numbered'].filter(Boolean).join(' ')} aria-label={label} aria-busy={busy || undefined} style={style}>
      <code>
        {lines.map((line, i) => (
          <span key={i} className="line">
            {line}
          </span>
        ))}
      </code>
    </pre>
  );
}
