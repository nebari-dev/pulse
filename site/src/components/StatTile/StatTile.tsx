import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { formatDelta } from '@/lib/format';
import { cn } from '@/lib/utils';

interface StatTileProps {
  label: string;
  value: string;
  /** Fractional change vs. the previous period; null means there is no
   * previous period to compare, and only the hint is shown. */
  delta?: number | null;
  hint?: string;
  className?: string;
}

/**
 * One headline figure: label, value, one line of context. Lives inside a
 * StatRow, which draws the dividers. Delta is shown with an icon and text so
 * direction is never carried by color alone.
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
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1 border-border border-t border-l px-(--card-spacing) py-3',
        className,
      )}
    >
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="font-semibold text-2xl tracking-tight">{value}</p>
      {direction !== null ? (
        <p
          className={cn(
            'flex items-center gap-1 text-sm',
            direction === 'up' && 'text-success-foreground',
            direction === 'down' && 'text-destructive-foreground',
            direction === 'flat' && 'text-muted-foreground',
          )}
        >
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          <span>
            {formatDelta(delta ?? null)}
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
      ) : (
        hint && <p className="text-muted-foreground text-sm">{hint}</p>
      )}
    </div>
  );
}

export default StatTile;
