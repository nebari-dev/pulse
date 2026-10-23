import { Link } from 'react-router-dom';
import { formatDate } from '@/lib/format';
import { type ReleaseWithRepo, releaseUrl, repoName } from '@/lib/repos';
import { addDays, diffDays, type ProductBase } from '@/lib/summary';
import { cn } from '@/lib/utils';

export interface TimelineRow {
  product: ProductBase;
  /** Releases inside the window, any order. */
  releases: ReleaseWithRepo[];
}

interface ReleaseTimelineProps {
  rows: TimelineRow[];
  start: string;
  end: string;
  title: string;
}

/** Evenly spaced tick dates across the window, first and last included. */
function ticks(start: string, end: string, count: number): string[] {
  const span = diffDays(start, end);
  if (span <= 0) return [start];
  const n = Math.min(count, span + 1);
  return Array.from({ length: n }, (_, i) =>
    addDays(start, Math.round((span * i) / (n - 1))),
  );
}

/**
 * One row per product, a mark per release on a shared time axis. Stable
 * releases are filled, prereleases hollow, so the difference does not rest
 * on color. Marks are links to the GitHub release, so they are focusable
 * and hoverable; rows with nothing in the window stay visible as empty
 * tracks, so absence is a fact the reader can see.
 */
function ReleaseTimeline({ rows, start, end, title }: ReleaseTimelineProps) {
  const span = Math.max(diffDays(start, end), 1);
  const x = (date: string) => (diffDays(start, date) / span) * 100;
  const axis = ticks(start, end, 6);
  return (
    <figure aria-label={title} className="flex flex-col gap-2 text-sm">
      <ul
        className="flex gap-4 text-muted-foreground text-xs"
        aria-label="Legend"
      >
        <li className="flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 rounded-full bg-chart-1"
            aria-hidden="true"
          />
          stable
        </li>
        <li className="flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 rounded-full border-2 border-chart-1 bg-card"
            aria-hidden="true"
          />
          prerelease
        </li>
      </ul>
      <div className="grid grid-cols-[minmax(8rem,14rem)_1fr] gap-x-3">
        <div aria-hidden="true" />
        <div
          className="relative h-5 text-muted-foreground text-xs"
          aria-hidden="true"
        >
          {axis.map((d, i) => (
            <span
              key={d}
              className={cn(
                'absolute top-0 whitespace-nowrap',
                i === axis.length - 1
                  ? '-translate-x-full'
                  : i > 0 && '-translate-x-1/2',
              )}
              style={{ left: `${x(d)}%` }}
            >
              {formatDate(d, i === 0 || i === axis.length - 1)}
            </span>
          ))}
        </div>
        {rows.map(({ product, releases }) => (
          <div key={product.id} className="contents">
            <Link
              to={`/product/${product.id}`}
              className="truncate border-border border-t py-1.5 underline-offset-4 hover:underline"
            >
              {product.name}
            </Link>
            <div
              className="relative border-border border-t"
              role="list"
              aria-label={`${product.name} releases`}
            >
              {axis.map((d) => (
                <span
                  key={d}
                  aria-hidden="true"
                  className="absolute top-0 bottom-0 border-border/60 border-l"
                  style={{ left: `${x(d)}%` }}
                />
              ))}
              {releases.length === 0 && (
                <span className="sr-only">none in this period</span>
              )}
              {releases.map((r) => (
                <a
                  key={`${r.repo}:${r.tag}`}
                  role="listitem"
                  href={releaseUrl(r.repo, r.tag)}
                  target="_blank"
                  rel="noreferrer"
                  title={`${r.tag} · ${formatDate(r.date, true)} · ${repoName(r.repo)}${r.prerelease ? ' · prerelease' : ''}`}
                  aria-label={`${r.tag}, ${formatDate(r.date, true)}, ${repoName(r.repo)}${r.prerelease ? ', prerelease' : ''}`}
                  data-prerelease={r.prerelease ? 'true' : undefined}
                  className={cn(
                    '-translate-x-1/2 -translate-y-1/2 absolute top-1/2 block size-3 rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-transform hover:scale-125',
                    r.prerelease
                      ? 'border-2 border-chart-1 bg-card'
                      : 'bg-chart-1',
                  )}
                  style={{ left: `${x(r.date)}%` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </figure>
  );
}

export default ReleaseTimeline;
