'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

type VisionTheme = 'dark' | 'light';

const STORAGE_KEY = 'vision-theme';

export function ThemeToggle() {
  const [theme, setTheme] = useState<VisionTheme>('dark');

  // localStorage is the source of truth, re-applied on every mount. The layout's
  // inline FOUC script only runs on a full page load; on a client-side nav back
  // into /vision the layout re-mounts with its server-default "dark" attribute
  // and that script never re-executes — so we must re-read storage here and
  // correct the DOM, otherwise the theme silently resets to dark.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* localStorage blocked (private mode etc.) — fall back to the default */
    }
    const resolved: VisionTheme = stored === 'light' || stored === 'dark' ? stored : 'dark';
    document.getElementById('main-content')?.setAttribute('data-vision-theme', resolved);
    setTheme(resolved);
  }, []);

  function toggle() {
    const next: VisionTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.getElementById('main-content')?.setAttribute('data-vision-theme', next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      data-vision-magnet
      aria-pressed={theme === 'light'}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgb(var(--v-gold)/0.4)] text-[rgb(var(--v-gold))] transition-colors hover:border-[rgb(var(--v-gold))]"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}
