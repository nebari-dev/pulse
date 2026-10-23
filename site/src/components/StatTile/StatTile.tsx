import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatDelta } from '@/lib/format';
import { cn } from '@/lib/utils';

interface StatTileProps {
  label: string;
  value: string;
  /** Fractional change vs. the previous period; null renders a dash. */
  delta?: number | null;
  hint?: string;
  className?: string;
}

/**
 * A single headline number. Delta is shown with an icon and text so direction
 * is never carried by color alone.
 */
function StatTile({ label, value, delta, hint, className }: StatTileProps) {
  const direction =
    delta == null ? null : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const Icon =
    direction === 'up'
      ? ArrowUpRight
      : direction === 'down'
        ? ArrowDownRight
        : Minus;
  return (
    <Card size="sm" className={cn('motion-safe:animate-fade-in', className)}>
      <CardContent className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className="font-semibold text-3xl tracking-tight">{value}</p>
        {delta !== undefined && (
          <p
            className={cn(
              'flex items-center gap-1 text-sm',
              direction === 'up' && 'text-success-foreground',
              direction === 'down' && 'text-destructive-foreground',
              (direction === 'flat' || direction === null) &&
                'text-muted-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span>
              {formatDelta(delta)}
              <span className="sr-only">
                {direction === 'up'
                  ? ' increase'
                  : direction === 'down'
                    ? ' decrease'
                    : ''}
              </span>
              {hint && <span className="text-muted-foreground"> {hint}</span>}
            </span>
          </p>
        )}
        {delta === undefined && hint && (
          <p className="text-muted-foreground text-sm">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default StatTile;
