import { useMemo } from 'react';
import Filters from '@/components/Filters';
import Leaderboard, { type LeaderboardRow } from '@/components/Leaderboard';
import StatTile from '@/components/StatTile';
import TrendChart, { type TrendSeries } from '@/components/TrendChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardParams } from '@/hooks/useDashboardParams';
import { useSummary } from '@/hooks/useSummary';
import { formatCompact, formatDate } from '@/lib/format';
import {
  between,
  chartRows,
  compare,
  earliestDate,
  hasDataIn,
  latestDate,
  matchesKind,
  type Point,
  productSeries,
  RANGE_LABEL,
  SOURCE_COLOR,
  SOURCE_LABEL,
  SOURCES,
  type Summary,
  sumSeries,
  windowFor,
} from '@/lib/summary';

function useOverview(summary: Summary | undefined) {
  const [params, setParams] = useDashboardParams();
  const view = useMemo(() => {
    if (!summary) return null;
    const asOf = latestDate(summary);
    const earliest = earliestDate(summary);
    const { start, end, days } = windowFor(params.range, asOf, earliest);
    const weekly = days > 120;
    const products = summary.products.filter((p) =>
      matchesKind(p, params.kind),
    );

    const rows: LeaderboardRow[] = products.map((product) => {
      const series = productSeries(product, params.source);
      return {
        product,
        comparison: compare(series, start, end, earliest),
        share: 0,
        points: between(series, start, end),
      };
    });
    const grand = rows.reduce((acc, r) => acc + r.comparison.current, 0);
    for (const r of rows) r.share = grand ? r.comparison.current / grand : 0;

    // Chart: stacked by source when unfiltered, otherwise a single area.
    const bySource: Record<string, Point[]> = {};
    const chartSeries: TrendSeries[] = [];
    const sources = params.source === 'all' ? SOURCES : [params.source];
    for (const source of sources) {
      const series = sumSeries(products.map((p) => productSeries(p, source)));
      if (!hasDataIn(series, start, end)) continue;
      bySource[source] = series;
      chartSeries.push({
        key: source,
        label: SOURCE_LABEL[source],
        color: SOURCE_COLOR[source],
      });
    }

    const overall = compare(
      sumSeries(Object.values(bySource)),
      start,
      end,
      earliest,
    );
    return {
      asOf,
      start,
      end,
      weekly,
      days,
      rows,
      overall,
      chartRows: chartRows(bySource, start, end, weekly),
      chartSeries,
      packs: products.filter((p) => p.kind === 'pack').length,
      count: products.length,
    };
  }, [summary, params]);
  return { params, setParams, view };
}

function Overview() {
  const { data, error, isPending } = useSummary();
  const { params, setParams, view } = useOverview(data);
  const rangeLabel = RANGE_LABEL[params.range];

  if (error) {
    return (
      <p role="alert" className="text-destructive-foreground">
        Could not load download data: {error.message}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Downloads</h1>
          <p className="text-muted-foreground text-sm">
            Image pulls, chart pulls and package downloads across the Nebari
            ecosystem.
          </p>
        </div>
        <Filters params={params} onChange={setParams} />
      </div>

      {isPending || !view ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {['a', 'b', 'c', 'd'].map((k) => (
            <Skeleton key={k} className="h-24" shape="block" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label={`Downloads, ${rangeLabel.toLowerCase()}`}
              value={formatCompact(view.overall.current)}
              delta={view.overall.delta}
              hint={
                view.overall.delta === null
                  ? 'no full previous period yet'
                  : 'vs. previous period'
              }
            />
            <StatTile
              label="Daily average"
              value={formatCompact(
                Math.round(
                  view.overall.current /
                    Math.max(
                      view.rows[0]
                        ? view.chartRows.length * (view.weekly ? 7 : 1)
                        : 1,
                      1,
                    ),
                ),
              )}
              hint={`${formatDate(view.start)} – ${formatDate(view.end)}`}
            />
            <StatTile
              label="Tracked"
              value={String(view.count)}
              hint={`${view.count - view.packs} products, ${view.packs} packs`}
            />
            <StatTile
              label="Data through"
              value={formatDate(view.asOf)}
              hint={`collected ${formatDate(data.generated_at, true)}`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                {view.weekly ? 'Weekly' : 'Daily'} downloads
                {params.source !== 'all' &&
                  ` from ${SOURCE_LABEL[params.source]}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TrendChart
                rows={view.chartRows}
                series={view.chartSeries}
                weekly={view.weekly}
                title={`${view.weekly ? 'Weekly' : 'Daily'} downloads, ${rangeLabel}`}
              />
            </CardContent>
          </Card>

          <Leaderboard rows={view.rows} rangeLabel={rangeLabel} />
        </>
      )}
    </div>
  );
}

export default Overview;
