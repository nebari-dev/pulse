import { ArrowDown, ArrowUp, ExternalLink } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import SearchBox from '@/components/SearchBox';
import Sparkline from '@/components/Sparkline';
import StatTile from '@/components/StatTile';
import TrendChart, { type TrendSeries } from '@/components/TrendChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { formatCompact, formatDate, formatNumber } from '@/lib/format';
import {
  laterDate,
  repoName,
  repoUrl,
  TRAFFIC_LABEL,
  type TrafficMetric,
  trafficRange,
  trafficSeries,
  trafficTotal,
} from '@/lib/repos';
import {
  addDays,
  chartRows,
  compare,
  type KindFilter,
  matchesKind,
  matchesQuery,
  type Point,
  type Product,
  type Repo,
  type Summary,
} from '@/lib/summary';

interface Row {
  product: Product;
  repo: Repo;
  views: number;
  uniqueViews: number;
  clones: number;
  uniqueClones: number;
  points: Point[];
}

type SortKey = 'repo' | 'views' | 'uniqueViews' | 'clones' | 'uniqueClones';
const RIGHT = 'text-right [&>button]:justify-end';
const KIND_ITEMS: Array<{ value: KindFilter; label: string }> = [
  { value: 'all', label: 'Products and packs' },
  { value: 'product', label: 'Products' },
  { value: 'pack', label: 'Packs' },
];
/** Two charts: totals and uniques overlap, so they are drawn unstacked. */
const CHARTS: Array<{
  title: string;
  metrics: Array<{ metric: TrafficMetric; color: string }>;
}> = [
  {
    title: 'Views',
    metrics: [
      { metric: 'views', color: 'var(--chart-1)' },
      { metric: 'unique_views', color: 'var(--chart-3)' },
    ],
  },
  {
    title: 'Clones',
    metrics: [
      { metric: 'clones', color: 'var(--chart-4)' },
      { metric: 'unique_clones', color: 'var(--chart-5)' },
    ],
  },
];
/** GitHub keeps 14 days; the headline compares the latest two weeks. */
const WINDOW = 14;

function useTraffic(summary: Summary | undefined) {
  const [params, setParams] = useDashboardParams();
  const view = useMemo(() => {
    if (!summary) return null;
    const products = summary.products.filter((p) =>
      matchesKind(p, params.kind),
    );
    const repos = products.flatMap((p) => p.repos);
    const range = trafficRange(repos);
    if (!range) return { range: null };
    const end = range.end;
    const start = laterDate(addDays(end, -(WINDOW - 1)), range.start);
    const rows: Row[] = products.flatMap((product) =>
      product.repos
        .filter((repo) => repo.traffic.length > 0)
        .map((repo) => ({
          product,
          repo,
          views: trafficTotal([repo], 'views', start, end),
          uniqueViews: trafficTotal([repo], 'unique_views', start, end),
          clones: trafficTotal([repo], 'clones', start, end),
          uniqueClones: trafficTotal([repo], 'unique_clones', start, end),
          points: trafficSeries([repo], 'views').filter(
            (p) => p.date >= start && p.date <= end,
          ),
        })),
    );
    const charts = CHARTS.map(({ title, metrics }) => {
      const byMetric: Record<string, Point[]> = {};
      const series: TrendSeries[] = [];
      for (const { metric, color } of metrics) {
        byMetric[metric] = trafficSeries(repos, metric);
        series.push({ key: metric, label: TRAFFIC_LABEL[metric], color });
      }
      return {
        title,
        series,
        rows: chartRows(byMetric, range.start, end, false),
      };
    });
    return {
      range,
      start,
      end,
      rows,
      views: compare(trafficSeries(repos, 'views'), start, end, range.start),
      clones: compare(trafficSeries(repos, 'clones'), start, end, range.start),
      uniqueViews: trafficTotal(repos, 'unique_views', start, end),
      uniqueClones: trafficTotal(repos, 'unique_clones', start, end),
      charts,
    };
  }, [summary, params.kind]);
  return { params, setParams, view };
}

function compareRows(a: Row, b: Row, key: SortKey) {
  return key === 'repo'
    ? a.repo.repo.localeCompare(b.repo.repo)
    : a[key] - b[key];
}

