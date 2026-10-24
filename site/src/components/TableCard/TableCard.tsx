import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TableCardProps {
  title: string;
  /** Controls that filter this table only (selects first, search last). */
  controls?: ReactNode;
  /** Small print under the table. */
  footnote?: ReactNode;
  children: ReactNode;
}

/**
 * A card around one table, with the table's own controls at the top right of
 * the card, mirroring how PageHeader holds the page-wide controls.
 */
function TableCard({ title, controls, footnote, children }: TableCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>{title}</CardTitle>
        {controls && (
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
            {controls}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {children}
        {footnote && (
          <p className="text-muted-foreground text-xs">{footnote}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default TableCard;
