'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export interface RadialSegment {
  id: string;
  label: string;
  weight: number; // 0..1, must roughly sum to 1
  sublabel?: string;
  /** When provided, bars in this segment use this color instead of rainbow. */
  color?: string;
}

interface Props {
  size?: number;
  centerValue?: string;
  centerSubvalue?: string;
  centerCaption?: string;
  /** Extra key — when it changes, the animation re-runs (e.g., period change). */
  animationKey?: string | number;
  durationMs?: number;
  /** Optional list of segments to associate with bars. When provided, the
   *  chart gets per-segment hover + click. Bars stay rainbow for the design,
   *  segments only drive interaction. */
  segments?: RadialSegment[];
  onSegmentClick?: (id: string) => void;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function polarToCart(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

/** Builds an SVG donut wedge between two angles. Used as an invisible hit-area. */
function donutWedgePath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startAngle: number,
  endAngle: number,
): string {
  const startOuter = polarToCart(cx, cy, rOuter, startAngle);
  const endOuter = polarToCart(cx, cy, rOuter, endAngle);
  const startInner = polarToCart(cx, cy, rInner, endAngle);
  const endInner = polarToCart(cx, cy, rInner, startAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return (
    `M ${startOuter.x} ${startOuter.y} ` +
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y} ` +
    `L ${startInner.x} ${startInner.y} ` +
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${endInner.x} ${endInner.y} Z`
  );
}

export function RadialBarChart({
  size = 240,
  centerValue = '$8,436',
  centerSubvalue = '-$268.20',
  centerCaption = 'from last years',
  animationKey,
  durationMs = 900,
  segments,
  onSegmentClick,
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const rInner = size * 0.32;
  const rOuterBase = size * 0.4;
  const rOuterMax = size * 0.48;
  const numBars = 90;

  const heightAt = (i: number) => {
    const seed = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return 0.35 + (seed - Math.floor(seed)) * 0.65;
  };

  const colorAt = (angle: number) => {
    const a = ((angle % 360) + 360) % 360;
    if (a < 50) return '#EF4444';
    if (a < 90) return '#F97316';
    if (a < 130) return '#FBBF24';
    if (a < 180) return '#22C55E';
    if (a < 230) return '#10B981';
    if (a < 270) return '#3B82F6';
    if (a < 320) return '#8B5CF6';
    return '#EC4899';
  };

  // ---- Animation ----
  const [progress, setProgress] = useState(0);
  const startTsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setProgress(0);
    startTsRef.current = null;
    const tick = (ts: number) => {
      if (startTsRef.current === null) startTsRef.current = ts;
      const elapsed = ts - startTsRef.current;
      const p = Math.min(1, elapsed / durationMs);
      setProgress(p);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationKey, durationMs]);

  const barWindow = 0.35;
  const sweepWindow = 1 - barWindow;
  const centerOpacity = Math.max(0, (progress - 0.55) / 0.45);

  // ---- Segment mapping (which bar belongs to which holding) ----
  const { segmentByBar, colorByBar } = useMemo(() => {
    if (!segments || segments.length === 0) {
      return {
        segmentByBar: Array<string | null>(numBars).fill(null),
        colorByBar: Array<string | null>(numBars).fill(null),
      };
    }
    const total = segments.reduce((s, x) => s + Math.max(0, x.weight), 0) || 1;
    const ids: (string | null)[] = [];
    const colors: (string | null)[] = [];
    let cumulative = 0;
    let segIdx = 0;
    for (let i = 0; i < numBars; i++) {
      const t = (i + 0.5) / numBars;
      while (
        segIdx < segments.length - 1 &&
        t > cumulative + Math.max(0, segments[segIdx].weight) / total
      ) {
        cumulative += Math.max(0, segments[segIdx].weight) / total;
        segIdx++;
      }
      ids.push(segments[segIdx].id);
      colors.push(segments[segIdx].color ?? null);
    }
    return { segmentByBar: ids, colorByBar: colors };
  }, [segments]);

  // ---- Hit areas ----
  type Wedge = {
    id: string;
    label: string;
    sublabel?: string;
    weight: number;
    path: string;
  };
  const wedges: Wedge[] = useMemo(() => {
    if (!segments || segments.length === 0) return [];
    const total = segments.reduce((s, x) => s + Math.max(0, x.weight), 0) || 1;
    let startAngle = -Math.PI / 2; // start at top
    return segments.map((s) => {
      const span = (Math.max(0, s.weight) / total) * 2 * Math.PI;
      const endAngle = startAngle + span;
      const path = donutWedgePath(
        cx,
        cy,
        rInner - 4,
        rOuterMax + 6,
        startAngle,
        endAngle,
      );
      const result: Wedge = {
        id: s.id,
        label: s.label,
        sublabel: s.sublabel,
        weight: s.weight,
        path,
      };
      startAngle = endAngle;
      return result;
    });
  }, [segments, cx, cy, rInner, rOuterMax]);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hovered = useMemo(
    () => wedges.find((w) => w.id === hoveredId) ?? null,
    [wedges, hoveredId],
  );

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        {/* Bars */}
        {Array.from({ length: numBars }).map((_, i) => {
          const angleDeg = (i / numBars) * 360 - 90;
          const rad = (angleDeg * Math.PI) / 180;
          const h = heightAt(i);

          const isHovered =
            hoveredId !== null && segmentByBar[i] === hoveredId;
          const hoverBoost = isHovered ? 0.18 : 0;
          const targetROuter =
            rOuterBase + (rOuterMax - rOuterBase) * (h + hoverBoost);

          const start = (i / numBars) * sweepWindow;
          const local = (progress - start) / barWindow;
          const eased = easeOutCubic(Math.max(0, Math.min(1, local)));
          const rOuter = rInner + (targetROuter - rInner) * eased;

          const x1 = cx + rInner * Math.cos(rad);
          const y1 = cy + rInner * Math.sin(rad);
          const x2 = cx + rOuter * Math.cos(rad);
          const y2 = cy + rOuter * Math.sin(rad);

          const visible = local > 0;
          const dimmed =
            hoveredId !== null && segmentByBar[i] !== hoveredId ? 0.25 : 1;
          const baseOpacity = visible ? 0.75 + h * 0.25 : 0;
          // If the segment supplied a color, use it (per-holding palette);
          // otherwise fall back to the rainbow gradient.
          const stroke = colorByBar[i] ?? colorAt((i / numBars) * 360);

          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={stroke}
              strokeWidth={3}
              strokeLinecap="round"
              opacity={baseOpacity * dimmed}
              style={{ transition: 'opacity 0.15s ease' }}
            />
          );
        })}

