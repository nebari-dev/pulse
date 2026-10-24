import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import InfoPopover from '@/components/InfoPopover';
import { formatDelta } from '@/lib/format';
import { cn } from '@/lib/utils';

interface StatTileProps {
  label: string;
  value: string;
  /** Fractional change vs. the previous period; null means there is no
   * previous period to compare, and the delta line is left out. */
  delta?: number | null;
  /** What the figure covers and where it comes from, behind an (i) next to
   * the label. */
  info?: ReactNode;
  className?: string;
}

/**
 * One headline figure: label with its (i), the value, and the change vs. the
 * previous period when there is one. Lives inside a StatRow, which draws the
 * dividers. Delta is shown with an icon and text so direction is never
 * carried by color alone.
 */
function StatTile({ label, value, delta, info, className }: StatTileProps) {
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
        'flex min-w-0 flex-col gap-0.5 border-border border-t border-l px-(--card-spacing) py-2.5',
        className,
      )}
    >
      <p className="flex items-center gap-1 text-muted-foreground text-xs">
        {label}
        {info && <InfoPopover topic={label}>{info}</InfoPopover>}
      </p>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <p className="font-semibold text-xl tracking-tight">{value}</p>
        {direction !== null && (
          <p
            className={cn(
              'flex items-center gap-0.5 text-xs',
              direction === 'up' && 'text-success-foreground',
              direction === 'down' && 'text-destructive-foreground',
              direction === 'flat' && 'text-muted-foreground',
            )}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {formatDelta(delta ?? null)}
              <span className="sr-only">
                {direction === 'up'
                  ? ' increase'
                  : direction === 'down'
                    ? ' decrease'
                    : ''}
              </span>
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

export default StatTile;
