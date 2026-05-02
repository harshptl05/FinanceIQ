'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  Loader2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TickerLogo } from '@/components/ticker-logo';
import { api, type TradeAction } from '@/lib/api';
import { fmtMoney } from '@/lib/format';
import { isMutualFund } from '@/lib/funds';
import { useLivePrices } from '@/lib/live-prices';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticker: string;
  name: string;
  /** API / on-load price for the ticker. The dialog also consults the live
   *  tick store so the displayed quote stays current while open. */
  apiPrice: number;
  assetClass?: string;
  /** Owned shares (0 means "you don't own this — only show buy"). */
  ownedShares: number;
  /** Initial action when the dialog opens. */
  defaultAction?: TradeAction;
  /** Optional brand color so the trade modal matches the source row/chart. */
  color?: string;
  /** Called after a successful trade so the parent can refresh state. */
  onTraded?: (action: TradeAction, ticker: string, shares: number) => void;
};

const QUICK_PRESETS_BUY = [1, 5, 10, 25];
const QUICK_PRESETS_SELL_PCT = [25, 50, 75, 100];

/**
 * Buy / sell dialog used everywhere a holding is interactable: stock detail
 * dialog, My Assets list rows, and search-result quote view.
 *
 * Design notes:
 *  • The displayed quote uses live ticks while open so the total auto-updates
 *    while markets / our simulator move. Mutual funds use NAV (no ticks).
 *  • "Sell" is hidden when ownedShares == 0 (i.e. discovery flow from search).
 *  • "Sell 100%" is a one-tap shortcut to close out the position.
 *  • We pass the *on-screen* price to the trade endpoint so the cost basis
 *    matches what the user just confirmed, even if yfinance is rate-limited.
 */
