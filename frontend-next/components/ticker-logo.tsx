'use client';

import { useState } from 'react';
import { tickerLogoUrl } from '@/lib/logos';

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
 * Brand mark for a stock / ETF ticker via logo.dev.
 *
 * If the image fails to load (e.g. logo.dev doesn't have it, or the ticker
 * is a mutual-fund symbol), we fall back to a colored letter chip — same
 * style the rest of the app already uses, just unified in one component.
 */
export function TickerLogo({
  ticker,
  color = '#6366F1',
  size = 'md',
  className = '',
  forceFallback = false,
  rounded = 'lg',
}: Props) {
  const [errored, setErrored] = useState(false);
  const px = SIZE_PX[size];
  const radius =
    rounded === 'full' ? 'rounded-full' : rounded === 'md' ? 'rounded-md' : 'rounded-lg';

  const showFallback = forceFallback || errored;
  const letter = (ticker || '?').trim().charAt(0).toUpperCase();
  const fontSize = Math.max(11, Math.round(px * 0.42));

  return (
    <div
      className={`${radius} flex items-center justify-center shrink-0 overflow-hidden ${className}`}
      style={{
        width: px,
        height: px,
        backgroundColor: showFallback ? color : '#fff',
        boxShadow: showFallback ? 'none' : 'inset 0 0 0 1px rgba(0,0,0,0.06)',
      }}
      aria-label={ticker}
      title={ticker}
    >
      {showFallback ? (
        <span
          className="font-bold text-white tracking-tight"
          style={{ fontSize }}
        >
          {letter}
        </span>
      ) : (
        // Plain <img>, not next/image. We already opt out of next/image
        // optimization (next.config.mjs images.unoptimized=true), and we
        // need onError handling to fall back to the letter chip.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={tickerLogoUrl(ticker, PIX_FOR_API[size], 'webp')}
          alt={`${ticker} logo`}
          width={px}
          height={px}
          loading="lazy"
          onError={() => setErrored(true)}
          className="object-contain"
          style={{ width: px, height: px }}
        />
      )}
    </div>
  );
}
