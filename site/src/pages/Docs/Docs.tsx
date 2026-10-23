import { ExternalLink } from 'lucide-react';
import { useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import SearchBox from '@/components/SearchBox';
import StatTile from '@/components/StatTile';
import TrendChart, { type TrendSeries } from '@/components/TrendChart';
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
import { Tabs, TabsIndicator, TabsList, TabsTab } from '@/components/ui/tabs';
import { useDashboardParams } from '@/hooks/useDashboardParams';
import { useDocs } from '@/hooks/useSummary';
import { markersFor } from '@/lib/anomalies';
import { formatCompact, formatDate, formatNumber } from '@/lib/format';
import {
  between,
  chartRows,
  compare,
  type DocsFile,
  type DocsSite,
  matchesQuery,
  type Point,
  RANGE_LABEL,
  RANGES,
  type Range,
  windowFor,
} from '@/lib/summary';

/** Fixed hue per site, consistent across the chart and the tiles. */
const SITE_COLORS = [
  'var(--chart-1)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

function points(site: DocsSite, metric: 'visits' | 'pageviews'): Point[] {
  return site.series.map((p) => ({ date: p.date, count: p[metric] }));
}

function useDocsView(docs: DocsFile | undefined) {
  const [params, setParams] = useDashboardParams();
  const view = useMemo(() => {
    if (!docs) return null;
    const sites = docs.sites.filter((s) => s.series.length > 0);
    if (sites.length === 0) return { empty: true as const };
    let asOf = '';
    let earliest = '';
    for (const s of sites) {
      const first = s.series[0]?.date ?? '';
      const last = s.series.at(-1)?.date ?? '';
      if (last > asOf) asOf = last;
      if (first && (!earliest || first < earliest)) earliest = first;
    }
    const { start, end, days } = windowFor(params.range, asOf, earliest);
    const weekly = days > 120;
    const bySite: Record<string, Point[]> = {};
    const chartSeries: TrendSeries[] = [];
    const tiles = sites.map((site, i) => {
      const visits = points(site, 'visits');
      bySite[site.id] = visits;
      chartSeries.push({
        key: site.id,
        label: site.name,
        color: SITE_COLORS[i % SITE_COLORS.length],
      });
      return {
        site,
        visits: compare(visits, start, end, earliest),
        pageviews: compare(points(site, 'pageviews'), start, end, earliest),
      };
    });
    const all = Object.values(bySite).flat();
    return {
      empty: false as const,
      asOf,
      start,
      end,
      weekly,
      tiles,
      chartRows: chartRows(bySite, start, end, weekly),
      chartSeries,
      markers: weekly ? [] : markersFor(between(all, start, end), 'visits'),
      sites,
    };
  }, [docs, params.range]);
  return { params, setParams, view };
}

function Docs() {
  const { data, error, isPending } = useDocs();
  const { params, setParams, view } = useDocsView(data);
  const rangeLabel = RANGE_LABEL[params.range];

  if (error) {
    return (
      <p role="alert" className="text-destructive-foreground">
        Could not load docs traffic: {error.message}
      </p>
    );
  }

  const controls = (
    <div className="flex flex-wrap items-center gap-3">
      <Tabs
        value={params.range}
        onValueChange={(value) => setParams({ range: value as Range })}
      >
        <TabsList aria-label="Date range">
          {RANGES.map((r) => (
            <TabsTab key={r} value={r}>
              {RANGE_LABEL[r]}
            </TabsTab>
          ))}
          <TabsIndicator />
        </TabsList>
      </Tabs>
    </div>
  );
  const header = (
    <PageHeader
      title="Docs"
      description="Visits and page views of the documentation sites, counted at the Cloudflare edge so cookie consent does not hide them."
    >
      {controls}
    </PageHeader>
  );

  if (isPending || !view) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Skeleton className="h-64" shape="block" />
      </div>
    );
  }
  if (view.empty) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Card>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="font-medium">No docs traffic yet.</p>
            <p className="text-muted-foreground">
              The collector reads Cloudflare zone analytics for the docs hosts.
              It needs an API token with Zone:Read and Analytics:Read on the
              zone, stored as the repository secret{' '}
              <code>CLOUDFLARE_ANALYTICS_TOKEN</code>; see the README.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {header}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {view.tiles.map(({ site, visits, pageviews }) => (
          <StatTile
            key={site.id}
            label={`${site.name}, visits`}
            value={formatCompact(visits.current)}
            delta={visits.delta}
            hint={
              (visits.delta === null
                ? 'no full previous period yet'
                : 'vs. previous period') +
              ` · ${formatCompact(pageviews.current)} page views`
            }
          />
        ))}
        <StatTile
          label="Data through"
          value={formatDate(view.asOf)}
          hint={`collected ${formatDate(data.generated_at, true)}`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {view.weekly ? 'Weekly' : 'Daily'} visits by site
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart
            rows={view.chartRows}
            series={view.chartSeries}
            weekly={view.weekly}
            stacked={false}
            markers={view.markers}
            title={`${view.weekly ? 'Weekly' : 'Daily'} docs visits by site, ${rangeLabel}`}
          />
          <p className="mt-2 text-muted-foreground text-xs">
            A visit is a page view not preceded by another from the same visitor
            within the last 30 minutes, as Cloudflare counts it. HTML responses
            only, bots excluded.
          </p>
        </CardContent>
      </Card>

      <SearchBox
        value={params.q}
        onChange={(q) => setParams({ q })}
        label="Search pages"
      />
      {/* One full-width table per site, so paths stay readable. */}
      <div className="flex flex-col gap-6">
        {view.sites.map((site) => {
          const rows = site.top_pages.filter((p) =>
            matchesQuery(params.q, p.path),
          );
          const max = Math.max(...site.top_pages.map((p) => p.pageviews), 1);
          return (
            <Card key={site.id}>
              <CardHeader>
                <CardTitle>{site.name}: top pages, last 7 days</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Table aria-label={`${site.name} top pages`}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Path</TableHead>
                      <TableHead className="w-1/2">Share</TableHead>
                      <TableHead className="text-right">Page views</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-muted-foreground"
                        >
                          {params.q
                            ? `No pages match "${params.q}".`
                            : 'No page data yet.'}
                        </TableCell>
                      </TableRow>
                    )}
                    {rows.slice(0, 25).map((p) => (
                      <TableRow key={p.path}>
                        <TableCell className="font-mono text-xs">
                          <a
                            href={`https://${site.hosts[0]}${p.path}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                          >
                            {p.path}
                            <ExternalLink
                              className="size-3"
                              aria-hidden="true"
                            />
                          </a>
                        </TableCell>
                        <TableCell>
                          <div className="h-2 w-full rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-chart-1"
                              style={{ width: `${(p.pageviews / max) * 100}%` }}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(p.pageviews)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {site.top_pages_date && (
                  <p className="text-muted-foreground text-xs">
                    Snapshot taken {formatDate(site.top_pages_date, true)}.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default Docs;
