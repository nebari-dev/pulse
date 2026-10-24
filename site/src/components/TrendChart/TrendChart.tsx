import { Clock, TriangleAlert } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChartMarker } from '@/lib/anomalies';
import {
  formatCompact,
  formatDate,
  formatMonth,
  formatNumber,
  formatQuarter,
} from '@/lib/format';

export type Bucket = 'day' | 'week' | 'month' | 'quarter';

function bucketLabel(date: string, bucket: Bucket, long: boolean): string {
  switch (bucket) {
    case 'day':
      return formatDate(date, long);
    case 'week':
      return `${long ? 'Week of ' : ''}${formatDate(date, long)}`;
    case 'month':
      return formatMonth(date);
    case 'quarter':
      return formatQuarter(date);
  }
}

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
  /** Row keys that add up to this series, listed under it in the tooltip
   * (e.g. a type band's sources). Not drawn. */
  parts?: Array<{ key: string; label: string }>;
}

/** A vertical marker, e.g. where a source's data begins. */
export interface ChartLine {
  /** Row key (date) the line sits on. */
  date: string;
  label: string;
}

interface TrendChartProps {
  rows: Array<Record<string, number | string>>;
  series: TrendSeries[];
  /** Rows are weekly buckets (affects axis and tooltip labels). */
  weekly?: boolean;
  /** What one row is; overrides `weekly`. Affects axis and tooltip labels. */
  bucket?: Bucket;
  /**
   * Days to flag (anomalies). Drawn as a marker on top of the stack and
   * explained in the tooltip; the plotted values are untouched.
   */
  markers?: ChartMarker[];
  /**
   * Stack the series (the default when there is more than one). Pass false
   * when series overlap rather than add up, e.g. total vs. unique visitors.
   */
  stacked?: boolean;
  /** Where a band begins because collection did, not because usage did. */
  lines?: ChartLine[];
  /**
   * First row that is still incomplete (some source has not reported yet).
   * The stretch into it is shaded and the tooltip says why it dips.
   */
  partialFrom?: string | null;
  /** Tooltip note on incomplete rows, e.g. which sources are missing. */
  partialNote?: string;
  title: string;
}

