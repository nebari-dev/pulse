import type { Point } from '@/lib/summary';

interface SparklineProps {
  points: Point[];
  width?: number;
  height?: number;
  label: string;
}

/** Tiny single-hue trend line, no axes; pure SVG so it is cheap in tables. */
function Sparkline({ points, width = 96, height = 24, label }: SparklineProps) {
  if (points.length < 2) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const max = Math.max(...points.map((p) => p.count), 1);
  const stepX = width / (points.length - 1);
  const pad = 2;
  const y = (c: number) => height - pad - (c / max) * (height - pad * 2);
  const d = points
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(1)},${y(p.count).toFixed(1)}`,
    )
    .join(' ');
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className="overflow-visible"
    >
      <path
        d={d}
        fill="none"
        stroke="var(--chart-1)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default Sparkline;
