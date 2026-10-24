import { useMemo } from 'react';
import Filters from '@/components/Filters';
import Leaderboard, { type LeaderboardRow } from '@/components/Leaderboard';
import PageHeader from '@/components/PageHeader';
import SearchBox from '@/components/SearchBox';
import ShareChart from '@/components/ShareChart';
import StatTile from '@/components/StatTile';
import TableCard from '@/components/TableCard';
import TrendChart, { type TrendSeries } from '@/components/TrendChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardParams } from '@/hooks/useDashboardParams';
import { useSummary } from '@/hooks/useSummary';
import { markersFor } from '@/lib/anomalies';
import { formatCompact, formatDate } from '@/lib/format';
import {
  ARTIFACT_KIND_COLOR,
  ARTIFACT_KIND_LABEL,
  ARTIFACT_KINDS,
  artifactsOf,
  between,
  chartRows,
  compareArtifacts,
  earliestDate,
  excludesCharts,
  hasDataIn,
  headlineArtifacts,
  latestDate,
  matchesKind,
  matchesQuery,
  type Point,
  RANGE_LABEL,
  SOURCE_COLOR,
  SOURCE_LABEL,
  SOURCES,
  type Summary,
  shareRows,
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

    // Leaderboard and tiles: headline artifacts only (no chart polls unless
    // the chart type is selected). The trend chart below still draws charts
    // as their own band so the polling volume stays visible, apart.
    const rows: LeaderboardRow[] = products.map((product) => {
      const counted = headlineArtifacts(
        artifactsOf(product.groups, params),
        params,
      );
      const series = sumSeries(counted.map((a) => a.series));
      return {
        product,
        comparison: compareArtifacts(counted, start, end),
        share: 0,
        points: between(series, start, end),
      };
    });
    const grand = rows.reduce((acc, r) => acc + r.comparison.current, 0);
    for (const r of rows) r.share = grand ? r.comparison.current / grand : 0;

    // Chart: stacked by artifact type (images vs charts vs ...) unless a
    // type is selected, then by source. A single remaining series is drawn
    // as a plain area.
    const all = products.flatMap((p) => artifactsOf(p.groups, params));
    const byGroup: Record<string, Point[]> = {};
    const chartSeries: TrendSeries[] = [];
    if (params.type === 'all') {
      for (const kind of ARTIFACT_KINDS) {
        const series = sumSeries(
          all.filter((a) => a.kind === kind).map((a) => a.series),
        );
        if (!hasDataIn(series, start, end)) continue;
        byGroup[kind] = series;
        chartSeries.push({
          key: kind,
          label: ARTIFACT_KIND_LABEL[kind],
          color: ARTIFACT_KIND_COLOR[kind],
        });
      }
    } else {
      for (const source of SOURCES) {
        const series = sumSeries(
          all.filter((a) => a.source === source).map((a) => a.series),
        );
        if (!hasDataIn(series, start, end)) continue;
        byGroup[source] = series;
        chartSeries.push({
          key: source,
          label: SOURCE_LABEL[source],
          color: SOURCE_COLOR[source],
        });
      }
    }

    const overall = compareArtifacts(
      headlineArtifacts(all, params),
      start,
      end,
    );
    const share = shareRows(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        rank: p.totals.all,
        series: sumSeries(
          headlineArtifacts(artifactsOf(p.groups, params), params).map(
            (g) => g.series,
          ),
        ),
      })),
      start,
      end,
    );
    const markers = weekly
      ? []
      : markersFor(between(sumSeries(all.map((a) => a.series)), start, end));
    return {
      markers,
      share,
      asOf,
      start,
      end,
      weekly,
      days,
      rows,
      overall,
      chartRows: chartRows(byGroup, start, end, weekly),
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
      <PageHeader
        title="Downloads"
        description="Image pulls and package downloads across the Nebari ecosystem. Helm chart pulls are mostly GitOps controllers polling, so they are charted apart and left out of the totals unless you select them."
      >
        <Filters params={params} onChange={setParams} />
      </PageHeader>

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
                (view.overall.delta === null
                  ? 'no full previous period yet'
                  : 'vs. previous period') +
                (excludesCharts(params) ? ', excluding chart polls' : '')
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
                {view.weekly ? 'Weekly' : 'Daily'}{' '}
                {params.type === 'all'
                  ? 'downloads by type'
                  : `${ARTIFACT_KIND_LABEL[params.type].toLowerCase()} by source`}
                {params.source !== 'all' &&
                  ` from ${SOURCE_LABEL[params.source]}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TrendChart
                rows={view.chartRows}
                series={view.chartSeries}
                weekly={view.weekly}
                markers={view.markers}
                title={`${view.weekly ? 'Weekly' : 'Daily'} downloads, ${rangeLabel}`}
              />
              {view.markers.length > 0 && (
                <p className="mt-2 text-muted-foreground text-xs">
                  Marked days are more than three standard deviations above the
                  trailing four-week average; hover one for the numbers. They
                  stay in the totals.
                </p>
              )}
            </CardContent>
          </Card>

          {view.share.series.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Share of downloads by product, weekly</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <ShareChart
                  rows={view.share.rows}
                  series={view.share.series}
                  title={`Weekly share of downloads by product, ${rangeLabel}`}
                />
                <p className="text-muted-foreground text-xs">
                  The five largest products in the period get their own band;
                  the rest are "Other". Same counts as the leaderboard
                  {excludesCharts(params) && ', chart polls excluded'}.
                </p>
              </CardContent>
            </Card>
          )}

          <TableCard
            title={`Downloads by product, ${rangeLabel.toLowerCase()}`}
            controls={
              <SearchBox
                value={params.q}
                onChange={(q) => setParams({ q })}
                label="Search products"
              />
            }
          >
            <Leaderboard
              rows={view.rows.filter((r) =>
                matchesQuery(params.q, r.product.name, r.product.id),
              )}
              rangeLabel={rangeLabel}
              emptyMessage={
                params.q ? `No products match "${params.q}".` : undefined
              }
            />
          </TableCard>
        </>
      )}
    </div>
  );
}

export default Overview;
