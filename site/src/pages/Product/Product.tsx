import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import ChartCard from '@/components/ChartCard';
import Filters from '@/components/Filters';
import PageHeader from '@/components/PageHeader';
import SearchBox from '@/components/SearchBox';
import ShareChart from '@/components/ShareChart';
import StatRow from '@/components/StatRow';
import StatTile from '@/components/StatTile';
import TableCard from '@/components/TableCard';
import TrendChart, { type TrendSeries } from '@/components/TrendChart';
import { Badge } from '@/components/ui/badge';
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
import { markersFor } from '@/lib/anomalies';
import { coverageLines, partialNote } from '@/lib/coverage';
import {
  formatAgo,
  formatCompact,
  formatDate,
  formatNumber,
} from '@/lib/format';
import {
  cadence,
  daysSincePush,
  healthRange,
  laterDate,
  openWorkSeries,
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
  coverage,
  earliestDate,
  excludesCharts,
  hasDataIn,
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
  shareRows,
  sumSeries,
  total,
  versionShareInputs,
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
            markers: markersFor(byMetric[metrics[0][0]], title.toLowerCase()),
          };
        })
      : [];

    const health = healthRange(product.repos);
    const openWork = health
      ? openWorkSeries(product.repos, laterDate(health.start, start), end)
      : null;
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

    const versionShare = shareRows(
      versionShareInputs(
        artifacts.filter(
          (a) => a.source === 'conda' || a.source === 'github_releases',
        ),
      ),
      start,
      end,
    );
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
      openWork,
      versionShare,
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
      overall: compareArtifacts(artifacts, start, end),
      coverage: coverage(artifacts, start, end, weekly),
      allKnown: total(series),
      chartRows: chartRows(bySource, start, end, weekly),
      markers: weekly ? [] : markersFor(between(series, start, end)),
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
  return (
    <div className="flex flex-col gap-6">
      <Link
        to={{ pathname: '/', search }}
        className="inline-flex w-fit items-center gap-1 text-muted-foreground text-sm underline-offset-4 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All products
      </Link>
      <PageHeader
        title={product.name}
        badge={
          <Badge variant={product.kind === 'pack' ? 'secondary' : 'outline'}>
            {KIND_LABEL[product.kind]}
          </Badge>
        }
      >
        <Filters
          params={params}
          onChange={setParams}
          show={['range', 'type', 'source']}
        />
      </PageHeader>

      <StatRow>
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
              ? ', Helm charts not included'
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
      </StatRow>

      {view.chartSeries.length > 0 && (
        <ChartCard
          title={`${view.weekly ? 'Weekly' : 'Daily'} downloads by source`}
          info={
            <>
              <p>
                This product's downloads per {view.weekly ? 'week' : 'day'},
                stacked by source so the top edge is the total.
              </p>
              <ul>
                <li>
                  Quay counts image and Helm chart pulls. Chart pulls are mostly
                  GitOps controllers polling; uncheck Helm charts in the type
                  filter to leave them out.
                </li>
                <li>
                  conda-forge and GitHub report running totals; daily counts are
                  the change between snapshots.
                </li>
                <li>
                  A dashed line marks where a source's data begins; the shaded
                  tail is not complete yet.
                </li>
                <li>
                  Yellow dots are spike days, usually CI or mirrors. They stay
                  in the totals.
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
            title={`${product.name} downloads by source, ${rangeLabel}`}
          />
        </ChartCard>
      )}

      <TableCard
        title="Artifacts"
        controls={
          <SearchBox
            value={params.q}
            onChange={(q) => setParams({ q })}
            label="Search artifacts"
          />
        }
        info={
          <ul>
            <li>
              "All recorded" sums the daily counts Pulse has collected since it
              started tracking each artifact.
            </li>
            <li>
              "Upstream total" is the running counter GitHub or conda-forge
              reports, which predates collection. Quay and PyPI do not expose
              one.
            </li>
          </ul>
        }
      >
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
      </TableCard>

      {view.versionShare.series.length > 1 && (
        <ChartCard
          title="Version share over time, weekly"
          info={
            <ul>
              <li>
                How quickly a new release displaces the previous one, from
                conda-forge and GitHub Releases.
              </li>
              <li>
                The five largest versions in the period get a band; the rest are
                "Other".
              </li>
              <li>PyPI and Quay do not report per-version counts.</li>
            </ul>
          }
        >
          <ShareChart
            rows={view.versionShare.rows}
            series={view.versionShare.series}
            title={`${product.name} version share by week, ${rangeLabel}`}
          />
        </ChartCard>
      )}

      {(view.releases.length > 0 || view.adoption.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {view.adoption.length > 0 && (
            <ChartCard
              title="Version adoption, last 30 days"
              info={
                <ul>
                  <li>
                    Share of the last 30 days of downloads by version, from
                    conda-forge and GitHub Releases.
                  </li>
                  <li>PyPI and Quay do not report per-version counts.</li>
                </ul>
              }
            >
              <ReleaseTable rows={view.adoption} label="Version" />
            </ChartCard>
          )}
          {view.releases.length > 0 && (
            <ChartCard
              title="Downloads by release, all time"
              info={
                <ul>
                  <li>
                    Downloads of each GitHub release's assets, from the running
                    counter GitHub reports, so it includes downloads from before
                    Pulse started collecting.
                  </li>
                  <li>The twelve largest releases are listed.</li>
                </ul>
              }
            >
              <ReleaseTable rows={view.releases} label="Release" />
            </ChartCard>
          )}
          {view.platforms.length > 0 && (
            <ChartCard
              title="Downloads by platform"
              info={
                <ul>
                  <li>
                    GitHub release asset downloads, grouped by the operating
                    system and architecture in each file name, all time.
                  </li>
                  <li>
                    Assets without a platform in the name (checksums, source
                    archives) are left out.
                  </li>
                </ul>
              }
            >
              <ReleaseTable rows={view.platforms} label="Platform" />
            </ChartCard>
          )}
        </div>
      )}

      {view.breakdowns.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {view.breakdowns.map((b) => (
            <ChartCard
              key={b.dimension}
              title={`PyPI downloads by ${BREAKDOWN_LABEL[b.dimension].toLowerCase()}, ${rangeLabel.toLowerCase()}`}
              info={
                <ul>
                  <li>
                    As reported by pypistats, which reads PyPI's public download
                    logs, mirrors excluded.
                  </li>
                  <li>"unknown" is downloads whose installer did not say.</li>
                </ul>
              }
            >
              <ReleaseTable
                rows={b.rows}
                label={BREAKDOWN_LABEL[b.dimension]}
              />
            </ChartCard>
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
          <StatRow>
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
          </StatRow>

          {view.openWork && (
            <ChartCard
              title="Open issues and pull requests"
              info={
                <ul>
                  <li>
                    How many issues and pull requests were open on each day,
                    summed across the product's repos. A rising line is a
                    growing backlog.
                  </li>
                  <li>
                    Each point is a daily snapshot, so the history starts when
                    Pulse began collecting.
                  </li>
                </ul>
              }
              footnote={`Daily snapshots since ${formatDate(view.openWork[0]?.date ?? view.asOf, true)}.`}
            >
              <TrendChart
                rows={view.openWork}
                series={[
                  {
                    key: 'open_issues',
                    label: 'Open issues',
                    color: 'var(--chart-1)',
                  },
                  {
                    key: 'open_prs',
                    label: 'Open PRs',
                    color: 'var(--chart-3)',
                  },
                ]}
                stacked={false}
                title={`${product.name} open issues and pull requests, daily`}
              />
            </ChartCard>
          )}

          {view.stars && (
            <ChartCard
              title="Stars over time"
              info={
                <ul>
                  <li>
                    Total stars across the product's repos. History comes from
                    each star's own timestamp, so it reaches back before Pulse
                    started.
                  </li>
                  <li>
                    Stars that were later removed are not in the history; the
                    latest point is the current count.
                  </li>
                </ul>
              }
            >
              <TrendChart
                rows={view.stars.rows}
                series={[
                  { key: 'stars', label: 'Stars', color: 'var(--chart-1)' },
                ]}
                title={`${product.name} stars, ${rangeLabel}`}
              />
            </ChartCard>
          )}

          <TableCard
            title="Repositories"
            info={
              <ul>
                <li>The latest daily snapshot of each repo.</li>
                <li>
                  "Merged, 30d" is pull requests merged in the last 30 days.
                </li>
                <li>A dash means GitHub did not answer, not zero.</li>
              </ul>
            }
          >
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
                {product.repos.map((r) => (
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
          </TableCard>

          {view.feed.length > 0 && (
            <ChartCard
              title="Recent releases"
              info={
                <ul>
                  <li>
                    The latest eight GitHub releases across the product's repos.
                  </li>
                  <li>
                    Prereleases are listed here but left out of the release
                    counts and cadence.
                  </li>
                </ul>
              }
            >
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
            </ChartCard>
          )}

          {view.traffic && (
            <ChartCard
              title="GitHub traffic"
              info={
                <ul>
                  <li>
                    Views and clones of the product's repos, as GitHub reports
                    them. GitHub keeps only 14 days, so the tiles cover that
                    window.
                  </li>
                  <li>
                    Clones include CI checkouts and mirrors, so unique cloners
                    is the better adoption signal.
                  </li>
                  <li>
                    Unique counts are per day; GitHub does not dedupe across
                    days.
                  </li>
                </ul>
              }
            >
              <StatRow
                info={
                  <p>
                    {formatDate(view.traffic.windowStart)} –{' '}
                    {formatDate(view.traffic.end)}, the 14 days GitHub reports.
                  </p>
                }
              >
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
              </StatRow>
              <div className="grid gap-6 lg:grid-cols-2">
                {view.traffic.charts.map((c) => (
                  <TrendChart
                    key={c.title}
                    rows={c.rows}
                    series={c.series}
                    stacked={false}
                    markers={c.markers}
                    title={`${product.name} GitHub ${c.title.toLowerCase()}`}
                  />
                ))}
              </div>
            </ChartCard>
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
