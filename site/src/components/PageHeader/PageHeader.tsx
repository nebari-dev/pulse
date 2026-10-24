import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Shown next to the title, e.g. a product/pack badge. */
  badge?: ReactNode;
  /** The page-wide controls (usually <Filters>), always top right. */
  children?: ReactNode;
}

/**
 * Title, one-line description and the page's controls on one row. Every page
 * uses it, so page-wide filters sit in the same place everywhere; controls
 * that filter one table belong in that table's TableCard instead.
 */
function PageHeader({ title, description, badge, children }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 max-w-3xl flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
          {badge}
        </div>
        {description && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

export default PageHeader;
