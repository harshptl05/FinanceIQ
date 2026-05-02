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
import { useStableSetPrice } from '@/lib/live-prices';

export type MarketChartKind = 'candlestick' | 'line';

interface Props {
  ticker: string;
  /** Anchor price for the random walk. Pass holding.current_price. */
  basePrice: number;
  /** Color tinting (line series + accent). Defaults to indigo. */
  color?: string;
  /** us_stocks | bonds | cash | … — drives the volatility tuning. */
  assetClass?: string | null;
  height?: number;
  /** ms between live ticks. Default 2000 (2s) to match the spec. */
  intervalMs?: number;
  /** Number of historical bars to seed the chart with. */
  historyBars?: number;
  /** "candlestick" for stocks, "line" for cash / money-market funds. */
  kind?: MarketChartKind;
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
  kind = 'candlestick',
  onTick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onTickRef = useRef<typeof onTick>(undefined);
  onTickRef.current = onTick;

  const setLivePrice = useStableSetPrice();

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !ticker || basePrice <= 0) return;

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
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
      },
      crosshair: {
        mode: 0, // Magnet
        vertLine: { color: 'rgba(99,102,241,0.4)', labelBackgroundColor: color },
        horzLine: { color: 'rgba(99,102,241,0.4)', labelBackgroundColor: color },
      },
    });

    let series: ISeriesApi<'Candlestick'> | ISeriesApi<'Line'>;
    if (kind === 'candlestick') {
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
        priceLineStyle: 2, // dashed
      });
    }

    const history: Candle[] = generateSyntheticHistory(
      ticker,
      basePrice,
      historyBars,
      vol,
    );

    if (kind === 'candlestick') {
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

    // Resize handling — track the container and feed widths to applyOptions.
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      chart.applyOptions({
        width: Math.floor(entry.contentRect.width),
        height,
      });
    });
    ro.observe(container);

    // Tick loop — every `intervalMs`, append a fresh bar.
    const interval = setInterval(() => {
      const next = generateNextCandle(lastCandle, vol);
      if (kind === 'candlestick') {
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
    // We deliberately do NOT include setLivePrice in deps — it's stable
    // already and listing it would re-init the chart on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, basePrice, color, assetClass, height, intervalMs, historyBars, kind]);

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
