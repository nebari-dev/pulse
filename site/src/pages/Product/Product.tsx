import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import Filters from '@/components/Filters';
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
import { useSummary } from '@/hooks/useSummary';
import { formatCompact, formatNumber } from '@/lib/format';
import {
  ARTIFACT_KIND_LABEL,
  type Artifact,
  artifactsOf,
  artifactUrl,
  between,
  chartRows,
  compareArtifacts,
  earliestDate,
  hasDataIn,
  KIND_LABEL,
  type LatestItem,
  latestDate,
  type Point,
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
}

/** Per-tag totals from the latest GitHub Releases snapshot, biggest first. */
function releaseRows(items: LatestItem[]): ReleaseRow[] {
  const byTag = new Map<string, number>();
  for (const item of items) {
    const tag = String(item.tag ?? '');
    byTag.set(tag, (byTag.get(tag) ?? 0) + item.cumulative);
  }
  return [...byTag]
    .map(([tag, cumulative]) => ({ tag, cumulative }))
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

function useProductView(summary: Summary | undefined, id: string | undefined) {
  const [params, setParams] = useDashboardParams();
  const view = useMemo(() => {
    const product = summary?.products.find((p) => p.id === id);
    if (!summary || !product) return null;
    const asOf = latestDate(summary);
    const earliest = earliestDate(summary);
    const { start, end, days } = windowFor(params.range, asOf, earliest);
    const weekly = days > 120;
    const artifacts = artifactsOf(product, params);

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
    const series = productSeries(product, params);
    const releases = artifacts
      .filter((a) => a.source === 'github_releases' && a.latest_items?.length)
      .flatMap((a) => a.latest_items ?? []);

    return {
      product,
      asOf,
      start,
      end,
      weekly,
      artifacts,
      overall: compareArtifacts(artifacts, start, end),
      allKnown: total(series),
      chartRows: chartRows(bySource, start, end, weekly),
      chartSeries,
      releases: releaseRows(releases),
      platforms: platformRows(releases),
    };
  }, [summary, id, params]);
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
  const { data, error, isPending } = useSummary();
  const { params, setParams, view } = useProductView(data, id);
  const rangeLabel = RANGE_LABEL[params.range];

  if (error) {
    return (
      <p role="alert" className="text-destructive-foreground">
        Could not load download data: {error.message}
      </p>
    );
  }
  if (isPending) return <Skeleton className="h-64" shape="block" />;
  if (!view) return <NotFound />;

  const { product } = view;
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
            view.overall.delta === null
              ? 'no full previous period yet'
              : 'vs. previous period'
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
          {view.artifacts.map((a) => (
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

      {view.releases.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Downloads by release</CardTitle>
            </CardHeader>
            <CardContent>
              <ReleaseTable rows={view.releases} label="Release" />
            </CardContent>
          </Card>
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
    </div>
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
