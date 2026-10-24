import { ExternalLink } from 'lucide-react';
import { useMemo } from 'react';
import Filters from '@/components/Filters';
import MultiSelect from '@/components/MultiSelect';
import PageHeader from '@/components/PageHeader';
import SearchBox from '@/components/SearchBox';
import StatTile from '@/components/StatTile';
import TableCard from '@/components/TableCard';
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
  windowFor,
} from '@/lib/summary';

/** Rows shown in the top-pages table before asking the reader to narrow down. */
const PAGE_ROWS = 50;

/**
 * Sites that get a headline tile, in this order. The others (Classic, JHub
 * Apps) still appear in the chart and the top-pages table.
 */
const TILE_SITES = [
  { id: 'docs', name: 'Nebari docs' },
  { id: 'packs-docs', name: 'Software Packs docs' },
  { id: 'nebi-docs', name: 'Nebi docs' },
];

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
    sites.forEach((site, i) => {
      bySite[site.id] = points(site, 'visits');
      chartSeries.push({
        key: site.id,
        label: site.name,
        color: SITE_COLORS[i % SITE_COLORS.length],
      });
    });
    const tiles = TILE_SITES.map(({ id, name }) => {
      const site = sites.find((s) => s.id === id);
      return {
        id,
        name: site?.name ?? name,
        visits: site
          ? compare(points(site, 'visits'), start, end, earliest)
          : null,
        pageviews: site
          ? compare(points(site, 'pageviews'), start, end, earliest)
          : null,
      };
    });
    const all = Object.values(bySite).flat();
    const pages = sites
      .flatMap((site) =>
        site.top_pages.map((p) => ({
          site,
          path: p.path,
          pageviews: p.pageviews,
        })),
      )
      .sort((a, b) => b.pageviews - a.pageviews);
    const pagesDate = sites
      .map((s) => s.top_pages_date ?? '')
      .sort()
      .at(-1);
    return {
      empty: false as const,
      pages,
      pagesDate: pagesDate || null,
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

  const header = (
    <PageHeader
      title="Docs"
      description="Visits and page views of the documentation sites, counted at the Cloudflare edge so cookie consent does not hide them."
    >
      <Filters params={params} onChange={setParams} show={['range']} />
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

  const siteItems = view.sites.map((site) => ({
    value: site.id,
    label: site.name,
  }));
  // No site in the URL means every site, including ones added later.
  const sites =
    params.site.length > 0 ? params.site : siteItems.map((i) => i.value);
  const rows = view.pages.filter(
    (r) =>
      sites.includes(r.site.id) && matchesQuery(params.q, r.path, r.site.name),
  );
  const max = Math.max(...rows.map((r) => r.pageviews), 1);

  return (
    <div className="flex flex-col gap-6">
      {header}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {view.tiles.map(({ id, name, visits, pageviews }) =>
          visits && pageviews ? (
            <StatTile
              key={id}
              label={`${name}, visits`}
              value={formatCompact(visits.current)}
              delta={visits.delta}
              hint={
                (visits.delta === null
                  ? 'no full previous period yet'
                  : 'vs. previous period') +
                ` · ${formatCompact(pageviews.current)} page views`
              }
            />
          ) : (
            <StatTile
              key={id}
              label={`${name}, visits`}
              value="—"
              hint="no data collected yet"
            />
          ),
        )}
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

      <TableCard
        title="Top pages, last 7 days"
        controls={
          <>
            <MultiSelect
              label="Site"
              items={siteItems}
              value={sites}
              onChange={(next) =>
                setParams({
                  site: next.length === siteItems.length ? [] : next,
                })
              }
              allLabel="All sites"
              className="w-56"
            />
            <SearchBox
              value={params.q}
              onChange={(q) => setParams({ q })}
              label="Search pages"
            />
          </>
        }
        footnote={
          <>
            {rows.length > PAGE_ROWS &&
              `Showing ${PAGE_ROWS} of ${rows.length} pages; narrow with the site filter or search. `}
            {view.pagesDate &&
              `Snapshot taken ${formatDate(view.pagesDate, true)}. `}
            HTML pages only, as counted at the Cloudflare edge.
          </>
        }
      >
        <Table aria-label="Top documentation pages, last 7 days">
          <TableHeader>
            <TableRow>
              <TableHead>Site</TableHead>
              <TableHead>Path</TableHead>
              <TableHead className="w-1/3">Share</TableHead>
              <TableHead className="text-right">Page views</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  {params.q
                    ? `No pages match "${params.q}".`
                    : 'No page data yet.'}
                </TableCell>
              </TableRow>
            )}
            {rows.slice(0, PAGE_ROWS).map((r) => (
              <TableRow key={`${r.site.id}:${r.path}`}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {r.site.name}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  <a
                    href={`https://${r.site.hosts[0]}${r.path}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                  >
                    {r.path}
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                </TableCell>
                <TableCell>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-chart-1"
                      style={{ width: `${(r.pageviews / max) * 100}%` }}
                    />
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(r.pageviews)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>
    </div>
  );
}

export default Docs;
