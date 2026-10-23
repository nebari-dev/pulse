import { TriangleAlert } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
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
  title: string;
}

function ChartTooltip({
  active,
  payload,
  label,
  bucket,
  notes,
}: TooltipProps<number, string> & {
  bucket: Bucket;
  notes: Map<string, string>;
}) {
  if (!active || !payload?.length) return null;
  const items = [...payload].reverse(); // top of the stack first
  const sum = items.reduce((acc, p) => acc + (p.value ?? 0), 0);
  const note = notes.get(String(label));
  return (
    <div className="max-w-xs rounded-md border bg-popover px-3 py-2 text-popover-foreground text-sm shadow-md">
      <p className="mb-1 font-medium">
        {bucketLabel(String(label), bucket, true)}
      </p>
      {items.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2">
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
      ))}
      {items.length > 1 && (
        <p className="mt-1 flex border-t pt-1">
          <span className="text-muted-foreground">Total</span>
          <span className="ml-auto pl-4 font-medium tabular-nums">
            {formatNumber(sum)}
          </span>
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
 */
function TrendChart({
  rows,
  series,
  weekly = false,
  bucket: bucketProp,
  title,
  stacked: stackedProp,
  markers = [],
}: TrendChartProps) {
  const stacked = stackedProp ?? series.length > 1;
  const bucket: Bucket = bucketProp ?? (weekly ? 'week' : 'day');
  const notes = new Map(markers.map((m) => [m.date, m.note]));
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
      {stacked && (
        <ul
          className="flex flex-wrap gap-x-4 gap-y-1 text-sm"
          aria-label="Legend"
        >
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ background: s.color }}
                aria-hidden="true"
              />
              {s.label}
            </li>
          ))}
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
              content={<ChartTooltip bucket={bucket} notes={notes} />}
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
