import { useEffect, useState } from 'react';

import { ThemeProvider } from '@vellira-ui/react';

import { Dashboard, type DashboardTheme } from './Dashboard';

type LocalTheme = Exclude<DashboardTheme, 'system'>;
const themeKey = 'vellira-dashboard-theme-v2';
const oldKey = 'vellira-workspace-starter-v1';

function isLocalTheme(value: unknown): value is LocalTheme {
  return value === 'light' || value === 'dark' || value === 'high-contrast';
}

export default function App() {
  const [theme, setTheme] = useState<LocalTheme>('light');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(themeKey);
      if (isLocalTheme(saved)) {
        setTheme(saved);
        return;
      }
      const previous = window.localStorage.getItem(oldKey);
      if (!previous) return;
      const parsed: unknown = JSON.parse(previous);
      if (parsed && typeof parsed === 'object' && 'theme' in parsed) {
        const previousTheme = (parsed as { theme: unknown }).theme;
        if (isLocalTheme(previousTheme)) setTheme(previousTheme);
      }
    } catch {
      // System defaults apply when local storage cannot be accessed.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(themeKey, theme);
    } catch {
      // Persistence is optional in this free demonstration.
    }
  }, [theme]);

  return (
    <ThemeProvider
      theme={theme}
      onThemeChange={(next) => {
        if (isLocalTheme(next)) setTheme(next);
      }}
    >
      <Dashboard
        variant='standalone'
        theme={theme}
        onThemeChange={(next) => {
          if (isLocalTheme(next)) setTheme(next);
        }}
      />
    </ThemeProvider>
  );
}
