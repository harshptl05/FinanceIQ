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
  /** First simulated tick we ever saw for each ticker — the natural "open"
   *  for a demo session. Used by anything that wants a "since open" %.
   *  `resetBase(ticker)` clears it so the next tick becomes a new anchor. */
  basePrices: LivePrices;
  setPrice: (ticker: string, price: number) => void;
  /** Remove tickers you no longer hold so P&L / movers don't reuse ghost prices. */
  pruneToTickers: (tickers: string[]) => void;
  /** Drop the captured base for a ticker. Call when a chart remounts for
   *  the same ticker so "since open" restarts from the new first tick. */
  resetBase: (ticker: string) => void;
  /** Toggle simulation on/off globally. When false, overlay is bypassed. */
  isLive: boolean;
  setIsLive: (b: boolean) => void;
  /** Wall-clock of the most recent tick — handy for "Live · 2s ago" UI. */
  lastTickAt: number | null;
};

const LivePricesContext = createContext<LivePricesContextValue | null>(null);

const NOOP_VALUE: LivePricesContextValue = {
  prices: {},
  basePrices: {},
  setPrice: () => {},
  pruneToTickers: () => {},
  resetBase: () => {},
  isLive: false,
  setIsLive: () => {},
  lastTickAt: null,
};

export function LivePricesProvider({ children }: { children: ReactNode }) {
  const [prices, setPrices] = useState<LivePrices>({});
  const [basePrices, setBasePrices] = useState<LivePrices>({});
  const [isLive, setIsLive] = useState<boolean>(true);
  const [lastTickAt, setLastTickAt] = useState<number | null>(null);

  const setPrice = useCallback((ticker: string, price: number) => {
    if (!ticker || !Number.isFinite(price) || price <= 0) return;
    // Mutual funds price ONCE per day (NAV @ 4pm ET). Pretending they
    // tick second-by-second would be inaccurate and erode demo trust —
    // skip the live overlay for them and let the last-known price stand.
    if (isMutualFund(ticker)) return;
    const rounded = Math.round(price * 10000) / 10000;
    setPrices((prev) => {
      if (prev[ticker] === rounded) return prev;
      return { ...prev, [ticker]: rounded };
    });
    // Anchor the "open" price the first time we see this ticker. Subsequent
    // ticks don't move the base — that's what gives us a meaningful
    // "since open" percentage even after thousands of ticks.
    setBasePrices((prev) => {
      if (prev[ticker] !== undefined) return prev;
      return { ...prev, [ticker]: rounded };
    });
    setLastTickAt(Date.now());
  }, []);

  const resetBase = useCallback((ticker: string) => {
    if (!ticker) return;
    setBasePrices((prev) => {
      if (prev[ticker] === undefined) return prev;
      const next = { ...prev };
      delete next[ticker];
      return next;
    });
  }, []);

  const pruneToTickers = useCallback((tickers: string[]) => {
    const allowed = new Set(tickers.map((t) => t.toUpperCase()));
    setPrices((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (!allowed.has(k.toUpperCase())) {
          delete next[k];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setBasePrices((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (!allowed.has(k.toUpperCase())) {
          delete next[k];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const value = useMemo(
    () => ({
      prices,
      basePrices,
      setPrice,
      pruneToTickers,
      resetBase,
      isLive,
      setIsLive,
      lastTickAt,
    }),
    [prices, basePrices, setPrice, pruneToTickers, resetBase, isLive, lastTickAt],
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

/** Returns the captured "open" price for a ticker — the first tick we
 *  saw this session. Pair with useLivePrice to compute a live since-open
 *  percentage that actually moves. */
export function useBasePrice(ticker: string): number | undefined {
  const { basePrices } = useLivePrices();
  return basePrices[ticker];
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
