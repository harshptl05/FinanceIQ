'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChartLine,
  Loader2,
  Search,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TickerLogo } from '@/components/ticker-logo';
import { TickerPreviewDialog } from '@/components/ticker-preview-dialog';
import { api, type Holding, type SearchResult } from '@/lib/api';
import { fmtMoney, fmtPct, assetLabel, assetColor } from '@/lib/format';
import { searchCuratedLocal } from '@/lib/curated-tickers';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** User's holdings — used to mark "owned" badges and to prefill the trade
   *  modal with current share counts (so buy adds to position, sell works). */
  holdings: Holding[];
  /** Called after a successful trade so the parent can refresh portfolio data. */
  onTraded?: () => void | Promise<void>;
};

/**
 * Universal search-and-trade palette.
 *
 *  • Debounced query against /api/search (~300ms)
 *  • Renders a single-column result list with logo · ticker · name · price
 *  • Click a row → opens TradeDialog pre-loaded for that ticker
 *
 * Notes:
 *  - Yahoo's search returns prices only for the *top* result inline; the
 *    rest come back without a price, and we lazy-fetch via /api/search/quote
 *    the moment the user clicks a row. The TradeDialog re-checks live ticks
 *    too, so the displayed quote stays accurate while the modal is open.
 *  - We skip cross-listed foreign tickers (containing ".") server-side.
 */
