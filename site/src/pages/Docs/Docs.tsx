import { ExternalLink } from 'lucide-react';
import { useMemo } from 'react';
import ChartCard from '@/components/ChartCard';
import Filters from '@/components/Filters';
import PageHeader from '@/components/PageHeader';
import SearchBox from '@/components/SearchBox';
import StatTile from '@/components/StatTile';
import TableCard from '@/components/TableCard';
import TrendChart, { type TrendSeries } from '@/components/TrendChart';
import { Card, CardContent } from '@/components/ui/card';
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
import { coverageLines, partialNote } from '@/lib/coverage';
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
  seriesCoverage,
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
  'var(--chart-2)',
];

function points(site: DocsSite, metric: 'visits' | 'pageviews'): Point[] {
  return site.series.map((p) => ({ date: p.date, count: p[metric] }));
}

function useDocsView(docs: DocsFile | undefined) {
  const [params, setParams] = useDashboardParams();
  const view = useMemo(() => {
    if (!docs) return null;
    const collected = docs.sites.filter((s) => s.series.length > 0);
    if (collected.length === 0) return { empty: true as const };
    // The site filter narrows the chart and the table; tiles stay fixed.
    const sites = collected.filter(
      (s) => params.site.length === 0 || params.site.includes(s.id),
    );
    let asOf = '';
    let earliest = '';
    for (const s of collected) {
      const first = s.series[0]?.date ?? '';
      const last = s.series.at(-1)?.date ?? '';
      if (last > asOf) asOf = last;
      if (first && (!earliest || first < earliest)) earliest = first;
    }
    const { start, end, days } = windowFor(params.range, asOf, earliest);
    const weekly = days > 120;
    const bySite: Record<string, Point[]> = {};
    const chartSeries: TrendSeries[] = [];
    for (const site of sites) {
      bySite[site.id] = points(site, 'visits');
      // Hue by position among all sites, so filtering keeps colors stable.
      const i = collected.indexOf(site);
      chartSeries.push({
        key: site.id,
        label: site.name,
        color: SITE_COLORS[i % SITE_COLORS.length],
      });
    }
    const tiles = TILE_SITES.map(({ id, name }) => {
      const site = collected.find((s) => s.id === id);
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
    const cov = seriesCoverage(
      sites.map((site) => ({ key: site.id, series: points(site, 'visits') })),
      start,
      end,
      weekly,
    );
    const siteName = (id: string) => sites.find((s) => s.id === id)?.name ?? id;
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
      lines: coverageLines(cov, siteName),
      partialFrom: cov.partialFrom,
      partialNote: partialNote(cov, weekly, siteName),
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
    };
  }, [docs, params.range, params.site]);
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
      <Filters
        params={params}
        onChange={setParams}
        show={['range', 'site']}
        sites={data?.sites
          .filter((s) => s.series.length > 0)
          .map((s) => ({ value: s.id, label: s.name }))}
      />
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

  const rows = view.pages.filter((r) =>
    matchesQuery(params.q, r.path, r.site.name),
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

      <ChartCard
        title={`${view.weekly ? 'Weekly' : 'Daily'} visits by site`}
        info={
          <ul>
            <li>
              Visits per {view.weekly ? 'week' : 'day'} to each documentation
              site, counted by Cloudflare at the edge, so cookie consent and ad
              blockers do not hide them.
            </li>
            <li>
              A visit is a page view not preceded by another from the same
              visitor in the last 30 minutes. HTML pages only, bots excluded.
            </li>
            <li>
              Lines overlap rather than stack; hover for each site's number.
            </li>
            <li>
              A dashed line marks where the data begins: Cloudflare keeps about
              30 days, so history starts from Pulse's first collection.
            </li>
          </ul>
        }
      >
        <TrendChart
          rows={view.chartRows}
          series={view.chartSeries}
          weekly={view.weekly}
          stacked={false}
          markers={view.markers}
          lines={view.lines}
          partialFrom={view.partialFrom}
          partialNote={view.partialNote}
          title={`${view.weekly ? 'Weekly' : 'Daily'} docs visits by site, ${rangeLabel}`}
        />
      </ChartCard>

      <TableCard
        title="Top pages, last 7 days"
        info={
          <ul>
            <li>
              Page views per path over the last 7 days, the top 200 per site,
              from a snapshot taken daily.
            </li>
            <li>Share is of the largest page in the list.</li>
          </ul>
        }
        controls={
          <SearchBox
            value={params.q}
            onChange={(q) => setParams({ q })}
            label="Search pages"
          />
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
