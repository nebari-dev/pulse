import { Children, type ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatRowProps {
  /** StatTiles; each carries its own (i). */
  children: ReactNode;
  className?: string;
}

/** Column count by tile count; four splits two-and-two before lg. */
const COLUMNS: Record<number, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
};

/**
 * The headline figures of a page on one slim surface, separated by hairlines
 * rather than each in its own card. Every tile draws a top and left border;
 * the grid is shifted up and left by one pixel so the outer ones fall under
 * the card edge, which works for any wrap.
 */
function StatRow({ children, className }: StatRowProps) {
  const count = Children.count(children);
  return (
    <Card size="sm" className={cn('gap-0 py-0', className)}>
      <div
        className={cn(
          '-mt-px -ml-px grid',
          COLUMNS[count] ?? 'sm:grid-cols-2 lg:grid-cols-3',
        )}
      >
        {children}
      </div>
    </Card>
  );
}

export default StatRow;
