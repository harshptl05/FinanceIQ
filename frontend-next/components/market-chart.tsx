'use client';

import { useEffect, useRef } from 'react';
import {
  ColorType,
  CandlestickSeries,
  LineSeries,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import {
  generateNextCandle,
  generateSyntheticHistory,
  volatilityFor,
  type Candle,
} from '@/lib/market-data';
import { useLivePrices, useStableSetPrice } from '@/lib/live-prices';
import { useChartMode } from '@/lib/chart-mode';
import { navHistory } from '@/lib/funds';

export type MarketChartKind = 'candlestick' | 'line';
export type MarketChartMode = 'live' | 'daily-nav';

interface Props {
  ticker: string;
  /** Anchor price for the random walk. Pass holding.current_price. */
  basePrice: number;
  /** Color tinting (line series + accent). Defaults to indigo. */
  color?: string;
  /** us_stocks | bonds | cash | … — drives the volatility tuning. */
  assetClass?: string | null;
  height?: number;
  /** ms between live ticks. Default 2000 (2s) to match the spec.
   *  Ignored in 'daily-nav' mode. */
  intervalMs?: number;
  /** Number of historical bars to seed the chart with. */
  historyBars?: number;
  /** Seconds per bar — controls the time axis resolution.
   *  60 = 1m candles, 600 = 10m, 3600 = 1h, 86400 = 1d. The simulated
   *  tick loop also advances by this amount each interval. */
  barSec?: number;
  /** Per-chart override. If omitted, the chart follows the global
   *  ChartModeProvider toggle (which is what brokerages do). Mutual
   *  funds and cash holdings are always rendered as a line, regardless
   *  of this prop or the global setting, because they don't have an
   *  OHLC source. */
  kind?: MarketChartKind;
  /** "live" for stocks/ETFs (intraday ticking), "daily-nav" for mutual
   *  funds (90-day NAV history, no ticking, day-resolution x-axis). */
  mode?: MarketChartMode;
  /** Optional fund category to tune NAV walk volatility. Only used in
   *  'daily-nav' mode. */
  fundCategory?: string | null;
  /** Receive each new tick — handy for parent-side animations. */
  onTick?: (price: number) => void;
}

/**
 * Reusable lightweight-charts wrapper.
 *
 *  • Seeds a chart with synthetic history on mount.
 *  • Pushes a fresh OHLC bar every `intervalMs` via series.update() — which
 *    appends a new bar (or updates the latest if the timestamp matches).
 *  • Mirrors each new close to the global LivePricesProvider so the
 *    portfolio P&L / total value re-aggregate automatically.
 *  • Cleans up: clearInterval + ResizeObserver.disconnect + chart.remove()
 *    so HMR doesn't leak intervals or duplicated canvases.
 */
export function MarketChart({
  ticker,
  basePrice,
  color = '#6366F1',
  assetClass,
  height = 260,
  intervalMs = 2000,
  historyBars = 180,
  barSec = 60,
  kind,
  mode = 'live',
  fundCategory,
  onTick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onTickRef = useRef<typeof onTick>(undefined);
  onTickRef.current = onTick;

  const setLivePrice = useStableSetPrice();
  const { resetBase } = useLivePrices();
  const globalChartKind = useChartMode().kind;

  // Effective render kind, computed once per render.
  // Precedence:
  //   1. assetClass === 'cash' (money-market) → ALWAYS line, since it's
  //      legitimately flat at $1.00 — candle bars would be a single tick
  //      thick and convey no information
  //   2. otherwise → explicit `kind` prop, else global ChartModeProvider
  //
  // Note: regular mutual funds (mode === 'daily-nav' but assetClass != cash)
  // can render as candle now — we synthesise daily OHLC bars from the
  // same generator stocks use, just at a 1d resolution and without
  // ticking. This matches what brokerages do for fund pages.
  const isLockedToLine = assetClass === 'cash';
  const effectiveKind: MarketChartKind = isLockedToLine
    ? 'line'
    : (kind ?? (globalChartKind === 'candle' ? 'candlestick' : 'line'));

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !ticker || basePrice <= 0) return;

    // Mutual fund mode: line series, day resolution, no live ticks.
    const isDailyNav = mode === 'daily-nav';

    const vol = volatilityFor(assetClass);

    const chart: IChartApi = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6b7280',
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(229,231,235,0.6)' },
        horzLines: { color: 'rgba(229,231,235,0.6)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(229,231,235,1)',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: 'rgba(229,231,235,1)',
        // Mutual funds price daily — show day labels, not seconds/minutes.
        timeVisible: !isDailyNav,
        secondsVisible: false,
        rightOffset: 4,
      },
      crosshair: {
        mode: 0,
        vertLine: { color: 'rgba(99,102,241,0.4)', labelBackgroundColor: color },
        horzLine: { color: 'rgba(99,102,241,0.4)', labelBackgroundColor: color },
      },
    });

    // effectiveKind is computed at the top of the component so the effect
    // can re-run when the global chart-mode toggle flips. Mutual funds and
    // cash are guaranteed to be 'line' here (the lock-to-line check above
    // is applied identically).
    let series: ISeriesApi<'Candlestick'> | ISeriesApi<'Line'>;
    if (effectiveKind === 'candlestick') {
      series = chart.addSeries(CandlestickSeries, {
        upColor: '#10b981',
        downColor: '#ef4444',
        borderUpColor: '#10b981',
        borderDownColor: '#ef4444',
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      });
    } else {
      series = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        priceLineVisible: true,
        priceLineColor: color,
        priceLineWidth: 1,
        priceLineStyle: 2,
      });
    }

    if (isDailyNav) {
      // Daily NAV history — 90 calendar days, deterministic walk. No
      // setInterval here: real mutual funds price once per day and the
      // demo respects that.
      if (effectiveKind === 'line') {
        const navData = navHistory(
          ticker,
          fundCategory ?? null,
          basePrice,
          90,
          assetClass,
        );
        const data: LineData[] = navData.map((d) => ({
          time: d.time as Time,
          value: d.value,
        }));
        (series as ISeriesApi<'Line'>).setData(data);
      } else {
        // Candle view of a mutual fund: synthesise 90 daily OHLC bars
        // using the same trended generator stocks use, then render. The
        // last close lands exactly on basePrice and the leftmost open
        // lines up with our `periodStartPriceFor` formula, so the
        // headline % matches the chart byte-for-byte.
        const dailyHistory = generateSyntheticHistory(
          ticker,
          basePrice,
          90,
          vol,
          86400,
        );
        const data: CandlestickData[] = dailyHistory.map((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        (series as ISeriesApi<'Candlestick'>).setData(data);
      }
      chart.timeScale().fitContent();

      // Mirror the latest NAV to the live-prices store. Note: live-prices
      // skips writes for mutual funds anyway (NAV is once/day) — this is
      // a no-op safeguard.
      setLivePrice(ticker, basePrice);
      onTickRef.current?.(basePrice);

      const ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        chart.applyOptions({
          width: Math.floor(entry.contentRect.width),
          height,
        });
      });
      ro.observe(container);

      // No setInterval: NAV updates daily, not every 2 seconds.
      return () => {
        ro.disconnect();
        chart.remove();
      };
    }

    // Live mode (stocks / ETFs / cash) — ticking 2s candles or line.
    const history: Candle[] = generateSyntheticHistory(
      ticker,
      basePrice,
      historyBars,
      vol,
      barSec,
    );

    // Re-anchor the "since open" base for this ticker. Switching the period
    // re-mounts the chart (key changes upstream); resetting here means the
    // next setLivePrice call captures a fresh anchor that aligns with the
    // newly-displayed period start.
    resetBase(ticker);

    if (effectiveKind === 'candlestick') {
      const data: CandlestickData[] = history.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      (series as ISeriesApi<'Candlestick'>).setData(data);
    } else {
      const data: LineData[] = history.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.close,
      }));
      (series as ISeriesApi<'Line'>).setData(data);
    }

    chart.timeScale().fitContent();

    let lastCandle: Candle = history[history.length - 1] ?? {
      time: Math.floor(Date.now() / 1000),
      open: basePrice,
      high: basePrice,
      low: basePrice,
      close: basePrice,
    };

    setLivePrice(ticker, lastCandle.close);
    onTickRef.current?.(lastCandle.close);

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      chart.applyOptions({
        width: Math.floor(entry.contentRect.width),
        height,
      });
    });
    ro.observe(container);

    const interval = setInterval(() => {
      const next = generateNextCandle(lastCandle, vol, barSec);
      if (effectiveKind === 'candlestick') {
        (series as ISeriesApi<'Candlestick'>).update({
          time: next.time as UTCTimestamp,
          open: next.open,
          high: next.high,
          low: next.low,
          close: next.close,
        });
      } else {
        (series as ISeriesApi<'Line'>).update({
          time: next.time as UTCTimestamp,
          value: next.close,
        });
      }
      lastCandle = next;
      setLivePrice(ticker, next.close);
      onTickRef.current?.(next.close);
    }, intervalMs);

    return () => {
      clearInterval(interval);
      ro.disconnect();
      chart.remove();
    };
    // setLivePrice / resetBase are stable; deliberately omitted to avoid re-init.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ticker,
    basePrice,
    color,
    assetClass,
    height,
    intervalMs,
    historyBars,
    barSec,
    effectiveKind,
    mode,
    fundCategory,
  ]);

  return (
    <div
      ref={containerRef}
      className="w-full"
      style={{ height }}
      aria-label={`${ticker} live chart`}
    />
  );
}

// Re-export the Time type so callers don't have to import lightweight-charts
// directly when wiring up custom series.
export type { Time };
