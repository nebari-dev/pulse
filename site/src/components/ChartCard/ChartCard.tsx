import type { ReactNode } from 'react';
import InfoPopover from '@/components/InfoPopover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ChartCardProps {
  title: string;
  /** How to read the chart, behind an (i) next to the title. */
  info?: ReactNode;
  /** Small print under the chart: the data's state, not how to read it. */
  footnote?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * A card around one chart (or a small table), with its explanation behind an
 * info button next to the title. The counterpart of TableCard.
 */
function ChartCard({
  title,
  info,
  footnote,
  className,
  children,
}: ChartCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-1">
          {title}
          {info && <InfoPopover topic={title}>{info}</InfoPopover>}
        </CardTitle>
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

export default ChartCard;
