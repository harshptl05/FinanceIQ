'use client';

import { useMemo, useState } from 'react';
import { domainLogoUrl, tickerIssuerDomain, tickerLogoUrl } from '@/lib/logos';

type Size = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_PX: Record<Size, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
};

const PIX_FOR_API: Record<Size, 64 | 96 | 128 | 200> = {
  xs: 64,
  sm: 64,
  md: 96,
  lg: 128,
};

interface Props {
  ticker: string;
  /** Tailwind background color used as the letter-fallback chip background. */
  color?: string;
  size?: Size;
  className?: string;
  /** Force the letter fallback (used by callers that prefer the colored chip). */
  forceFallback?: boolean;
  rounded?: 'full' | 'lg' | 'md';
}

/**
 * Brand mark for a stock / ETF / mutual-fund ticker via logo.dev.
 *
 * Source order:
 *   1. /ticker/<TICKER>            — works for stocks + ETFs.
 *   2. /<issuer-domain>            — fallback for mutual fund symbols
 *                                    (VFIAX → vanguard.com, FXAIX →
 *                                    fidelity.com, …). logo.dev's ticker
 *                                    endpoint has no fund coverage, but
 *                                    its domain endpoint always serves
 *                                    the issuer's brand mark, which is
 *                                    what brokers actually display.
 *   3. Colored letter chip         — last-resort visual fallback.
 */
export function TickerLogo({
  ticker,
  color = '#6366F1',
  size = 'md',
  className = '',
  forceFallback = false,
  rounded = 'lg',
}: Props) {
  // attempt index: 0 = ticker endpoint, 1 = issuer domain, 2 = letter chip
  const [attempt, setAttempt] = useState(0);
  const px = SIZE_PX[size];
  const radius =
    rounded === 'full' ? 'rounded-full' : rounded === 'md' ? 'rounded-md' : 'rounded-lg';

  const issuerDomain = useMemo(() => tickerIssuerDomain(ticker), [ticker]);

  // If we have an issuer domain we want it as Tier 2; otherwise skip
  // straight to letter chip after Tier 1 fails.
  const maxAttempt = issuerDomain ? 2 : 1;
  const effective = forceFallback ? maxAttempt : Math.min(attempt, maxAttempt);
  const showLetter = effective >= maxAttempt;

  const letter = (ticker || '?').trim().charAt(0).toUpperCase();
  const fontSize = Math.max(11, Math.round(px * 0.42));

  // Pick the URL for the current attempt. Keyed in the JSX to force a
  // proper re-mount when we step from /ticker/ → /domain/, so the
  // browser doesn't try to keep using the broken cached response.
  let src: string | null = null;
  if (!showLetter) {
    if (effective === 0) {
      src = tickerLogoUrl(ticker, PIX_FOR_API[size], 'webp');
    } else if (effective === 1 && issuerDomain) {
      src = domainLogoUrl(issuerDomain, PIX_FOR_API[size], 'webp');
    }
  }

  return (
    <div
      className={`${radius} flex items-center justify-center shrink-0 overflow-hidden ${className}`}
      style={{
        width: px,
        height: px,
        backgroundColor: showLetter ? color : '#fff',
        boxShadow: showLetter ? 'none' : 'inset 0 0 0 1px rgba(0,0,0,0.06)',
      }}
      aria-label={ticker}
      title={ticker}
    >
      {showLetter || !src ? (
        <span
          className="font-bold text-white tracking-tight"
          style={{ fontSize }}
        >
          {letter}
        </span>
      ) : (
        // Plain <img> (we already disable next/image optimization in
        // next.config.mjs) so we can react to onError and step through
        // the source-tier waterfall above.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${ticker}-${effective}`}
          src={src}
          alt={`${ticker} logo`}
          width={px}
          height={px}
          loading="lazy"
          onError={() => setAttempt((n) => n + 1)}
          className="object-contain"
          style={{ width: px, height: px }}
        />
      )}
    </div>
  );
}
