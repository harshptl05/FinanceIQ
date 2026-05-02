import type { Holding } from '@/lib/api';

/**
 * Best-effort mark for charts / strips when `current_price` is stale or zero
 * but the row still has value or cost (common right after a trade if a
 * downstream sync lags).
 */
export function effectiveHoldingPrice(h: Holding): number {
  const cp = Number(h.current_price ?? 0);
  if (cp > 0) return cp;
  const sh = Number(h.shares ?? 0);
  if (sh > 0) {
    const v = Number(h.current_value ?? 0);
    if (v > 0) {
      const implied = v / sh;
      if (implied > 0) return implied;
    }
  }
  const b = Number(h.avg_cost_basis ?? 0);
  return b > 0 ? b : 0;
}

export function effectiveHoldingValue(h: Holding): number {
  const sh = Number(h.shares ?? 0);
  const px = effectiveHoldingPrice(h);
  if (sh > 0 && px > 0) return sh * px;
  return Number(h.current_value ?? 0);
}
