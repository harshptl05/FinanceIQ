'use client';

/**
 * ThemeProvider — single source of truth for the app's light/dark mode.
 *
 * Persists the user's choice to localStorage and toggles the `dark` class
 * on <html>. The actual color shifts are driven by:
 *   1. CSS variables in app/globals.css (already present)
 *   2. A `.dark` overlay layer that retargets the most-used hardcoded
 *      Tailwind classes (bg-white, text-gray-*, etc) so we don't have to
 *      sprinkle `dark:` variants across every single component file.
 *
 * Three modes:
 *   - 'light'  — always light
 *   - 'dark'   — always dark
 *   - 'system' — follows OS prefers-color-scheme, updates live when it changes
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'financeiq-theme';

interface ThemeContextValue {
  /** What the user explicitly chose (or 'system' by default). */
  preference: ThemePreference;
  /** What's actually rendering after resolving 'system'. */
  resolved: ResolvedTheme;
  /** Persist a new preference. */
  setPreference: (next: ThemePreference) => void;
  /** Quick helper for the header toggle button. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function readStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  return 'system';
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyResolved(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  // Helps the browser pick the right native form widgets (scrollbars,
  // text selection color, native picker chrome).
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // SSR-safe initial state — overwritten on mount by the inline script in
  // app/layout.tsx, which runs BEFORE hydration to prevent flash.
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [resolved, setResolved] = useState<ResolvedTheme>('light');

  // Sync the React state with whatever the inline pre-hydration script set.
  useEffect(() => {
    const stored = readStoredPreference();
    setPreferenceState(stored);
    const r: ResolvedTheme =
      stored === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : stored;
    setResolved(r);
    applyResolved(r);
  }, []);

  // Live-watch system preference when in 'system' mode.
  useEffect(() => {
    if (preference !== 'system') return;
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const next: ResolvedTheme = e.matches ? 'dark' : 'light';
      setResolved(next);
      applyResolved(next);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
    const r: ResolvedTheme =
      next === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : next;
    setResolved(r);
    applyResolved(r);
  }, []);

  const toggle = useCallback(() => {
    // Quick toggle ignores 'system' — flips between light and dark.
    setPreference(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference, toggle }),
    [preference, resolved, setPreference, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

/**
 * The exact JS we inline in <head> to set the right theme BEFORE the React
 * tree hydrates. Without this, dark-mode users get a single bright white
 * frame on first paint.
 */
export const THEME_PRELOAD_SCRIPT = `(() => {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var pref = (stored === 'light' || stored === 'dark' || stored === 'system') ? stored : 'system';
    var dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    if (dark) root.classList.add('dark'); else root.classList.remove('dark');
    root.style.colorScheme = dark ? 'dark' : 'light';
  } catch (_) { /* SSR or storage blocked */ }
})();`;
