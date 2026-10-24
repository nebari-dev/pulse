import { useMemo } from 'react';
import ChartCard from '@/components/ChartCard';
import Filters from '@/components/Filters';
import Leaderboard, { type LeaderboardRow } from '@/components/Leaderboard';
import PageHeader from '@/components/PageHeader';
import SearchBox from '@/components/SearchBox';
import ShareChart from '@/components/ShareChart';
import StatTile from '@/components/StatTile';
import TableCard from '@/components/TableCard';
import TrendChart, { type TrendSeries } from '@/components/TrendChart';
import { Skeleton } from '@/components/ui/skeleton';
import {
  type DashboardParams,
  useDashboardParams,
} from '@/hooks/useDashboardParams';
import { useSummary } from '@/hooks/useSummary';
import { markersFor } from '@/lib/anomalies';
import { coverageLines, partialNote, sourceList } from '@/lib/coverage';
import { formatCompact, formatDate } from '@/lib/format';
import {
  ARTIFACT_KIND_COLOR,
  ARTIFACT_KIND_LABEL,
  ARTIFACT_KINDS,
  artifactsOf,
  between,
  chartRows,
  compareArtifacts,
  coverage,
  earliestDate,
  excludesCharts,
  HEADLINE_KINDS,
  hasDataIn,
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

/** Helm chart pulls are mostly GitOps controllers polling, so Downloads
 * starts without them; the type filter adds them back. */
const DOWNLOADS_DEFAULTS: Partial<DashboardParams> = {
  type: [...HEADLINE_KINDS],
};

function useOverview(summary: Summary | undefined) {
  const [params, setParams] = useDashboardParams(DOWNLOADS_DEFAULTS);
  const view = useMemo(() => {
    if (!summary) return null;
    const asOf = latestDate(summary);
    const earliest = earliestDate(summary);
    const { start, end, days } = windowFor(params.range, asOf, earliest);
    const weekly = days > 120;
    const products = summary.products.filter((p) =>
      matchesKind(p, params.kind),
    );

    // Tiles, leaderboard, share and trend all count the same selection.
    const rows: LeaderboardRow[] = products.map((product) => {
      const counted = artifactsOf(product.groups, params);
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

    // Chart: stacked by artifact type (images vs packages vs ...) when more
    // than one type is selected, otherwise by source. A single remaining
    // series is drawn as a plain area.
    const all = products.flatMap((p) => artifactsOf(p.groups, params));
    const byGroup: Record<string, Point[]> = {};
    const chartSeries: TrendSeries[] = [];
    if (params.type.length > 1) {
      for (const kind of ARTIFACT_KINDS) {
        const series = sumSeries(
          all.filter((a) => a.kind === kind).map((a) => a.series),
        );
        if (!hasDataIn(series, start, end)) continue;
        byGroup[kind] = series;
        // Each band's sources, for the tooltip.
        const parts = [];
        for (const source of SOURCES) {
          const own = sumSeries(
            all
              .filter((a) => a.kind === kind && a.source === source)
              .map((a) => a.series),
          );
          if (!hasDataIn(own, start, end)) continue;
          byGroup[`${kind}:${source}`] = own;
          parts.push({ key: `${kind}:${source}`, label: SOURCE_LABEL[source] });
        }
        chartSeries.push({
          key: kind,
          label: ARTIFACT_KIND_LABEL[kind],
          color: ARTIFACT_KIND_COLOR[kind],
          parts: parts.length > 1 ? parts : undefined,
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

    const overall = compareArtifacts(all, start, end);
    const share = shareRows(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        rank: p.totals.all,
        series: sumSeries(artifactsOf(p.groups, params).map((g) => g.series)),
      })),
      start,
      end,
    );
    const cov = coverage(all, start, end, weekly);
    const markers = weekly
      ? []
      : markersFor(between(sumSeries(all.map((a) => a.series)), start, end));
    return {
      coverage: cov,
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
  const trendTitle = `${view?.weekly ? 'Weekly' : 'Daily'} ${
    params.type.length > 1
      ? 'downloads by type'
      : `${ARTIFACT_KIND_LABEL[params.type[0]].toLowerCase()} by source`
  }${
    params.source.length < SOURCES.length
      ? ` from ${sourceList(params.source)}`
      : ''
  }`;

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
        description="Image pulls and package downloads across the Nebari ecosystem. Helm charts are left out by default: their pulls are mostly GitOps controllers polling, not new installs. Add them from the type filter."
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
                (excludesCharts(params) ? ', Helm charts not included' : '')
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

          <ChartCard
            title={trendTitle}
            info={
              <>
                <p>
                  Downloads per {view.weekly ? 'week' : 'day'}, stacked so the
                  top edge is the total.{' '}
                  {params.type.length > 1
                    ? 'Each band is one artifact type; hover a day to split a band by source.'
                    : 'Each band is one source.'}
                </p>
                <ul>
                  <li>Images and Helm charts are pulls from Quay.</li>
                  <li>Packages are PyPI and conda-forge installs.</li>
                  <li>Binaries are GitHub release asset downloads.</li>
                  <li>
                    Helm charts start unchecked: their pulls are mostly GitOps
                    controllers polling, not new installs.
                  </li>
                  <li>
                    A dashed line marks where a source's data begins; before it
                    that source is missing, not zero.
                  </li>
                  <li>
                    The shaded tail is incomplete: some sources report a day
                    late.
                  </li>
                  <li>
                    Yellow dots are spike days, more than three standard
                    deviations above the trailing four-week average, usually CI
                    or mirrors. They stay in the totals.
                  </li>
                </ul>
              </>
            }
          >
            <TrendChart
              rows={view.chartRows}
              series={view.chartSeries}
              weekly={view.weekly}
              markers={view.markers}
              lines={coverageLines(view.coverage)}
              partialFrom={view.coverage.partialFrom}
              partialNote={partialNote(view.coverage, view.weekly)}
              title={`${view.weekly ? 'Weekly' : 'Daily'} downloads, ${rangeLabel}`}
            />
          </ChartCard>

          {view.share.series.length > 1 && (
            <ChartCard
              title="Share of downloads by product, weekly"
              info={
                <>
                  <p>
                    Each product's share of the week's downloads, so growth in
                    one product shows even when the total moves.
                  </p>
                  <ul>
                    <li>
                      The five largest products in the period get their own
                      band; the rest are "Other".
                    </li>
                    <li>
                      Same counts as the leaderboard and the type and source
                      filters
                      {excludesCharts(params) && ', Helm charts not included'}.
                    </li>
                  </ul>
                </>
              }
            >
              <ShareChart
                rows={view.share.rows}
                series={view.share.series}
                title={`Weekly share of downloads by product, ${rangeLabel}`}
              />
            </ChartCard>
          )}

          <TableCard
            title={`Downloads by product, ${rangeLabel.toLowerCase()}`}
            info={
              <ul>
                <li>
                  Downloads in the period, with the change from the period
                  before it. No change is shown until a full previous period has
                  been collected.
                </li>
                <li>Share is of the total across the listed products.</li>
                <li>The sparkline is the same period, day by day.</li>
              </ul>
            }
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
