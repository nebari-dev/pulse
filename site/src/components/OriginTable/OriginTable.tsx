import type { ReactNode } from 'react';
import TableCard from '@/components/TableCard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatNumber } from '@/lib/format';
import type { OriginRank } from '@/lib/summary';

interface OriginTableProps {
  title: string;
  /** Header of the name column, e.g. "Referrer" or "Country". */
  column: string;
  rank: OriginRank;
  /** Turns a stored name into what the reader sees. */
  label?: (name: string) => string;
  info?: ReactNode;
  footnote?: ReactNode;
  /** Shown in the body when there is nothing to rank. */
  empty: string;
}

/**
 * A ranked list of where page views came from (referrers, countries), with a
 * share bar against the total and the remainder in one "Other" row.
 */
function OriginTable({
  title,
  column,
  rank,
  label = (name) => name,
  info,
  footnote,
  empty,
}: OriginTableProps) {
  const share = (n: number) =>
    rank.total ? Math.round((n / rank.total) * 1000) / 10 : 0;
  const rows = [
    ...rank.top.map((r) => ({ ...r, muted: false })),
    ...(rank.other > 0
      ? [{ name: 'Other', pageviews: rank.other, muted: true }]
      : []),
  ];
  return (
    <TableCard title={title} info={info} footnote={footnote}>
      <Table aria-label={title}>
        <TableHeader>
          <TableRow>
            <TableHead>{column}</TableHead>
            <TableHead className="w-1/3">Share</TableHead>
            <TableHead className="text-right">Page views</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-muted-foreground">
                {empty}
              </TableCell>
            </TableRow>
          )}
          {rows.map((r) => (
            <TableRow key={r.muted ? '(other)' : r.name}>
              <TableCell
                className={r.muted ? 'text-muted-foreground' : 'font-medium'}
              >
                {r.muted ? r.name : label(r.name)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 rounded-full bg-muted">
                    <div
                      className={
                        r.muted
                          ? 'h-2 rounded-full bg-muted-foreground'
                          : 'h-2 rounded-full bg-chart-1'
                      }
                      style={{ width: `${share(r.pageviews)}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-muted-foreground text-xs tabular-nums">
                    {share(r.pageviews)}%
                  </span>
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
  );
}

export default OriginTable;