function Traffic() {
  const { data, error, isPending } = useSummary();
  const { params, setParams, view } = useTraffic(data);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'views',
    dir: 'desc',
  });

  if (error) {
    return (
      <p role="alert" className="text-destructive-foreground">
        Could not load traffic data: {error.message}
      </p>
    );
  }

  function toggle(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'repo' ? 'asc' : 'desc' },
    );
  }
  function head(key: SortKey, label: string, className?: string) {
    const active = sort.key === key;
    const Icon = sort.dir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <TableHead
        onClick={() => toggle(key)}
        aria-sort={
          active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
        }
        className={className}
      >
        {label}
        {active && <Icon className="size-3.5" aria-hidden="true" />}
      </TableHead>
    );
  }

  const controls = (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        items={KIND_ITEMS}
        value={params.kind}
        onValueChange={(value) => setParams({ kind: value as KindFilter })}
      >
        <SelectTrigger aria-label="Kind" className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {KIND_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <SearchBox
        value={params.q}
        onChange={(q) => setParams({ q })}
        label="Search repos"
      />
    </div>
  );

  if (isPending || !view) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Traffic" description="GitHub views and clones.">
          {controls}
        </PageHeader>
        <Skeleton className="h-64" shape="block" />
      </div>
    );
  }

  if (!view.range) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Traffic" description="GitHub views and clones.">
          {controls}
        </PageHeader>
        <Card>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="font-medium">No traffic data yet.</p>
            <p className="text-muted-foreground">
              GitHub only shares views and clones with people who can push to a
              repo. The collector needs a token with that access set as the
              repository secret <code>PULSE_GITHUB_TOKEN</code>; see the README.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const rows = view.rows
    .filter((r) =>
      matchesQuery(params.q, r.repo.repo, r.product.name, r.product.id),
    )
    .sort((a, b) => {
      const cmp = compareRows(a, b, sort.key);
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  const windowLabel = `${formatDate(view.start)} – ${formatDate(view.end)}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Traffic"
        description="Page views and git clones of every tracked GitHub repo. GitHub keeps 14 days; Pulse keeps everything it has seen."
      >
        {controls}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Views, last 14 days"
          value={formatCompact(view.views.current)}
          delta={view.views.delta}
          hint={
            view.views.delta === null
              ? 'no full previous period yet'
              : 'vs. previous 14 days'
          }
        />
        <StatTile
          label="Unique visitors"
          value={formatCompact(view.uniqueViews)}
          hint="summed per repo per day"
        />
        <StatTile
          label="Clones, last 14 days"
          value={formatCompact(view.clones.current)}
          delta={view.clones.delta}
          hint={
            view.clones.delta === null
              ? 'no full previous period yet'
              : 'vs. previous 14 days'
          }
        />
        <StatTile
          label="Unique cloners"
          value={formatCompact(view.uniqueClones)}
          hint={windowLabel}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {view.charts.map((c) => (
          <Card key={c.title}>
            <CardHeader>
              <CardTitle>Daily {c.title.toLowerCase()}, all history</CardTitle>
            </CardHeader>
            <CardContent>
              <TrendChart
                rows={c.rows}
                series={c.series}
                stacked={false}
                title={`Daily GitHub ${c.title.toLowerCase()}`}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <Table aria-label="Traffic by repository, last 14 days">
        <TableHeader>
          <TableRow>
            {head('repo', 'Repository')}
            <TableHead>Product</TableHead>
            {head('views', 'Views', RIGHT)}
            {head('uniqueViews', 'Unique', RIGHT)}
            {head('clones', 'Clones', RIGHT)}
            {head('uniqueClones', 'Unique', RIGHT)}
            <TableHead>Views trend</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground">
                {params.q ? `No repos match "${params.q}".` : 'No repos.'}
              </TableCell>
            </TableRow>
          )}
          {rows.map((r) => (
            <TableRow key={r.repo.repo}>
              <TableCell className="font-medium">
                <a
                  href={repoUrl(r.repo.repo)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                  title={r.repo.repo}
                >
                  {repoName(r.repo.repo)}
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              </TableCell>
              <TableCell>
                <Link
                  to={`/product/${r.product.id}`}
                  className="text-muted-foreground underline-offset-4 hover:underline"
                >
                  {r.product.name}
                </Link>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(r.views)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground tabular-nums">
                {formatNumber(r.uniqueViews)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(r.clones)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground tabular-nums">
                {formatNumber(r.uniqueClones)}
              </TableCell>
              <TableCell>
                <Sparkline
                  points={r.points}
                  label={`${r.repo.repo} views, last 14 days`}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-muted-foreground text-xs">
        Window {windowLabel}. Clone counts include CI checkouts and mirrors, so
        unique cloners is the better adoption signal.
      </p>
    </div>
  );
}

export default Traffic;