export function TradeDialog({
  open,
  onOpenChange,
  ticker,
  name,
  apiPrice,
  assetClass,
  ownedShares,
  defaultAction = 'buy',
  color = '#6366F1',
  onTraded,
}: Props) {
  const isFund = isMutualFund(ticker, assetClass ?? null);
  const owns = ownedShares > 0;

  const [action, setAction] = useState<TradeAction>(
    owns ? defaultAction : 'buy',
  );
  const [shares, setShares] = useState<string>('1');
  const [submitting, setSubmitting] = useState(false);

  // Reset every time the dialog opens or pivots to a different ticker.
  useEffect(() => {
    if (!open) return;
    setAction(owns ? defaultAction : 'buy');
    setShares('1');
  }, [open, ticker, defaultAction, owns]);

  // Live tick overlay — the displayed quote moves while the modal is open
  // (matches the chart on the page behind it). Mutual funds skip this in
  // the live-prices store, so they fall through to apiPrice / NAV.
  const { prices } = useLivePrices();
  const livePrice = prices[ticker] ?? apiPrice;
  const price = livePrice > 0 ? livePrice : apiPrice;

  const sharesNum = useMemo(() => {
    const v = Number(shares);
    return Number.isFinite(v) && v > 0 ? v : 0;
  }, [shares]);

  const total = useMemo(() => price * sharesNum, [price, sharesNum]);

  // Sell-side validation: never let the user request more than they own.
  const overSell =
    action === 'sell' && sharesNum > ownedShares + 1e-6;

  const canSubmit = sharesNum > 0 && !overSell && !submitting && price > 0;

  const handlePreset = (val: number, kind: 'shares' | 'pct') => {
    if (kind === 'shares') {
      setShares(String(val));
      return;
    }
    // sell percentage
    const target = ownedShares * (val / 100);
    // Use up to 4 decimals — matches the holdings.shares precision we store.
    const rounded = Math.max(
      0,
      Math.min(ownedShares, Math.round(target * 10000) / 10000),
    );
    setShares(String(rounded));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const resp = await api.holdings.trade({
        ticker,
        action,
        shares: sharesNum,
        price,
        name,
        asset_class: assetClass,
      });
      const totalDollars = resp.total ?? total;
      const verb =
        action === 'buy' ? 'Bought' : resp.closed ? 'Sold (closed)' : 'Sold';
      toast.success(
        `${verb} ${sharesNum.toLocaleString('en-US', {
          maximumFractionDigits: 4,
        })} ${ticker}`,
        {
          description: `${fmtMoney(price)} per share · total ${fmtMoney(totalDollars)}`,
        },
      );
      onTraded?.(action, ticker, sharesNum);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Trade failed';
      toast.error('Trade failed', {
        description: msg.length > 200 ? msg.slice(0, 200) + '…' : msg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <TickerLogo
              ticker={ticker}
              color={color}
              size="lg"
              rounded="lg"
            />
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg">{ticker}</DialogTitle>
              <p className="text-sm text-gray-500 truncate">{name}</p>
            </div>
          </div>
        </DialogHeader>

        {/* Live quote */}
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 mt-3">
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
              {isFund ? 'Last NAV' : 'Live price'}
            </p>
            {isFund ? (
              <span className="text-[10px] flex items-center gap-1 text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-full font-medium">
                <Clock className="w-2.5 h-2.5" /> daily
              </span>
            ) : (
              <span className="text-[10px] flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                live
              </span>
            )}
          </div>
          <p className="text-2xl font-bold tabular-nums mt-1">
            {price > 0 ? fmtMoney(price) : '—'}
          </p>
          {owns && (
            <p className="text-xs text-gray-500 mt-1.5">
              You hold{' '}
              <span className="font-semibold text-gray-900 tabular-nums">
                {ownedShares.toLocaleString('en-US', {
                  maximumFractionDigits: 4,
                })}
              </span>{' '}
              shares · position{' '}
              <span className="font-semibold text-gray-900 tabular-nums">
                {fmtMoney(ownedShares * price)}
              </span>
            </p>
          )}
        </div>

        {/* Buy / Sell toggle */}
        {owns ? (
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              type="button"
              onClick={() => setAction('buy')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition ${
                action === 'buy'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
              }`}
            >
              <ArrowDownToLine className="w-4 h-4" />
              Buy
            </button>
            <button
              type="button"
              onClick={() => setAction('sell')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition ${
                action === 'sell'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
              }`}
            >
              <ArrowUpFromLine className="w-4 h-4" />
              Sell
            </button>
          </div>
        ) : (
          <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5 text-xs text-emerald-800 flex items-center gap-2">
            <ArrowDownToLine className="w-4 h-4 shrink-0" />
            You don&apos;t own {ticker} yet — this trade will create a new
            position.
          </div>
        )}

        {/* Shares input */}
        <div className="mt-4">
          <label
            htmlFor="trade-shares"
            className="block text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-1.5"
          >
            {action === 'buy' ? 'Shares to buy' : 'Shares to sell'}
          </label>
          <div className="relative">
            <input
              id="trade-shares"
              type="number"
              min="0"
              step="0.0001"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              className={`w-full rounded-xl border px-3 py-2.5 text-base font-semibold tabular-nums focus:outline-none focus:ring-2 transition ${
                overSell
                  ? 'border-rose-300 focus:ring-rose-100 text-rose-700'
                  : 'border-gray-200 focus:ring-indigo-100 focus:border-indigo-400'
              }`}
              placeholder="0"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">
              shares
            </span>
          </div>
          {overSell && (
            <p className="text-[11px] text-rose-600 mt-1">
              You only own {ownedShares} shares of {ticker}.
            </p>
          )}

          {/* Quick presets — buy uses absolute share counts, sell uses % of position. */}
          {action === 'buy' ? (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {QUICK_PRESETS_BUY.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handlePreset(n, 'shares')}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition"
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  // 100 USD-worth, rounded to 4 decimals
                  if (price > 0) {
                    setShares(String(Math.round((100 / price) * 10000) / 10000));
                  }
                }}
                className="text-[11px] px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold transition"
              >
                ≈$100
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {QUICK_PRESETS_SELL_PCT.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePreset(p, 'pct')}
                  className={`text-[11px] px-2.5 py-1 rounded-full font-semibold transition ${
                    p === 100
                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-100'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {p === 100 ? 'Sell all' : `${p}%`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Total preview */}
        <div className="mt-4 rounded-xl border border-gray-100 bg-white p-3">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {sharesNum.toLocaleString('en-US', {
                maximumFractionDigits: 4,
              })}{' '}
              × {fmtMoney(price)}
            </span>
            <span className="uppercase tracking-wider font-semibold">
              {action === 'buy' ? 'You pay' : 'You receive'}
            </span>
          </div>
          <p
            className={`text-2xl font-bold tabular-nums mt-1 ${
              action === 'buy' ? 'text-gray-900' : 'text-emerald-700'
            }`}
          >
            {fmtMoney(total)}
          </p>
        </div>

        {isFund && (
          <p className="mt-3 text-[11px] text-indigo-700 bg-indigo-50/60 border border-indigo-100 rounded-lg px-3 py-2 flex items-start gap-1.5">
            <Clock className="w-3 h-3 mt-0.5 shrink-0" />
            <span>
              Real mutual fund orders execute at the next 4:00 PM ET NAV close.
              In this demo they apply immediately at the latest NAV.
            </span>
          </p>
        )}

        <div className="flex items-center gap-2 mt-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex-1 rounded-xl border border-gray-200 hover:bg-gray-50 text-sm font-semibold py-2.5 text-gray-700 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`flex-1 rounded-xl text-sm font-semibold py-2.5 text-white transition flex items-center justify-center gap-2 ${
              action === 'buy'
                ? 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300'
                : 'bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300'
            }`}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : action === 'buy' ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            Confirm {action === 'buy' ? 'buy' : 'sell'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
