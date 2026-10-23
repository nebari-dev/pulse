import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name and placeholder, e.g. "Search products". */
  label: string;
  className?: string;
}

/**
 * A text filter for a table, magnifier on the left. State belongs to the
 * caller (usually the URL). The icon and clear button need a z-index because
 * the Nebari Input wraps itself in a positioned div that follows them.
 */
function SearchBox({ value, onChange, label, className }: SearchBoxProps) {
  return (
    <div className={cn('relative w-full max-w-xs', className)}>
      <Search
        className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 z-10 size-4 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        role="searchbox"
        aria-label={label}
        placeholder={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="-translate-y-1/2 absolute top-1/2 right-0.5 z-10 size-7"
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  );
}

export default SearchBox;
