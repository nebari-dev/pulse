import { ArrowDown, ArrowUp, ExternalLink } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Sparkline from '@/components/Sparkline';
import TableCard from '@/components/TableCard';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatAgo } from '@/lib/format';
import {
  type Cadence,
  cadence,
  productReleases,
  releasesPerWeek,
  releaseUrl,
  repoName,
} from '@/lib/repos';
import {
  KIND_LABEL,
  type Point,
  type ProductRepos,
  windowFor,
} from '@/lib/summary';
import { cn } from '@/lib/utils';

interface ReleaseCadenceProps {
  /** Products to list; those without repos are left out. */
  products: ProductRepos[];
  /** Last day of the data, from repos.json. */
  asOf: string;
}

interface Row {
  product: ProductRepos;
  cadence: Cadence;
  points: Point[];
}

type SortKey = 'name' | 'latest' | 'recent' | 'gap';
const RIGHT = 'text-right [&>button]:justify-end';

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

/**
 * How often each product ships, from GitHub Releases, over the last 90 days
 * to match the other 90-day columns on the Repos page. Prereleases do not
 * count; the product page lists them in its release feed.
 */
function ReleaseCadence({ products, asOf }: ReleaseCadenceProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'latest',
    dir: 'desc',
  });
  const view = useMemo(() => {
    const { start, end, days } = windowFor('90d', asOf, '1970-01-01');
    const rows: Row[] = products
      .filter((p) => p.repos.length > 0)
      .map((product) => {
        const releases = productReleases(product);
        return {
          product,
          cadence: cadence(releases, asOf, days),
          points: releasesPerWeek(releases, start, end),
        };
      });
    const recent = rows.reduce((n, r) => n + r.cadence.recent, 0);
    const active = rows.filter((r) => r.cadence.recent > 0).length;
    return { rows, recent, active };
  }, [products, asOf]);

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

  const rows = [...view.rows].sort((a, b) => {
    const cmp = compareRows(a, b, sort.key);
    return sort.dir === 'asc' ? cmp : -cmp;
  });

  return (
    <TableCard
      title="Release cadence"
      info={
        <ul>
          <li>Stable GitHub releases of each product's repos.</li>
          <li>
            "90d" counts releases in the last 90 days. Median gap is measured
            over the last year. Prereleases are left out of both.
          </li>
          <li>
            Products whose latest release is more than six months old are
            marked.
          </li>
          <li>Each product page lists its releases, prereleases included.</li>
        </ul>
      }
      footnote={`${view.recent} stable ${view.recent === 1 ? 'release' : 'releases'} in the last 90 days; ${view.active} of ${view.rows.length} products shipped.`}
    >
      <Table aria-label="Release cadence by product, last 90 days">
        <TableHeader>
          <TableRow>
            {head('name', 'Product')}
            <TableHead>Kind</TableHead>
            {head('latest', 'Latest release')}
            {head('recent', '90d', RIGHT)}
            {head('gap', 'Median gap', RIGHT)}
            <TableHead>Releases per week</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                No products with repos yet.
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
                  variant={product.kind === 'pack' ? 'secondary' : 'outline'}
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
                  label={`${product.name} releases, last 90 days`}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  );
}

export default ReleaseCadence;