function ChartTooltip({
  active,
  payload,
  label,
  bucket,
  notes,
  parts,
  partial,
}: TooltipProps<number, string> & {
  bucket: Bucket;
  notes: Map<string, string>;
  parts: Map<string, TrendSeries['parts']>;
  partial: ((date: string) => string | null) | null;
}) {
  if (!active || !payload?.length) return null;
  const items = [...payload].reverse(); // top of the stack first
  const sum = items.reduce((acc, p) => acc + (p.value ?? 0), 0);
  const note = notes.get(String(label));
  const partialNote = partial?.(String(label));
  return (
    <div className="max-w-xs rounded-md border bg-popover px-3 py-2 text-popover-foreground text-sm shadow-md">
      <p className="mb-1 font-medium">
        {bucketLabel(String(label), bucket, true)}
      </p>
      {items.map((p) => (
        <div key={p.dataKey}>
          <p className="flex items-center gap-2">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ background: p.color }}
              aria-hidden="true"
            />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto pl-4 tabular-nums">
              {formatNumber(p.value ?? 0)}
            </span>
          </p>
          {parts
            .get(String(p.dataKey))
            ?.filter((part) => Number(p.payload?.[part.key] ?? 0) > 0)
            .map((part) => (
              <p
                key={part.key}
                className="flex pl-4.5 text-muted-foreground text-xs"
              >
                <span>{part.label}</span>
                <span className="ml-auto pl-4 tabular-nums">
                  {formatNumber(Number(p.payload?.[part.key] ?? 0))}
                </span>
              </p>
            ))}
        </div>
      ))}
      {items.length > 1 && (
        <p className="mt-1 flex border-t pt-1">
          <span className="text-muted-foreground">Total</span>
          <span className="ml-auto pl-4 font-medium tabular-nums">
            {formatNumber(sum)}
          </span>
        </p>
      )}
      {partialNote && (
        <p className="mt-1 flex items-start gap-1.5 border-t pt-1 text-muted-foreground text-xs">
          <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{partialNote}</span>
        </p>
      )}
      {note && (
        <p className="mt-1 flex items-start gap-1.5 border-t pt-1 text-warning-foreground text-xs">
          <TriangleAlert
            className="mt-0.5 size-3.5 shrink-0"
            aria-hidden="true"
          />
          <span>{note}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Daily (or weekly) downloads as a stacked area. One series is a plain area
 * in the primary hue; several get fixed per-entity colors and a legend.
 * Optional lines mark where a source's data begins, and a shaded tail marks
 * days not every source has reported yet.
 */
function TrendChart({
  rows,
  series,
  weekly = false,
  bucket: bucketProp,
  title,
  stacked: stackedProp,
  markers = [],
  lines = [],
  partialFrom = null,
  partialNote,
}: TrendChartProps) {
  const stacked = stackedProp ?? series.length > 1;
  const bucket: Bucket = bucketProp ?? (weekly ? 'week' : 'day');
  const notes = new Map(markers.map((m) => [m.date, m.note]));
  const parts = new Map(series.map((s) => [s.key, s.parts]));
  // The shaded tail runs from the last complete row into the first
  // incomplete one, so the dip it explains sits inside it.
  const partialAt = partialFrom
    ? rows.findIndex((r) => r.date === partialFrom)
    : -1;
  const partialStart =
    partialAt >= 0 ? String(rows[Math.max(partialAt - 1, 0)].date) : null;
  const partial =
    partialFrom && partialAt >= 0
      ? (date: string) =>
          date >= partialFrom
            ? (partialNote ?? 'Not every source has reported yet.')
            : null
      : null;
  const shown = lines.filter((l) => rows.some((r) => r.date === l.date));
  const rightHalf = (date: string) =>
    rows.findIndex((r) => r.date === date) > rows.length / 2;
  // Marker height: the top of the stack (or the tallest series) that day.
  const topOf = (date: string) => {
    const row = rows.find((r) => r.date === date);
    if (!row) return null;
    const values = series.map((s) => Number(row[s.key] ?? 0));
    return stacked ? values.reduce((a, b) => a + b, 0) : Math.max(...values);
  };
  return (
    <figure aria-label={title} className="flex flex-col gap-3">
      {markers.length > 0 && (
        <p className="sr-only">
          {markers.length} flagged {markers.length === 1 ? 'day' : 'days'}:{' '}
          {markers
            .map((m) => `${formatDate(m.date, true)}, ${m.note}`)
            .join(' ')}
        </p>
      )}
      {(series.length > 1 || partialStart) && (
        <ul
          className="flex flex-wrap gap-x-4 gap-y-1 text-sm"
          aria-label="Legend"
        >
          {series.length > 1 &&
            series.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{ background: s.color }}
                  aria-hidden="true"
                />
                {s.label}
              </li>
            ))}
          {partialStart && (
            <li className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="inline-block size-2.5 rounded-sm bg-muted-foreground/25"
                aria-hidden="true"
              />
              Incomplete, still being reported
            </li>
          )}
        </ul>
      )}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={rows}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeOpacity={0.6}
            />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => bucketLabel(d, bucket, false)}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
              minTickGap={32}
            />
            <YAxis
              tickFormatter={(n: number) => formatCompact(n)}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              content={
                <ChartTooltip
                  bucket={bucket}
                  notes={notes}
                  parts={parts}
                  partial={partial}
                />
              }
              cursor={{
                stroke: 'var(--border-strong)',
                strokeDasharray: '3 3',
              }}
            />
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stackId={stacked ? 'downloads' : undefined}
                stroke={s.color}
                fill={s.color}
                fillOpacity={stacked ? 0.35 : 0.2}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
                isAnimationActive={false}
              />
            ))}
            {partialStart && (
              <ReferenceArea
                x1={partialStart}
                x2={String(rows.at(-1)?.date)}
                fill="var(--muted-foreground)"
                fillOpacity={0.12}
                ifOverflow="hidden"
              />
            )}
            {shown.map((l, i) => (
              <ReferenceLine
                key={l.date}
                x={l.date}
                stroke="var(--muted-foreground)"
                strokeDasharray="4 4"
                label={{
                  value: l.label,
                  // Text runs into the chart, away from the nearer edge;
                  // successive labels step down so close lines stay legible.
                  position: rightHalf(l.date)
                    ? 'insideTopRight'
                    : 'insideTopLeft',
                  offset: 6 + 14 * i,
                  fill: 'var(--muted-foreground)',
                  fontSize: 11,
                }}
              />
            ))}
            {markers.map((m) => {
              const y = topOf(m.date);
              return y === null ? null : (
                <ReferenceDot
                  key={m.date}
                  x={m.date}
                  y={y}
                  r={5}
                  fill="var(--warning-foreground)"
                  stroke="var(--card)"
                  strokeWidth={2}
                  ifOverflow="extendDomain"
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export default TrendChart;
