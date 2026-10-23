import { ArrowDown, ArrowUp, ExternalLink } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import SearchBox from '@/components/SearchBox';
import Sparkline from '@/components/Sparkline';
import StatTile from '@/components/StatTile';
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
import { Tabs, TabsIndicator, TabsList, TabsTab } from '@/components/ui/tabs';
import { useDashboardParams } from '@/hooks/useDashboardParams';
import { useRepos } from '@/hooks/useSummary';
import { formatAgo, formatDate } from '@/lib/format';
import {
  type Cadence,
  cadence,
  productReleases,
  type ReleaseWithRepo,
  releasesPerWeek,
  releaseUrl,
  repoName,
} from '@/lib/repos';
import {
  KIND_LABEL,
  matchesKind,
  matchesQuery,
  type Point,
  type ProductRepos,
  RANGE_LABEL,
  RANGES,
  type Range,
  type ReposFile,
  windowFor,
} from '@/lib/summary';
import { cn } from '@/lib/utils';

interface Row {
  product: ProductRepos;
  cadence: Cadence;
  points: Point[];
}

type SortKey = 'name' | 'latest' | 'recent' | 'gap';
const RIGHT = 'text-right [&>button]:justify-end';

function useReleases(summary: ReposFile | undefined) {
  const [params, setParams] = useDashboardParams();
  const view = useMemo(() => {
    if (!summary) return null;
    const asOf = summary.generated_at;
    const { start, end, days } = windowFor(params.range, asOf, '1970-01-01');
    const products = summary.products.filter(
      (p) => p.repos.length > 0 && matchesKind(p, params.kind),
    );
    const rows: Row[] = products.map((product) => {
      const releases = productReleases(product);
      return {
        product,
        cadence: cadence(releases, asOf, days),
        points: releasesPerWeek(releases, start, end),
      };
    });
    const feed: Array<ReleaseWithRepo & { product: ProductRepos }> = products
      .flatMap((product) =>
        productReleases(product, { includePrereleases: true })
          .filter((r) => r.date >= start && r.date <= end)
          .map((r) => ({ ...r, product })),
      )
      .sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
    const recent = rows.reduce((acc, r) => acc + r.cadence.recent, 0);
    const active = rows.filter((r) => r.cadence.recent > 0).length;
    return { asOf, start, end, rows, feed, recent, active };
  }, [summary, params.range, params.kind]);
  return { params, setParams, view };
}

function compareRows(a: Row, b: Row, key: SortKey) {
  switch (key) {
    case 'name':
      return a.product.name.localeCompare(b.product.name);
    case 'latest':
      return (a.cadence.latest?.date ?? '').localeCompare(
        b.cadence.latest?.date ?? '',
      );
    case 'recent':
      return a.cadence.recent - b.cadence.recent;
    case 'gap':
      return (
        (a.cadence.medianGapDays ?? Infinity) -
        (b.cadence.medianGapDays ?? Infinity)
      );
  }
}

function Releases() {
  const { data, error, isPending } = useRepos();
  const { params, setParams, view } = useReleases(data);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'latest',
    dir: 'desc',
  });
  const rangeLabel = RANGE_LABEL[params.range];

  if (error) {
    return (
      <p role="alert" className="text-destructive-foreground">
        Could not load release data: {error.message}
      </p>
    );
  }

  function toggle(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'name' ? 'asc' : 'desc' },
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

  const rows = (view?.rows ?? [])
    .filter((r) => matchesQuery(params.q, r.product.name, r.product.id))
    .sort((a, b) => {
      const cmp = compareRows(a, b, sort.key);
      return sort.dir === 'asc' ? cmp : -cmp;
    });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Releases"
        description="How often each product ships, from GitHub Releases. Prereleases are listed in the feed but do not count towards cadence."
      >
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
          <SearchBox
            value={params.q}
            onChange={(q) => setParams({ q })}
            label="Search products"
          />
        </div>
      </PageHeader>

      {isPending || !view ? (
        <Skeleton className="h-64" shape="block" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile
              label={`Releases, ${rangeLabel.toLowerCase()}`}
              value={String(view.recent)}
              hint="stable releases across all products"
            />
            <StatTile
              label="Products that shipped"
              value={`${view.active} of ${view.rows.length}`}
              hint={`at least one release, ${rangeLabel.toLowerCase()}`}
            />
            <StatTile
              label="Data through"
              value={formatDate(view.asOf)}
              hint="release dates from GitHub"
            />
          </div>

          <Table aria-label={`Release cadence by product, ${rangeLabel}`}>
            <TableHeader>
              <TableRow>
                {head('name', 'Product')}
                <TableHead>Kind</TableHead>
                {head('latest', 'Latest release')}
                {head('recent', rangeLabel, RIGHT)}
                {head('gap', 'Median gap', RIGHT)}
                <TableHead>Releases per week</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    {params.q
                      ? `No products match "${params.q}".`
                      : 'No products with repos yet.'}
                  </TableCell>
                </TableRow>
              )}
              {rows.map(({ product, cadence: c, points }) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">
                    <Link
                      to={`/product/${product.id}`}
                      className="underline-offset-4 hover:underline focus-visible:underline"
                    >
                      {product.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        product.kind === 'pack' ? 'secondary' : 'outline'
                      }
                    >
                      {KIND_LABEL[product.kind]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {c.latest ? (
                      <span className="flex flex-col">
                        <a
                          href={releaseUrl(c.latest.repo, c.latest.tag)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-xs underline-offset-4 hover:underline"
                        >
                          {c.latest.tag}
                          <ExternalLink className="size-3" aria-hidden="true" />
                        </a>
                        <span
                          className={cn(
                            'text-muted-foreground text-xs',
                            (c.daysSince ?? 0) > 180 &&
                              'text-destructive-foreground',
                          )}
                        >
                          {formatAgo(c.daysSince)}
                          {product.repos.length > 1 &&
                            ` · ${repoName(c.latest.repo)}`}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">no releases</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.recent}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.medianGapDays === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      `${c.medianGapDays} d`
                    )}
                  </TableCell>
                  <TableCell>
                    <Sparkline
                      points={points}
                      label={`${product.name} releases, ${rangeLabel}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-muted-foreground text-xs">
            Median gap is measured over the last year of stable releases.
            Products whose latest release is more than six months old are
            marked.
          </p>

          <Card>
            <CardHeader>
              <CardTitle>Release feed, {rangeLabel.toLowerCase()}</CardTitle>
            </CardHeader>
            <CardContent>
              {view.feed.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No releases in this period.
                </p>
              ) : (
                <ol className="flex flex-col divide-y divide-border">
                  {view.feed.slice(0, 50).map((r) => (
                    <li
                      key={`${r.repo}:${r.tag}`}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
                    >
                      <span className="w-20 shrink-0 text-muted-foreground tabular-nums">
                        {formatDate(r.date)}
                      </span>
                      <Link
                        to={`/product/${r.product.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {r.product.name}
                      </Link>
                      <a
                        href={releaseUrl(r.repo, r.tag)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs underline-offset-4 hover:underline"
                      >
                        {r.tag}
                        <ExternalLink className="size-3" aria-hidden="true" />
                      </a>
                      {r.prerelease && (
                        <Badge variant="secondary">prerelease</Badge>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default Releases;
