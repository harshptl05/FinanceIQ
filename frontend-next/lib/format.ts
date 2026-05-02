export function fmtMoney(value: number | null | undefined, opts?: { decimals?: number }): string {
  const n = Number(value ?? 0);
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: opts?.decimals ?? 2,
    maximumFractionDigits: opts?.decimals ?? 2,
  });
}

export function fmtPct(
  value: number | null | undefined,
  opts?: { decimals?: number; withSign?: boolean },
): string {
  const n = Number(value ?? 0);
  const decimals = opts?.decimals ?? 1;
  const sign = opts?.withSign ? (n > 0 ? '+' : '') : '';
  return `${sign}${n.toFixed(decimals)}%`;
}

export function relativeTime(iso?: string | null): string {
  if (!iso) return 'just now';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const ASSET_LABEL: Record<string, string> = {
  us_stocks: 'US stocks',
  intl_stocks: 'Intl stocks',
  bonds: 'Bonds',
  cash: 'Cash',
  real_estate: 'Real estate',
  commodities: 'Commodities',
  other: 'Other',
};

export function assetLabel(key: string): string {
  return ASSET_LABEL[key] ?? key.replace(/_/g, ' ');
}

// Each asset class has its own color family. Intuitively:
//   blues = US stocks · violet/pink = intl stocks · greens = bonds
//   amber = cash · orange = real estate · red = commodities
// The first entry in each family is the canonical "asset class" color
// (used in legend dots, badges, allocation bars, etc.).
const FAMILIES: Record<string, string[]> = {
  us_stocks: ['#6366F1', '#3B82F6', '#0EA5E9', '#7C3AED', '#2563EB', '#1D4ED8'],
  intl_stocks: ['#8B5CF6', '#A855F7', '#D946EF', '#EC4899', '#C026D3', '#9333EA'],
  bonds: ['#16A34A', '#22C55E', '#10B981', '#14B8A6', '#15803D', '#0D9488'],
  cash: ['#F59E0B', '#FBBF24', '#EAB308', '#FACC15'],
  real_estate: ['#F97316', '#FB923C', '#EA580C', '#C2410C'],
  commodities: ['#DC2626', '#EF4444', '#F43F5E', '#E11D48'],
  other: ['#6B7280', '#9CA3AF', '#4B5563', '#374151'],
};

const ASSET_COLOR: Record<string, string> = Object.fromEntries(
  Object.entries(FAMILIES).map(([k, palette]) => [k, palette[0]]),
);

export function assetColor(key: string): string {
  return ASSET_COLOR[key] ?? '#6B7280';
}

// 12 visually distinct colors, hand-tuned so neighbors don't look alike when
// drawn next to each other in a stacked bar / legend.
const PALETTE_12 = [
  '#6366F1', // indigo
  '#22C55E', // green
  '#F97316', // orange
  '#EC4899', // pink
  '#0EA5E9', // sky blue
  '#EAB308', // yellow
  '#8B5CF6', // violet
  '#14B8A6', // teal
  '#EF4444', // red
  '#A855F7', // purple
  '#06B6D4', // cyan
  '#84CC16', // lime
];

export function paletteColor(index: number): string {
  return PALETTE_12[index % PALETTE_12.length];
}

/** Hash-based color (legacy) — used as a fallback when no explicit map exists. */
export function tickerColor(ticker: string): string {
  let h = 0;
  for (let i = 0; i < ticker.length; i++) h = (h * 31 + ticker.charCodeAt(i)) >>> 0;
  return PALETTE_12[h % PALETTE_12.length];
}

/** Build a stable {ticker -> unique color} map for a set of holdings.
 *  Sorted alphabetically so colors stay consistent regardless of the order
 *  the holdings happen to be sorted in elsewhere (top movers, distribution, etc). */
export function tickerColorMap(tickers: string[]): Record<string, string> {
  const unique = Array.from(new Set(tickers)).sort();
  const map: Record<string, string> = {};
  unique.forEach((t, i) => {
    map[t] = paletteColor(i);
  });
  return map;
}

/** Color map by asset class — the *intuitive* one. Each ticker gets a unique
 *  shade within its asset class family, so a glance at any chart tells you
 *  "blue family = US stocks, green = bonds, amber = cash". */
export function holdingColorMap(
  holdings: Array<{ ticker: string; asset_class?: string | null }>,
): Record<string, string> {
  const byClass: Record<string, string[]> = {};
  for (const h of holdings) {
    const ac = h.asset_class ?? 'other';
    if (!byClass[ac]) byClass[ac] = [];
    if (!byClass[ac].includes(h.ticker)) byClass[ac].push(h.ticker);
  }
  const map: Record<string, string> = {};
  for (const [ac, tickers] of Object.entries(byClass)) {
    const family = FAMILIES[ac] ?? FAMILIES.other;
    tickers.sort().forEach((t, i) => {
      map[t] = family[i % family.length];
    });
  }
  return map;
}

export function initials(input: string | null | undefined): string {
  if (!input) return 'YOU';
  const parts = input.split(/[\s@.]/).filter(Boolean);
  if (parts.length === 0) return 'YOU';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
