import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import Filters from '@/components/Filters';
import SearchBox from '@/components/SearchBox';
import StatTile from '@/components/StatTile';
import TrendChart, { type TrendSeries } from '@/components/TrendChart';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDashboardParams } from '@/hooks/useDashboardParams';
import { useProduct, useSummary } from '@/hooks/useSummary';
import {
  formatAgo,
  formatCompact,
  formatDate,
  formatNumber,
} from '@/lib/format';
import {
  cadence,
  daysSincePush,
  laterDate,
  productReleases,
  releaseUrl,
  repoName,
  repoUrl,
  starsGained,
  starsPoints,
  TRAFFIC_LABEL,
  trafficRange,
  trafficSeries,
  trafficTotal,
} from '@/lib/repos';
import {
  ARTIFACT_KIND_LABEL,
  type Artifact,
  addDays,
  artifactsOf,
  artifactUrl,
  BREAKDOWN_LABEL,
  between,
  breakdownRows,
  chartRows,
  compareArtifacts,
  earliestDate,
  excludesCharts,
  hasDataIn,
  headlineArtifacts,
  KIND_LABEL,
  type LatestItem,
  latestDate,
  matchesQuery,
  type Point,
  type ProductDetail,
  platformOf,
  productSeries,
  RANGE_LABEL,
  SOURCE_COLOR,
  SOURCE_LABEL,
  SOURCES,
  type Summary,
  sumSeries,
  total,
  windowFor,
} from '@/lib/summary';
import NotFound from '@/pages/NotFound';

interface ReleaseRow {
  tag: string;
  cumulative: number;
  /** Downloads of this tag/version in the last 30 days, when known. */
  recent?: number;
}

/** Per-tag totals from the latest GitHub Releases snapshot, biggest first. */
function releaseRows(items: LatestItem[], key = 'tag'): ReleaseRow[] {
  const byTag = new Map<string, ReleaseRow>();
  for (const item of items) {
    const tag = String(item[key] ?? '');
    const row = byTag.get(tag) ?? { tag, cumulative: 0, recent: 0 };
    row.cumulative += item.cumulative;
    row.recent = (row.recent ?? 0) + (item.totals?.['30d'] ?? 0);
    byTag.set(tag, row);
  }
  return [...byTag.values()].sort((a, b) => b.cumulative - a.cumulative);
}

/**
 * Which versions people install now: share of the last 30 days of downloads
 * per version, from the per-item snapshot deltas of cumulative sources.
 */
function adoptionRows(artifacts: Artifact[]): ReleaseRow[] {
  const rows = [
    ...releaseRows(
      artifacts
        .filter((a) => a.source === 'conda')
        .flatMap((a) => a.latest_items ?? []),
      'version',
    ),
    ...releaseRows(
      artifacts
        .filter((a) => a.source === 'github_releases')
        .flatMap((a) => a.latest_items ?? []),
      'tag',
    ),
  ];
  const merged = new Map<string, ReleaseRow>();
  for (const r of rows) {
    const m = merged.get(r.tag) ?? { tag: r.tag, cumulative: 0, recent: 0 };
    m.cumulative += r.cumulative;
    m.recent = (m.recent ?? 0) + (r.recent ?? 0);
    merged.set(r.tag, m);
  }
  return [...merged.values()]
    .filter((r) => (r.recent ?? 0) > 0)
    .map((r) => ({ tag: r.tag, cumulative: r.recent ?? 0 }))
    .sort((a, b) => b.cumulative - a.cumulative);
}

function platformRows(items: LatestItem[]): ReleaseRow[] {
  const byPlatform = new Map<string, number>();
  for (const item of items) {
    const platform = platformOf(String(item.asset ?? ''));
    if (platform) {
      byPlatform.set(
        platform,
        (byPlatform.get(platform) ?? 0) + item.cumulative,
      );
    }
  }
  return [...byPlatform]
    .map(([tag, cumulative]) => ({ tag, cumulative }))
    .sort((a, b) => b.cumulative - a.cumulative);
}

