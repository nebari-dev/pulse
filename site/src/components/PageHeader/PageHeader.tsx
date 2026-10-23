import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description: string;
  /** Controls rendered on the right (filters, search). */
  children?: ReactNode;
}

/** Title, one-line description and the page's controls on one row. */
function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {children}
    </div>
  );
}

export default PageHeader;
