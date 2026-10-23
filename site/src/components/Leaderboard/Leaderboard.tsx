import { ArrowDown, ArrowUp } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Sparkline from '@/components/Sparkline';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDelta, formatNumber } from '@/lib/format';
import {
  bucketWeekly,
  type Comparison,
  KIND_LABEL,
  type Point,
  type Product,
} from '@/lib/summary';
import { cn } from '@/lib/utils';

export interface LeaderboardRow {
  product: Product;
  comparison: Comparison;
  /** Share of the grand total in the window, 0..1. */
  share: number;
  /** Daily points inside the window, for the sparkline. */
  points: Point[];
}

type SortKey = 'name' | 'current' | 'delta' | 'share';

interface LeaderboardProps {
  rows: LeaderboardRow[];
  rangeLabel: string;
}

function compareRows(a: LeaderboardRow, b: LeaderboardRow, key: SortKey) {
  switch (key) {
    case 'name':
      return a.product.name.localeCompare(b.product.name);
    case 'current':
      return a.comparison.current - b.comparison.current;
    case 'delta':
      return (
        (a.comparison.delta ?? -Infinity) - (b.comparison.delta ?? -Infinity)
      );
    case 'share':
      return a.share - b.share;
  }
}

/** Every product and pack, sortable; the table view behind the chart. */
function Leaderboard({ rows, rangeLabel }: LeaderboardProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'current',
    dir: 'desc',
  });

  const sorted = [...rows].sort((a, b) => {
    const cmp = compareRows(a, b, sort.key);
    return sort.dir === 'asc' ? cmp : -cmp;
  });

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

  return (
    <Table aria-label={`Downloads by product, ${rangeLabel}`}>
      <TableHeader>
        <TableRow>
          {head('name', 'Product')}
          <TableHead>Kind</TableHead>
          {head('current', rangeLabel, 'text-right')}
          {head('delta', 'vs. previous', 'text-right')}
          {head('share', 'Share', 'text-right')}
          <TableHead>Trend</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map(({ product, comparison, share, points }) => (
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
            <TableCell className="text-right tabular-nums">
              {formatNumber(comparison.current)}
            </TableCell>
            <TableCell
              className={cn(
                'text-right tabular-nums',
                comparison.delta === null && 'text-muted-foreground',
              )}
            >
              {formatDelta(comparison.delta)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {(share * 100).toFixed(1)}%
            </TableCell>
            <TableCell>
              <Sparkline
                points={points.length > 120 ? bucketWeekly(points) : points}
                label={`${product.name} trend, ${rangeLabel}`}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default Leaderboard;