function useProductView(
  summary: Summary | undefined,
  product: ProductDetail | null | undefined,
) {
  const [params, setParams] = useDashboardParams();
  const view = useMemo(() => {
    if (!summary || !product) return null;
    // The window is the dashboard's, from the index, so a product page and
    // the Downloads page agree on "as of" and on what a full period is.
    const asOf = latestDate(summary);
    const earliest = earliestDate(summary);
    const { start, end, days } = windowFor(params.range, asOf, earliest);
    const weekly = days > 120;
    const artifacts = artifactsOf(product.artifacts, params);

    const bySource: Record<string, Point[]> = {};
    const chartSeries: TrendSeries[] = [];
    for (const source of SOURCES) {
      const own = sumSeries(
        artifacts.filter((a) => a.source === source).map((a) => a.series),
      );
      if (!hasDataIn(own, start, end)) continue;
      bySource[source] = own;
      chartSeries.push({
        key: source,
        label: SOURCE_LABEL[source],
        color: SOURCE_COLOR[source],
      });
    }
    const series = productSeries(product.artifacts, params);
    const releases = artifacts
      .filter((a) => a.source === 'github_releases' && a.latest_items?.length)
      .flatMap((a) => a.latest_items ?? []);

    const stable = productReleases(product);
    const feed = productReleases(product, { includePrereleases: true });
    const traffic = trafficRange(product.repos);
    const trafficStart = traffic
      ? laterDate(addDays(traffic.end, -13), traffic.start)
      : '';
    const trafficCharts = traffic
      ? (
          [
            [
              'Views',
              ['views', 'var(--chart-1)'],
              ['unique_views', 'var(--chart-3)'],
            ],
            [
              'Clones',
              ['clones', 'var(--chart-4)'],
              ['unique_clones', 'var(--chart-5)'],
            ],
          ] as const
        ).map(([title, ...metrics]) => {
          const byMetric: Record<string, Point[]> = {};
          const series: TrendSeries[] = [];
          for (const [metric, color] of metrics) {
            byMetric[metric] = trafficSeries(product.repos, metric);
            series.push({ key: metric, label: TRAFFIC_LABEL[metric], color });
          }
          return {
            title,
            series,
            rows: chartRows(byMetric, traffic.start, traffic.end, false),
          };
        })
      : [];

    const starred = product.repos.filter((r) => r.stars_series.length > 0);
    const stars = starred.length
      ? {
          rows: starsPoints(starred, start, end).map((p) => ({
            date: p.date,
            stars: p.count,
          })),
          gained: starred.reduce(
            (n, r) => n + (starsGained(r, start, end) ?? 0),
            0,
          ),
        }
      : null;

    const pypi = artifacts.filter((a) => a.source === 'pypi');
    const breakdowns = (['python_minor', 'system'] as const)
      .map((dimension) => ({
        dimension,
        rows: breakdownRows(pypi, dimension, start, end).map((r) => ({
          tag: r.category,
          cumulative: r.count,
        })),
      }))
      .filter((b) => b.rows.length > 0);

    return {
      stars,
      breakdowns,
      cadence: cadence(stable, product.generated_at, 90),
      feed: feed.slice(0, 8),
      adoption: adoptionRows(artifacts),
      traffic: traffic && {
        ...traffic,
        windowStart: trafficStart,
        views: trafficTotal(product.repos, 'views', trafficStart, traffic.end),
        uniqueViews: trafficTotal(
          product.repos,
          'unique_views',
          trafficStart,
          traffic.end,
        ),
        clones: trafficTotal(
          product.repos,
          'clones',
          trafficStart,
          traffic.end,
        ),
        uniqueClones: trafficTotal(
          product.repos,
          'unique_clones',
          trafficStart,
          traffic.end,
        ),
        charts: trafficCharts,
      },
      product,
      asOf,
      start,
      end,
      weekly,
      artifacts,
      overall: compareArtifacts(
        headlineArtifacts(artifacts, params),
        start,
        end,
      ),
      allKnown: total(series),
      chartRows: chartRows(bySource, start, end, weekly),
      chartSeries,
      releases: releaseRows(releases),
      platforms: platformRows(releases),
    };
  }, [summary, product, params]);
  return { params, setParams, view };
}

