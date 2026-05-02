'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Global chart-style toggle.
 *
 * Most brokerages (Robinhood, Schwab, Fidelity, etc.) let users flip
 * every price chart in the app between candlestick and line at once,
 * not per-chart. We mirror that by parking the choice in a Context
 * provider that any MarketChart can read, and persisting to
 * localStorage so reloads remember it.
 *
 * Notes:
 *  - Some chart contexts can't honour candle mode — mutual funds (daily
 *    NAV, no intraday OHLC) and cash / money-market series. MarketChart
 *    locks those to `line` regardless of this setting.
 *  - The provider gracefully degrades on SSR / no-context callers via
 *    a hardcoded fallback so we never crash.
 */

export type ChartKind = 'candle' | 'line';

type ChartModeContextValue = {
  kind: ChartKind;
  setKind: (kind: ChartKind) => void;
  toggle: () => void;
};

const ChartModeContext = createContext<ChartModeContextValue | null>(null);

const STORAGE_KEY = 'financeiq.chartKind';
const DEFAULT_KIND: ChartKind = 'candle';

export function ChartModeProvider({ children }: { children: ReactNode }) {
  const [kind, setKindState] = useState<ChartKind>(DEFAULT_KIND);

  // Hydrate from localStorage after mount (avoids SSR mismatches).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'candle' || saved === 'line') {
        setKindState(saved);
      }
    } catch {
      // Private mode / quota — silently keep the default.
    }
  }, []);

  const setKind = useCallback((next: ChartKind) => {
    setKindState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => {
    setKindState((prev) => {
      const next: ChartKind = prev === 'candle' ? 'line' : 'candle';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {}
      return next;
    });
  }, []);

  const value = useMemo<ChartModeContextValue>(
    () => ({ kind, setKind, toggle }),
    [kind, setKind, toggle],
  );

  return (
    <ChartModeContext.Provider value={value}>
      {children}
    </ChartModeContext.Provider>
  );
}

export function useChartMode(): ChartModeContextValue {
  const ctx = useContext(ChartModeContext);
  return (
    ctx ?? {
      kind: DEFAULT_KIND,
      setKind: () => {},
      toggle: () => {},
    }
  );
}
