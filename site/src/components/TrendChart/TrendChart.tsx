import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCompact, formatDate, formatNumber } from '@/lib/format';

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
  title: string;
}

function ChartTooltip({
  active,
  payload,
  label,
  weekly,
}: TooltipProps<number, string> & { weekly: boolean }) {
  if (!active || !payload?.length) return null;
  const items = [...payload].reverse(); // top of the stack first
  const sum = items.reduce((acc, p) => acc + (p.value ?? 0), 0);
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-popover-foreground text-sm shadow-md">
      <p className="mb-1 font-medium">
        {weekly ? 'Week of ' : ''}
        {formatDate(String(label), true)}
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
    </div>
  );
}

/**
 * Daily (or weekly) downloads as a stacked area. One series is a plain area
 * in the primary hue; several get fixed per-entity colors and a legend.
 */
function TrendChart({ rows, series, weekly = false, title }: TrendChartProps) {
  const stacked = series.length > 1;
  return (
    <figure aria-label={title} className="flex flex-col gap-3">
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
              tickFormatter={(d: string) => formatDate(d)}
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
              content={<ChartTooltip weekly={weekly} />}
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
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export default TrendChart;
