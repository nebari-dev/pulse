import { ArrowDown, ArrowUp, ExternalLink } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import SearchBox from '@/components/SearchBox';
import StatTile from '@/components/StatTile';
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
import { formatAgo, formatDate, formatNumber } from '@/lib/format';
import {
  daysSincePush,
  healthTotals,
  repoName,
  repoUrl,
  starsDelta,
} from '@/lib/repos';
import {
  KIND_LABEL,
  type KindFilter,
  matchesKind,
  matchesQuery,
  type Product,
  type Repo,
  type Summary,
  windowFor,
} from '@/lib/summary';
import { cn } from '@/lib/utils';

interface Row {
  product: Product;
  repo: Repo;
  starsGained: number | null;
  pushAge: number | null;
}

type SortKey =
  | 'repo'
  | 'stars'
  | 'gained'
  | 'issues'
  | 'prs'
  | 'merged'
  | 'push';
const RIGHT = 'text-right [&>button]:justify-end';
const KIND_ITEMS: Array<{ value: KindFilter; label: string }> = [
  { value: 'all', label: 'Products and packs' },
  { value: 'product', label: 'Products' },
  { value: 'pack', label: 'Packs' },
];

function useRepos(summary: Summary | undefined) {
  const [params, setParams] = useDashboardParams();
  const view = useMemo(() => {
    if (!summary) return null;
    const asOf = summary.generated_at;
    const { start } = windowFor('30d', asOf, '1970-01-01');
    const rows: Row[] = summary.products
      .filter((p) => matchesKind(p, params.kind))
      .flatMap((product) =>
        product.repos.map((repo) => ({
          product,
          repo,
          starsGained: starsDelta(repo, start),
          pushAge: daysSincePush(repo, asOf),
        })),
      );
    const totals = healthTotals(rows.map((r) => r.repo));
    const quiet = rows.filter((r) => (r.pushAge ?? 0) > 90).length;
    const snapshots = Math.max(
      ...rows.map((r) => r.repo.health_series.length),
      0,
    );
    return { asOf, rows, totals, quiet, snapshots };
  }, [summary, params.kind]);
  return { params, setParams, view };
}

function num(a: number | null) {
  return a ?? -Infinity;
}

function compareRows(a: Row, b: Row, key: SortKey) {
  switch (key) {
    case 'repo':
      return a.repo.repo.localeCompare(b.repo.repo);
    case 'stars':
      return (
        num(a.repo.health?.stars ?? null) - num(b.repo.health?.stars ?? null)
      );
    case 'gained':
      return num(a.starsGained) - num(b.starsGained);
    case 'issues':
      return (
        num(a.repo.health?.open_issues ?? null) -
        num(b.repo.health?.open_issues ?? null)
      );
    case 'prs':
      return (
        num(a.repo.health?.open_prs ?? null) -
        num(b.repo.health?.open_prs ?? null)
      );
    case 'merged':
      return (
        num(a.repo.health?.merged_prs_30d ?? null) -
        num(b.repo.health?.merged_prs_30d ?? null)
      );
    case 'push':
      // Most recent push first when descending: fewer days ago = larger.
      return -(num(a.pushAge) - num(b.pushAge));
  }
}

function Cell({ value }: { value: number | null | undefined }) {
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

function Repos() {
  const { data, error, isPending } = useSummary();
  const { params, setParams, view } = useRepos(data);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'stars',
    dir: 'desc',
  });

  if (error) {
    return (
      <p role="alert" className="text-destructive-foreground">
        Could not load repository data: {error.message}
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

  const rows = (view?.rows ?? [])
    .filter((r) =>
      matchesQuery(params.q, r.repo.repo, r.product.name, r.product.id),
    )
    .sort((a, b) => {
      const cmp = compareRows(a, b, sort.key);
      return sort.dir === 'asc' ? cmp : -cmp;
    });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Repositories"
        description="Stars, open work and throughput for every GitHub repo behind a product or pack."
      >
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
      </PageHeader>

      {isPending || !view ? (
        <Skeleton className="h-64" shape="block" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Stars"
              value={formatNumber(view.totals.stars)}
              hint={`across ${view.totals.repos} repos`}
            />
            <StatTile
              label="Open issues"
              value={formatNumber(view.totals.open_issues)}
              hint={`${formatNumber(view.totals.open_prs)} open pull requests`}
            />
            <StatTile
              label="PRs merged, 30 days"
              value={formatNumber(view.totals.merged_prs_30d)}
              hint="all tracked repos"
            />
            <StatTile
              label="Quiet repos"
              value={String(view.quiet)}
              hint="no push in 90 days"
            />
          </div>

          <Table aria-label="Repository health">
            <TableHeader>
              <TableRow>
                {head('repo', 'Repository')}
                <TableHead>Product</TableHead>
                {head('stars', 'Stars', RIGHT)}
                {head('gained', '+30d', RIGHT)}
                {head('issues', 'Open issues', RIGHT)}
                {head('prs', 'Open PRs', RIGHT)}
                {head('merged', 'Merged, 30d', RIGHT)}
                {head('push', 'Last push')}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground">
                    {params.q
                      ? `No repos match "${params.q}".`
                      : 'No repos tracked yet.'}
                  </TableCell>
                </TableRow>
              )}
              {rows.map(({ product, repo, starsGained, pushAge }) => (
                <TableRow key={repo.repo}>
                  <TableCell className="font-medium">
                    <a
                      href={repoUrl(repo.repo)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                      title={repo.repo}
                    >
                      {repoName(repo.repo)}
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/product/${product.id}`}
                      className="text-muted-foreground underline-offset-4 hover:underline"
                    >
                      {product.name}
                    </Link>
                    <span className="sr-only">
                      {' '}
                      ({KIND_LABEL[product.kind]})
                    </span>
                  </TableCell>
                  <Cell value={repo.health?.stars} />
                  <TableCell
                    className={cn(
                      'text-right tabular-nums',
                      starsGained === null && 'text-muted-foreground',
                    )}
                  >
                    {starsGained === null
                      ? '—'
                      : `${starsGained > 0 ? '+' : ''}${starsGained}`}
                  </TableCell>
                  <Cell value={repo.health?.open_issues} />
                  <Cell value={repo.health?.open_prs} />
                  <Cell value={repo.health?.merged_prs_30d} />
                  <TableCell
                    className={cn(
                      'tabular-nums',
                      (pushAge ?? 0) > 90 && 'text-destructive-foreground',
                    )}
                    title={repo.health?.pushed_at ?? undefined}
                  >
                    {formatAgo(pushAge)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-muted-foreground text-xs">
            Snapshot taken {formatDate(view.asOf, true)}. "+30d" is stars gained
            since the first snapshot in the last 30 days
            {view.snapshots < 2 && ' and needs a second day of data'}. Repos
            with no push in 90 days are marked.
          </p>
        </>
      )}
    </div>
  );
}

export default Repos;
