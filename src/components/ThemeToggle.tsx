import { Monitor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { Button } from './arc/button/button.tsx';

type Theme = 'system' | 'light' | 'dark';

const KEY = 'learn-cpp/theme';
const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<Theme, string> = { system: 'Theme: system', light: 'Theme: light', dark: 'Theme: dark' };
const ICON = { system: Monitor, light: Sun, dark: Moon } satisfies Record<Theme, unknown>;

const systemDark = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : undefined;

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

/**
 * Arc styles an explicit data-theme only, so "system" is resolved here (and before first paint by
 * the inline script in index.html), and re-resolved when the OS setting changes.
 */
function resolve(theme: Theme) {
  document.documentElement.dataset.theme = theme === 'system' ? (systemDark?.matches ? 'dark' : 'light') : theme;
}

systemDark?.addEventListener('change', () => {
  if (readTheme() === 'system') resolve('system');
});

function applyTheme(theme: Theme) {
  resolve(theme);
  try {
    if (theme === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Without storage the choice lasts for this page only.
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState(readTheme);
  const Icon = ICON[theme];
  return (
    <Button
      variant="ghost"
      size="sm"
      className="icon-only"
      aria-label={`${LABEL[theme]}. Switch to ${NEXT[theme]}.`}
      title={LABEL[theme]}
      onClick={() => {
        const next = NEXT[theme];
        applyTheme(next);
        setTheme(next);
      }}
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
    </Button>
  );
}