        {/* Inner ring */}
        <circle
          cx={cx}
          cy={cy}
          r={rInner - 4}
          fill="none"
          stroke="#F3F4F6"
          strokeWidth={1}
          opacity={Math.min(1, progress * 2)}
        />

        {/* Invisible hit-area wedges (only when segments are given) */}
        {wedges.map((w) => (
          <path
            key={w.id}
            d={w.path}
            fill="transparent"
            style={{
              cursor: onSegmentClick ? 'pointer' : 'default',
              pointerEvents: 'all',
            }}
            onMouseEnter={() => setHoveredId(w.id)}
            onMouseLeave={() =>
              setHoveredId((cur) => (cur === w.id ? null : cur))
            }
            onClick={() => onSegmentClick?.(w.id)}
          />
        ))}
      </svg>

      {/* Center text */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none transition-transform"
        style={{
          opacity: centerOpacity,
          transform: `scale(${0.92 + centerOpacity * 0.08})`,
        }}
      >
        {hovered ? (
          <>
            <div className="text-xs uppercase tracking-wide text-gray-400">
              {hovered.label}
            </div>
            <div className="text-2xl font-bold tabular-nums text-gray-900 mt-1">
              {(hovered.weight * 100).toFixed(1)}%
            </div>
            {hovered.sublabel && (
              <div className="text-xs text-gray-500 tabular-nums mt-0.5">
                {hovered.sublabel}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-2xl font-bold tabular-nums text-gray-900">
              {centerValue}
            </div>
            <div className="text-sm text-gray-500 tabular-nums mt-1">
              {centerSubvalue}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{centerCaption}</div>
          </>
        )}
      </div>
    </div>
  );
}
