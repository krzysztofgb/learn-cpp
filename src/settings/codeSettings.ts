// How code looks and behaves in every editor and snippet. A per-browser preference like the theme, so it
// lives in its own key rather than in exported progress.
import { useSyncExternalStore } from 'react';

export type FontSize = 'small' | 'medium' | 'large';

export interface CodeSettings {
  /** Wrap long lines instead of scrolling sideways. */
  wrap: boolean;
  lineNumbers: boolean;
  /** Syntax colours. */
  highlight: boolean;
  /** Tint the line with the cursor (editors). */
  activeLine: boolean;
  /** Type `(` and get `)` (editors). */
  closeBrackets: boolean;
  fontSize: FontSize;
  /** Spaces per indent level, and the width of a tab character. */
  tabSize: 2 | 4;
}

export const DEFAULT_CODE_SETTINGS: CodeSettings = {
  wrap: true,
  lineNumbers: true,
  highlight: true,
  activeLine: true,
  closeBrackets: true,
  fontSize: 'medium',
  tabSize: 4,
};

export const FONT_SIZE_PX: Record<FontSize, number> = { small: 12, medium: 13.5, large: 15 };

const KEY = 'learn-cpp/code-settings';

/** Keeps every valid stored field and falls back to the default for anything missing or malformed. */
export function parseCodeSettings(text: string | null): CodeSettings {
  let stored: Record<string, unknown> = {};
  try {
    const value: unknown = text ? JSON.parse(text) : {};
    if (value && typeof value === 'object') stored = value as Record<string, unknown>;
  } catch {
    // A corrupt value means defaults.
  }
  const flag = (name: 'wrap' | 'lineNumbers' | 'highlight' | 'activeLine' | 'closeBrackets') =>
    typeof stored[name] === 'boolean' ? (stored[name] as boolean) : DEFAULT_CODE_SETTINGS[name];
  const fontSize = stored.fontSize as FontSize;
  return {
    wrap: flag('wrap'),
    lineNumbers: flag('lineNumbers'),
    highlight: flag('highlight'),
    activeLine: flag('activeLine'),
    closeBrackets: flag('closeBrackets'),
    fontSize: typeof fontSize === 'string' && Object.hasOwn(FONT_SIZE_PX, fontSize) ? fontSize : DEFAULT_CODE_SETTINGS.fontSize,
    tabSize: stored.tabSize === 2 || stored.tabSize === 4 ? stored.tabSize : DEFAULT_CODE_SETTINGS.tabSize,
  };
}

function read(): CodeSettings {
  try {
    return parseCodeSettings(localStorage.getItem(KEY));
  } catch {
    return DEFAULT_CODE_SETTINGS;
  }
}

let current = typeof window === 'undefined' ? DEFAULT_CODE_SETTINGS : read();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== 'undefined') {
  // Another tab changed them: follow.
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY) return;
    current = read();
    notify();
  });
}

export function setCodeSettings(patch: Partial<CodeSettings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Without storage the choice lasts for this tab.
  }
  notify();
}

export function useCodeSettings(): CodeSettings {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
