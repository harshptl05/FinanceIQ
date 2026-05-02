'use client';

interface Props {
  size?: number;
  centerValue?: string;
  centerSubvalue?: string;
  centerCaption?: string;
}

export function RadialBarChart({
  size = 240,
  centerValue = '$8,436',
  centerSubvalue = '-$268.20',
  centerCaption = 'from last years',
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const rInner = size * 0.32;
  const rOuterBase = size * 0.40;
  const rOuterMax = size * 0.48;

  const numBars = 90;

  const heightAt = (i: number) => {
    const seed = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return 0.35 + (seed - Math.floor(seed)) * 0.65;
  };

  const colorAt = (angle: number) => {
    const a = ((angle % 360) + 360) % 360;
    if (a < 50)  return '#EF4444';
    if (a < 90)  return '#F97316';
    if (a < 130) return '#FBBF24';
    if (a < 180) return '#22C55E';
    if (a < 230) return '#10B981';
    if (a < 270) return '#3B82F6';
    if (a < 320) return '#8B5CF6';
    return '#EC4899';
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        {Array.from({ length: numBars }).map((_, i) => {
          const angleDeg = (i / numBars) * 360 - 90;
          const rad = (angleDeg * Math.PI) / 180;
          const h = heightAt(i);
          const rOuter = rOuterBase + (rOuterMax - rOuterBase) * h;

          const x1 = cx + rInner * Math.cos(rad);
          const y1 = cy + rInner * Math.sin(rad);
          const x2 = cx + rOuter * Math.cos(rad);
          const y2 = cy + rOuter * Math.sin(rad);

          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={colorAt((i / numBars) * 360)}
              strokeWidth={3}
              strokeLinecap="round"
              opacity={0.75 + h * 0.25}
            />
          );
        })}

        <circle
          cx={cx}
          cy={cy}
          r={rInner - 4}
          fill="none"
          stroke="#F3F4F6"
          strokeWidth={1}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-2xl font-bold tabular-nums text-gray-900">
          {centerValue}
        </div>
        <div className="text-sm text-gray-500 tabular-nums mt-1">
          {centerSubvalue}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">{centerCaption}</div>
      </div>
    </div>
  );
}
