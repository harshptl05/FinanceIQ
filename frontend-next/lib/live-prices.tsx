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

import { isMutualFund } from './funds';

/**
 * Global store of "live" simulated prices, keyed by ticker.
 *
 * The MarketChart component pushes a fresh close price here every tick
 * (every 2 seconds by default). usePortfolioData consumes this map and
 * overlays it onto holdings so that:
 *   - holding.current_price reflects the simulated tick
 *   - holding.current_value = shares * tick price
 *   - summary.total_value re-aggregates from the overlaid holdings
 *
 * Net effect: the dashboard P&L, total value, allocation %, etc. all
 * tick live alongside the chart, even on weekends with no real market
 * data — exactly what the hackathon demo needs.
 */

type LivePrices = Record<string, number>;

type LivePricesContextValue = {
  prices: LivePrices;
  setPrice: (ticker: string, price: number) => void;
  /** Toggle simulation on/off globally. When false, overlay is bypassed. */
  isLive: boolean;
  setIsLive: (b: boolean) => void;
  /** Wall-clock of the most recent tick — handy for "Live · 2s ago" UI. */
  lastTickAt: number | null;
};

const LivePricesContext = createContext<LivePricesContextValue | null>(null);

const NOOP_VALUE: LivePricesContextValue = {
  prices: {},
  setPrice: () => {},
  isLive: false,
  setIsLive: () => {},
  lastTickAt: null,
};

export function LivePricesProvider({ children }: { children: ReactNode }) {
  const [prices, setPrices] = useState<LivePrices>({});
  const [isLive, setIsLive] = useState<boolean>(true);
  const [lastTickAt, setLastTickAt] = useState<number | null>(null);

  const setPrice = useCallback((ticker: string, price: number) => {
    if (!ticker || !Number.isFinite(price) || price <= 0) return;
    // Mutual funds price ONCE per day (NAV @ 4pm ET). Pretending they
    // tick second-by-second would be inaccurate and erode demo trust —
    // skip the live overlay for them and let the last-known price stand.
    if (isMutualFund(ticker)) return;
    setPrices((prev) => {
      // Round to 4 decimals to avoid floating-point churn when comparing.
      const rounded = Math.round(price * 10000) / 10000;
      if (prev[ticker] === rounded) return prev;
      return { ...prev, [ticker]: rounded };
    });
    setLastTickAt(Date.now());
  }, []);

  const value = useMemo(
    () => ({ prices, setPrice, isLive, setIsLive, lastTickAt }),
    [prices, setPrice, isLive, lastTickAt],
  );

  return (
    <LivePricesContext.Provider value={value}>
      {children}
    </LivePricesContext.Provider>
  );
}

export function useLivePrices(): LivePricesContextValue {
  return useContext(LivePricesContext) ?? NOOP_VALUE;
}

/** Returns the current live price for a single ticker (or undefined). */
export function useLivePrice(ticker: string): number | undefined {
  const { prices, isLive } = useLivePrices();
  return isLive ? prices[ticker] : undefined;
}

/** Convenience for components that just need a stable setter (e.g. a chart
 *  rendered in a useEffect that shouldn't re-init when context value changes). */
export function useStableSetPrice(): (ticker: string, price: number) => void {
  const { setPrice } = useLivePrices();
  // Stable identity already (wrapped in useCallback), but adding a layer
  // here lets callers pull just the setter without re-rendering on every
  // price change.
  const ref = useState(() => ({ current: setPrice }))[0];
  useEffect(() => {
    ref.current = setPrice;
  }, [setPrice, ref]);
  return useCallback((ticker: string, price: number) => ref.current(ticker, price), [ref]);
}
