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
import { formatDate, formatNumber } from '@/lib/format';
import type { ShareSeries } from '@/lib/summary';

interface ShareChartProps {
  rows: Array<Record<string, number | string>>;
  series: ShareSeries[];
  title: string;
}

function ShareTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as Record<string, number | string>;
  const items = [...payload].reverse(); // top of the stack first
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-popover-foreground text-sm shadow-md">
      <p className="mb-1 font-medium">
        Week of {formatDate(String(label), true)}
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
            {(p.value ?? 0).toFixed(1)}%
          </span>
          <span className="w-16 text-right text-muted-foreground tabular-nums">
            {formatNumber(Number(row[`${String(p.dataKey)}_n`] ?? 0))}
          </span>
        </p>
      ))}
    </div>
  );
}

/** Weekly share of the total per product as a 100% stacked area. */
function ShareChart({ rows, series, title }: ShareChartProps) {
  return (
    <figure aria-label={title} className="flex flex-col gap-3">
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
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(n: number) => `${n}%`}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              content={<ShareTooltip />}
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
                stackId="share"
                stroke={s.color}
                fill={s.color}
                fillOpacity={s.key === 'other' ? 0.2 : 0.35}
                strokeWidth={1.5}
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

export default ShareChart;