function ArtifactRow({
  artifact,
  start,
  end,
}: {
  artifact: Artifact;
  start: string;
  end: string;
}) {
  const inWindow = total(between(artifact.series, start, end));
  return (
    <TableRow>
      <TableCell>
        <span className="flex items-center gap-2">
          <span
            className="inline-block size-2.5 shrink-0 rounded-full"
            style={{ background: SOURCE_COLOR[artifact.source] }}
            aria-hidden="true"
          />
          {SOURCE_LABEL[artifact.source]}
        </span>
      </TableCell>
      <TableCell>{ARTIFACT_KIND_LABEL[artifact.kind]}</TableCell>
      <TableCell className="font-mono text-xs">
        <a
          href={artifactUrl(artifact)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
        >
          {artifact.ref}
          <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatNumber(inWindow)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatNumber(total(artifact.series))}
      </TableCell>
      <TableCell className="text-right text-muted-foreground tabular-nums">
        {artifact.latest_cumulative === null
          ? '—'
          : formatNumber(artifact.latest_cumulative)}
      </TableCell>
    </TableRow>
  );
}

function Product() {
  const { id } = useParams();
  const { search } = useLocation();
  const index = useSummary();
  const detail = useProduct(id);
  const { params, setParams, view } = useProductView(index.data, detail.data);
  const rangeLabel = RANGE_LABEL[params.range];

  const error = index.error ?? detail.error;
  if (error) {
    return (
      <p role="alert" className="text-destructive-foreground">
        Could not load download data: {error.message}
      </p>
    );
  }
  if (index.isPending || detail.isPending) {
    return <Skeleton className="h-64" shape="block" />;
  }
  if (!view) return <NotFound />;

  const { product } = view;
  const shownArtifacts = view.artifacts.filter((a) =>
    matchesQuery(params.q, a.ref, SOURCE_LABEL[a.source], a.kind),
  );
  const shownRepos = product.repos.filter((r) =>
    matchesQuery(params.q, r.repo),
  );
  return (
    <div className="flex flex-col gap-6">
      <Link
        to={{ pathname: '/', search }}
        className="inline-flex w-fit items-center gap-1 text-muted-foreground text-sm underline-offset-4 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All products
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-2xl tracking-tight">
            {product.name}
          </h1>
          <Badge variant={product.kind === 'pack' ? 'secondary' : 'outline'}>
            {KIND_LABEL[product.kind]}
          </Badge>
        </div>
        <Filters params={params} onChange={setParams} showKind={false} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label={`Downloads, ${rangeLabel.toLowerCase()}`}
          value={formatCompact(view.overall.current)}
          delta={view.overall.delta}
          hint={
            (view.overall.delta === null
              ? 'no full previous period yet'
              : 'vs. previous period') +
            (excludesCharts(params) &&
            view.artifacts.some((a) => a.kind === 'chart')
              ? ', excluding chart polls'
              : '')
          }
        />
        <StatTile
          label="All recorded"
          value={formatCompact(view.allKnown)}
          hint="since collection began"
        />
        <StatTile
          label="Artifacts"
          value={String(view.artifacts.length)}
          hint={
            view.chartSeries.map((s) => s.label).join(', ') ||
            'none for this source'
          }
        />
      </div>

      {view.chartSeries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {view.weekly ? 'Weekly' : 'Daily'} downloads by source
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart
              rows={view.chartRows}
              series={view.chartSeries}
              weekly={view.weekly}
              title={`${product.name} downloads by source, ${rangeLabel}`}
            />
          </CardContent>
        </Card>
      )}

      <SearchBox
        value={params.q}
        onChange={(q) => setParams({ q })}
        label="Search artifacts and repos"
      />
      <Table aria-label={`${product.name} artifacts`}>
        <TableHeader>
          <TableRow>
            <TableHead>Source</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Artifact</TableHead>
            <TableHead className="text-right">{rangeLabel}</TableHead>
            <TableHead className="text-right">All recorded</TableHead>
            <TableHead className="text-right">Upstream total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shownArtifacts.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                {params.q
                  ? `No artifacts match "${params.q}".`
                  : 'No artifacts for this filter.'}
              </TableCell>
            </TableRow>
          )}
          {shownArtifacts.map((a) => (
            <ArtifactRow
              key={`${a.source}:${a.ref}`}
              artifact={a}
              start={view.start}
              end={view.end}
            />
          ))}
        </TableBody>
      </Table>
      <p className="text-muted-foreground text-xs">
        "All recorded" sums the daily counts Pulse has collected. "Upstream
        total" is the cumulative counter reported by GitHub or conda-forge,
        which predates collection; Quay and PyPI do not expose one.
      </p>

      {(view.releases.length > 0 || view.adoption.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {view.adoption.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Version adoption, last 30 days</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <ReleaseTable rows={view.adoption} label="Version" />
                <p className="text-muted-foreground text-xs">
                  Share of downloads in the last 30 days by version, from
                  conda-forge and GitHub Releases. PyPI and Quay do not report
                  per-version counts.
                </p>
              </CardContent>
            </Card>
          )}
          {view.releases.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Downloads by release, all time</CardTitle>
              </CardHeader>
              <CardContent>
                <ReleaseTable rows={view.releases} label="Release" />
              </CardContent>
            </Card>
          )}
          {view.platforms.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Downloads by platform</CardTitle>
              </CardHeader>
              <CardContent>
                <ReleaseTable rows={view.platforms} label="Platform" />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {view.breakdowns.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {view.breakdowns.map((b) => (
            <Card key={b.dimension}>
              <CardHeader>
                <CardTitle>
                  PyPI downloads by {BREAKDOWN_LABEL[b.dimension].toLowerCase()}
                  , {rangeLabel.toLowerCase()}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <ReleaseTable
                  rows={b.rows}
                  label={BREAKDOWN_LABEL[b.dimension]}
                />
                <p className="text-muted-foreground text-xs">
                  As reported by pypistats. "unknown" is downloads whose
                  installer did not say.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {product.repos.length > 0 && (
        <section
          aria-labelledby="repos-heading"
          className="flex flex-col gap-4"
        >
          <h2
            id="repos-heading"
            className="font-semibold text-lg tracking-tight"
          >
            Repositories
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile
              label="Latest release"
              value={view.cadence.latest?.tag ?? '—'}
              hint={
                view.cadence.latest
                  ? `${formatAgo(view.cadence.daysSince)} · ${formatDate(view.cadence.latest.date, true)}`
                  : 'no GitHub releases'
              }
            />
            <StatTile
              label="Releases, 90 days"
              value={String(view.cadence.recent)}
              hint={
                view.cadence.medianGapDays === null
                  ? 'stable releases only'
                  : `median ${view.cadence.medianGapDays} days apart`
              }
            />
            <StatTile
              label="Stars"
              value={formatNumber(
                product.repos.reduce((n, r) => n + (r.health?.stars ?? 0), 0),
              )}
              hint={
                `${product.repos.length} ${product.repos.length === 1 ? 'repo' : 'repos'}` +
                (view.stars
                  ? `, ${view.stars.gained >= 0 ? '+' : ''}${formatNumber(view.stars.gained)} ${rangeLabel.toLowerCase()}`
                  : '')
              }
            />
          </div>

          {view.stars && (
            <Card>
              <CardHeader>
                <CardTitle>Stars over time</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart
                  rows={view.stars.rows}
                  series={[
                    { key: 'stars', label: 'Stars', color: 'var(--chart-1)' },
                  ]}
                  title={`${product.name} stars, ${rangeLabel}`}
                />
              </CardContent>
            </Card>
          )}

          <Table aria-label={`${product.name} repositories`}>
            <TableHeader>
              <TableRow>
                <TableHead>Repository</TableHead>
                <TableHead className="text-right">Stars</TableHead>
                <TableHead className="text-right">Open issues</TableHead>
                <TableHead className="text-right">Open PRs</TableHead>
                <TableHead className="text-right">Merged, 30d</TableHead>
                <TableHead>Last push</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shownRepos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No repos match "{params.q}".
                  </TableCell>
                </TableRow>
              )}
              {shownRepos.map((r) => (
                <TableRow key={r.repo}>
                  <TableCell className="font-medium">
                    <a
                      href={repoUrl(r.repo)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                    >
                      {repoName(r.repo)}
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  </TableCell>
                  <HealthCell value={r.health?.stars} />
                  <HealthCell value={r.health?.open_issues} />
                  <HealthCell value={r.health?.open_prs} />
                  <HealthCell value={r.health?.merged_prs_30d} />
                  <TableCell className="tabular-nums">
                    {formatAgo(daysSincePush(r, product.generated_at))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {view.feed.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent releases</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="flex flex-col divide-y divide-border">
                  {view.feed.map((r) => (
                    <li
                      key={`${r.repo}:${r.tag}`}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
                    >
                      <span className="w-24 shrink-0 text-muted-foreground tabular-nums">
                        {formatDate(r.date, true)}
                      </span>
                      <a
                        href={releaseUrl(r.repo, r.tag)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs underline-offset-4 hover:underline"
                      >
                        {r.tag}
                        <ExternalLink className="size-3" aria-hidden="true" />
                      </a>
                      {product.repos.length > 1 && (
                        <span className="text-muted-foreground text-xs">
                          {repoName(r.repo)}
                        </span>
                      )}
                      {r.prerelease && (
                        <Badge variant="secondary">prerelease</Badge>
                      )}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {view.traffic && (
            <Card>
              <CardHeader>
                <CardTitle>GitHub traffic</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-4">
                  <StatTile
                    label="Unique visitors, 14 days"
                    value={formatCompact(view.traffic.uniqueViews)}
                    hint={`${formatCompact(view.traffic.views)} views in all`}
                  />
                  <StatTile
                    label="Unique cloners, 14 days"
                    value={formatCompact(view.traffic.uniqueClones)}
                    hint={`${formatCompact(view.traffic.clones)} clones, incl. CI`}
                  />
                  <StatTile
                    label="Window"
                    value={formatDate(view.traffic.windowStart)}
                    hint={`to ${formatDate(view.traffic.end)}`}
                  />
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                  {view.traffic.charts.map((c) => (
                    <TrendChart
                      key={c.title}
                      rows={c.rows}
                      series={c.series}
                      stacked={false}
                      title={`${product.name} GitHub ${c.title.toLowerCase()}`}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      )}
    </div>
  );
}

function HealthCell({ value }: { value: number | null | undefined }) {
  return (
    <TableCell className="text-right tabular-nums">
      {value === null || value === undefined ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        formatNumber(value)
      )}
    </TableCell>
  );
}

function ReleaseTable({ rows, label }: { rows: ReleaseRow[]; label: string }) {
  const max = Math.max(...rows.map((r) => r.cumulative), 1);
  return (
    <Table aria-label={`Downloads by ${label.toLowerCase()}`}>
      <TableHeader>
        <TableRow>
          <TableHead>{label}</TableHead>
          <TableHead className="w-1/2">Share</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.slice(0, 12).map((r) => (
          <TableRow key={r.tag}>
            <TableCell className="font-mono text-xs">{r.tag}</TableCell>
            <TableCell>
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-chart-1"
                  style={{ width: `${(r.cumulative / max) * 100}%` }}
                />
              </div>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatNumber(r.cumulative)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default Product;
