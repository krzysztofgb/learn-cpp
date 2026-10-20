import { useState } from 'react';

type Theme = 'system' | 'light' | 'dark';

const KEY = 'learn-cpp/theme';
const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<Theme, string> = { system: 'Theme: system', light: 'Theme: light', dark: 'Theme: dark' };
const ICON: Record<Theme, string> = { system: '◐', light: '☀', dark: '☾' };

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

/** The stored choice is also applied before first paint by the inline script in index.html. */
function applyTheme(theme: Theme) {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try {
    if (theme === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Without storage the choice lasts for this page only.
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState(readTheme);
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={`${LABEL[theme]}. Switch to ${NEXT[theme]}.`}
      title={LABEL[theme]}
      onClick={() => {
        const next = NEXT[theme];
        applyTheme(next);
        setTheme(next);
      }}
    >
      <span aria-hidden="true">{ICON[theme]}</span>
    </button>
  );
}
