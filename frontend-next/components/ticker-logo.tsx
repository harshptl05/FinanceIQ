'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildTickerLogoUrlChain } from '@/lib/logos';

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
 * Brand mark for a stock / ETF / mutual-fund ticker.
 *
 * Image URL waterfall (each step on `img` error advances):
 *   1. Known static issuer mark (e.g. Vanguard index mutual funds — VFIAX,
 *      VTIAX, VMFXX — where logo.dev is unreliable).
 *   2. logo.dev `/ticker/<SYM>` — stocks and many ETFs.
 *   3. logo.dev `/<issuer-domain>/` — mutual funds that map to an issuer.
 *   4. Colored letter chip — last resort.
 */
export function TickerLogo({
  ticker,
  color = '#6366F1',
  size = 'md',
  className = '',
  forceFallback = false,
  rounded = 'lg',
}: Props) {
  const px = SIZE_PX[size];
  const radius =
    rounded === 'full' ? 'rounded-full' : rounded === 'md' ? 'rounded-md' : 'rounded-lg';

  const sources = useMemo(
    () => buildTickerLogoUrlChain(ticker, PIX_FOR_API[size]),
    [ticker, size],
  );

  const [srcIdx, setSrcIdx] = useState(0);

  useEffect(() => {
    setSrcIdx(0);
  }, [ticker, size]);

  const showLetter = forceFallback || srcIdx >= sources.length || sources.length === 0;
  const src =
    !showLetter && sources.length > 0
      ? sources[Math.min(srcIdx, sources.length - 1)]
      : null;

  const letter = (ticker || '?').trim().charAt(0).toUpperCase();
  const fontSize = Math.max(11, Math.round(px * 0.42));

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
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${ticker}-${srcIdx}`}
          src={src}
          alt={`${ticker} logo`}
          width={px}
          height={px}
          loading="lazy"
          onError={() => setSrcIdx((n) => n + 1)}
          className="object-contain"
          style={{ width: px, height: px }}
        />
      )}
    </div>
  );
}