export function GlobalSearch({
  open,
  onOpenChange,
  holdings,
  onTraded,
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqIdRef = useRef(0);

  // The result the user clicked — drives the preview dialog. The preview
  // dialog itself owns the Buy/Sell flow via TradeDialog, so we no longer
  // open TradeDialog from here directly.
  const [previewPick, setPreviewPick] = useState<SearchResult | null>(null);

  // Owned tickers map for quick lookup
  const ownedByTicker = useMemo(() => {
    const m = new Map<string, Holding>();
    for (const h of holdings) m.set(h.ticker.toUpperCase(), h);
    return m;
  }, [holdings]);

  // Auto-focus input on open + reset state when closing.
  useEffect(() => {
    if (open) {
      // Slight delay so the dialog mount finishes before focus.
      const id = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(id);
    }
    setQuery('');
    setResults([]);
    setError(null);
  }, [open]);

  // Debounced search — last-write-wins via the request id ref so a slow
  // earlier response can't clobber the latest one.
  //
  // Two-stage rendering for instant feedback:
  //   Stage 1: synchronously render results from the local curated
  //            shortlist (no network). META/AAPL/etc. show up the
  //            instant the user finishes typing.
  //   Stage 2: fire the backend search in parallel; merge richer
  //            results (live prices, niche tickers) on top of the
  //            local list. If the backend 401s or errors, the user
  //            still has the local matches in hand.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    // Stage 1 — instant local results from the bundled curated list.
    const local = searchCuratedLocal(q, 6).map<SearchResult>((row) => ({
      ticker: row.ticker,
      name: row.name,
      asset_class: row.asset_class,
      quote_type: row.quote_type,
      is_mutual_fund: row.quote_type === 'mutualfund',
      current_price: null,
      previous_close: null,
      day_change_pct: null,
      exchange: null,
    }));
    setResults(local);
    setError(null);

    const id = ++reqIdRef.current;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const resp = await api.search.query(q);
        if (reqIdRef.current !== id) return;
        const apiRows = resp.results ?? [];
        // Merge: API rows take priority (they have prices), then any
        // local rows the API missed (rare — only happens on 5xx etc.).
        const apiTickers = new Set(apiRows.map((r) => r.ticker.toUpperCase()));
        const merged = [
          ...apiRows,
          ...local.filter((r) => !apiTickers.has(r.ticker.toUpperCase())),
        ];
        setResults(merged);
      } catch (e) {
        if (reqIdRef.current !== id) return;
        // Network / 401 / 5xx — keep the local results so the user can
        // still trade common tickers. Show a soft hint, not a wall.
        const msg = e instanceof Error ? e.message : 'Search failed';
        const isAuth =
          /401|unauthor|missing token|invalid token/i.test(msg);
        setError(
          isAuth
            ? 'Sign in expired — refresh the page to keep searching.'
            : null, // for other errors, silently fall back to local
        );
      } finally {
        if (reqIdRef.current === id) setLoading(false);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query, open]);

  const handlePick = (r: SearchResult) => {
    // Open the preview immediately — the preview dialog itself lazy-loads
    // the full quote when needed, so the user gets instant feedback on
    // click instead of waiting on a network round-trip.
    setPreviewPick(r);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
          {/* a11y: keep DialogTitle present but visually hide it */}
          <DialogHeader className="sr-only">
            <DialogTitle>Search stocks and mutual funds</DialogTitle>
          </DialogHeader>

          {/* Search input row — pr keeps the esc hint clear of the dialog's default X */}
          <div className="flex items-center gap-3 px-4 py-3 pr-10 border-b border-gray-100">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search any stock or fund — try AAPL, vanguard 500, or contrafund"
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400"
              autoComplete="off"
              spellCheck={false}
            />
            {loading && (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400 shrink-0" />
            )}
            <kbd className="hidden sm:inline text-[10px] font-medium text-gray-400 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded">
              esc
            </kbd>
          </div>

          {/* Results / states */}
          <div className="max-h-[60vh] overflow-y-auto">
            {error && (
              <div className="mx-4 mt-3 px-3 py-2 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg">
                {error}
              </div>
            )}

            {!loading && query.trim() === '' && (
              <div className="px-4 py-8 text-center text-xs text-gray-400">
                <p className="text-gray-500 font-medium mb-3">
                  Type a ticker or company name to get started.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px]">
                  {['AAPL', 'VFIAX', 'NVDA', 'FCNTX', 'BND'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setQuery(t)}
                      className="px-2 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!loading && query.trim() !== '' && results.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                <p>
                  No matches for{' '}
                  <span className="font-semibold">{query}</span>.
                </p>
                <p className="text-[11px] text-gray-400 mt-1">
                  Try a ticker symbol like AAPL, NVDA, or VFIAX.
                </p>
              </div>
            )}

            {results.length > 0 && (
              <ul className="py-1">
                {results.map((r) => {
                  const owned = ownedByTicker.get(r.ticker.toUpperCase());
                  const dayChange = Number(r.day_change_pct ?? 0);
                  return (
                    <li key={r.ticker}>
                      <button
                        type="button"
                        onClick={() => handlePick(r)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-left"
                      >
                        <TickerLogo
                          ticker={r.ticker}
                          color={assetColor(r.asset_class)}
                          size="md"
                          rounded="lg"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold">
                              {r.ticker}
                            </span>
                            {r.is_mutual_fund && (
                              <span className="text-[9px] px-1.5 py-px rounded bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold tracking-wider">
                                MF
                              </span>
                            )}
                            {(r.quote_type ?? '').toLowerCase() === 'etf' && (
                              <span className="text-[9px] px-1.5 py-px rounded bg-sky-50 text-sky-700 border border-sky-100 font-semibold tracking-wider">
                                ETF
                              </span>
                            )}
                            {owned && (
                              <span className="text-[9px] px-1.5 py-px rounded bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold tracking-wider">
                                OWNED
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {r.name}
                            {r.exchange && (
                              <>
                                {' · '}
                                <span className="text-gray-400">
                                  {r.exchange}
                                </span>
                              </>
                            )}
                            {' · '}
                            <span style={{ color: assetColor(r.asset_class) }}>
                              {assetLabel(r.asset_class)}
                            </span>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold tabular-nums">
                            {r.current_price && r.current_price > 0
                              ? fmtMoney(r.current_price)
                              : '—'}
                          </p>
                          {Math.abs(dayChange) > 0.005 ? (
                            <p
                              className={`text-[11px] font-medium flex items-center justify-end gap-0.5 ${
                                dayChange >= 0
                                  ? 'text-emerald-600'
                                  : 'text-rose-500'
                              }`}
                            >
                              {dayChange >= 0 ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : (
                                <TrendingDown className="w-3 h-3" />
                              )}
                              {fmtPct(dayChange, {
                                withSign: true,
                                decimals: 2,
                              })}
                            </p>
                          ) : (
                            <p className="text-[11px] text-gray-400 flex items-center justify-end gap-0.5">
                              <ChartLine className="w-3 h-3" /> view
                            </p>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview dialog: shows the live chart + Buy/Sell. Closing it leaves
          the search palette open so the user can keep exploring. */}
      <TickerPreviewDialog
        open={!!previewPick}
        onOpenChange={(o) => !o && setPreviewPick(null)}
        result={previewPick}
        ownedHolding={
          previewPick
            ? ownedByTicker.get(previewPick.ticker.toUpperCase()) ?? null
            : null
        }
        onTraded={async () => {
          setPreviewPick(null);
          onOpenChange(false);
          await Promise.resolve(onTraded?.());
        }}
      />
    </>
  );
}
