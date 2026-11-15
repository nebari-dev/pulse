import { ExternalLink } from 'lucide-react';
import TableCard from '@/components/TableCard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, formatDelta, formatNumber } from '@/lib/format';
import {
  type ReleaseImpact as Impact,
  type ImpactGap,
  releaseUrl,
  repoName,
} from '@/lib/repos';
import { cn } from '@/lib/utils';

interface ReleaseImpactProps {
  impacts: Impact[];
  /** Window length on each side of a release, in days. */
  days: number;
  /** Name the repo next to each tag (products with several repos). */
  showRepo?: boolean;
}

const GAP: Record<ImpactGap, string> = {
  uncollected: 'before collection began',
  filling: 'still filling',
};

function Count({
  value,
  gap,
}: {
  value: number | null;
  gap: ImpactGap | null;
}) {
  const why = gap ? GAP[gap] : 'unknown';
  return (
    <TableCell className="text-right tabular-nums">
      {value === null ? (
        <span className="text-muted-foreground" title={why}>
          —<span className="sr-only"> ({why})</span>
        </span>
      ) : (
        formatNumber(value)
      )}
    </TableCell>
  );
}

/**
 * Downloads in the days before each recent stable release against the same
 * number of days from its release day, so a release's pull shows as a
 * number rather than a bump to eyeball.
 */
function ReleaseImpact({
  impacts,
  days,
  showRepo = false,
}: ReleaseImpactProps) {
  return (
    <TableCard
      title="Downloads around releases"
      info={
        <ul>
          <li>
            Downloads in the {days} days before each stable release, against the{' '}
            {days} days starting on its release day. The page's source and type
            filters apply.
          </li>
          <li>
            A dash means that window is not fully known: it starts before every
            source was collected, or it has not finished yet.
          </li>
          <li>
            Releases close together share days, so their windows overlap. Read
            the change as a hint, not a cause.
          </li>
        </ul>
      }
      footnote={`${impacts.length === 1 ? 'The newest stable release' : `The ${impacts.length} newest stable releases`} with download data on at least one side.`}
    >
      <Table
        aria-label={`Downloads ${days} days before and after each release`}
      >
        <TableHeader>
          <TableRow>
            <TableHead>Release</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">{days} days before</TableHead>
            <TableHead className="text-right">{days} days after</TableHead>
            <TableHead className="text-right">Change</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {impacts.map(
            ({ release: r, before, after, change, beforeGap, afterGap }) => (
              <TableRow key={`${r.repo}:${r.tag}`}>
                <TableCell>
                  <a
                    href={releaseUrl(r.repo, r.tag)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-xs underline-offset-4 hover:underline"
                  >
                    {r.tag}
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                  {showRepo && (
                    <span className="ml-2 text-muted-foreground text-xs">
                      {repoName(r.repo)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                  {formatDate(r.date, true)}
                </TableCell>
                <Count value={before} gap={beforeGap} />
                <Count value={after} gap={afterGap} />
                <TableCell
                  className={cn(
                    'text-right tabular-nums',
                    change === null && 'text-muted-foreground',
                  )}
                >
                  {formatDelta(change)}
                </TableCell>
              </TableRow>
            ),
          )}
        </TableBody>
      </Table>
    </TableCard>
  );
}

export default ReleaseImpact;
