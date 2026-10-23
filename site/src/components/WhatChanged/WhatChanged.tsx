import { ArrowDownRight, ArrowUpRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Mover, QuietRepo, RecentRelease } from '@/lib/changes';
import { formatDate, formatDelta, formatNumber } from '@/lib/format';
import { releaseUrl, repoName, repoUrl } from '@/lib/repos';
import { cn } from '@/lib/utils';

interface WhatChangedProps {
  movers: { up: Mover[]; down: Mover[] };
  releases: RecentRelease[];
  quiet: QuietRepo[];
  /** Last day of the week being described. */
  asOf: string;
}

/**
 * One strip for the weekly visitor: biggest movers, releases, and repos
 * that just went quiet. Sections with nothing to say are left out, and the
 * strip renders nothing at all when every section is empty.
 */
function WhatChanged({ movers, releases, quiet, asOf }: WhatChangedProps) {
  const hasMovers = movers.up.length + movers.down.length > 0;
  if (!hasMovers && releases.length === 0 && quiet.length === 0) return null;
  return (
    <Card size="sm" aria-labelledby="what-changed-heading">
      <CardHeader>
        <CardTitle id="what-changed-heading">
          This week, to {formatDate(asOf)}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 text-sm md:grid-cols-3">
        {hasMovers && (
          <section aria-label="Biggest movers" className="flex flex-col gap-2">
            <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Movers vs. the week before
            </h3>
            <ul className="flex flex-col gap-1.5">
              {[...movers.up, ...movers.down].map(({ product, comparison }) => {
                const up = (comparison.delta ?? 0) > 0;
                const Icon = up ? ArrowUpRight : ArrowDownRight;
                return (
                  <li key={product.id} className="flex items-center gap-2">
                    <Icon
                      className={cn(
                        'size-4 shrink-0',
                        up
                          ? 'text-success-foreground'
                          : 'text-destructive-foreground',
                      )}
                      aria-hidden="true"
                    />
                    <Link
                      to={`/product/${product.id}`}
                      className="truncate underline-offset-4 hover:underline"
                    >
                      {product.name}
                    </Link>
                    <span
                      className={cn(
                        'ml-auto shrink-0 tabular-nums',
                        up
                          ? 'text-success-foreground'
                          : 'text-destructive-foreground',
                      )}
                    >
                      {formatDelta(comparison.delta)}
                      <span className="sr-only">
                        {up ? ' increase' : ' decrease'}
                      </span>
                    </span>
                    <span className="w-14 shrink-0 text-right text-muted-foreground tabular-nums">
                      {formatNumber(comparison.current)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {releases.length > 0 && (
          <section
            aria-label="Releases this week"
            className="flex flex-col gap-2"
          >
            <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Released
            </h3>
            <ul className="flex flex-col gap-1.5">
              {releases.slice(0, 8).map((r) => (
                <li
                  key={`${r.repo}:${r.tag}`}
                  className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
                >
                  <span className="w-12 shrink-0 text-muted-foreground tabular-nums">
                    {formatDate(r.date)}
                  </span>
                  <Link
                    to={`/product/${r.product.id}`}
                    className="underline-offset-4 hover:underline"
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
              {releases.length > 8 && (
                <li className="text-muted-foreground">
                  <Link
                    to="/releases"
                    className="underline-offset-4 hover:underline"
                  >
                    and {releases.length - 8} more
                  </Link>
                </li>
              )}
            </ul>
          </section>
        )}
        {quiet.length > 0 && (
          <section
            aria-label="Repos that went quiet"
            className="flex flex-col gap-2"
          >
            <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Went quiet (no push in 90 days)
            </h3>
            <ul className="flex flex-col gap-1.5">
              {quiet.map(({ product, repo, daysSincePush }) => (
                <li key={repo.repo} className="flex items-center gap-2">
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
                  <Link
                    to={`/product/${product.id}`}
                    className="truncate text-muted-foreground underline-offset-4 hover:underline"
                  >
                    {product.name}
                  </Link>
                  <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
                    {daysSincePush} d
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}

export default WhatChanged;
