import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsIndicator, TabsList, TabsTab } from '@/components/ui/tabs';
import type { DashboardParams } from '@/hooks/useDashboardParams';
import {
  KIND_LABEL,
  type KindFilter,
  RANGE_LABEL,
  RANGES,
  type Range,
  SOURCE_LABEL,
  SOURCES,
  type SourceFilter,
} from '@/lib/summary';

interface FiltersProps {
  params: DashboardParams;
  onChange: (patch: Partial<DashboardParams>) => void;
  /** Hide the kind filter (e.g. on a single product's page). */
  showKind?: boolean;
}

const KIND_ITEMS: Array<{ value: KindFilter; label: string }> = [
  { value: 'all', label: 'Products and packs' },
  { value: 'product', label: `${KIND_LABEL.product}s` },
  { value: 'pack', label: `${KIND_LABEL.pack}s` },
];

const SOURCE_ITEMS: Array<{ value: SourceFilter; label: string }> = [
  { value: 'all', label: 'All sources' },
  ...SOURCES.map((s) => ({ value: s, label: SOURCE_LABEL[s] })),
];

/** One row of controls: date range, kind, source. State is in the URL. */
function Filters({ params, onChange, showKind = true }: FiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Tabs
        value={params.range}
        onValueChange={(value) => onChange({ range: value as Range })}
      >
        <TabsList aria-label="Date range">
          {RANGES.map((r) => (
            <TabsTab key={r} value={r}>
              {RANGE_LABEL[r]}
            </TabsTab>
          ))}
          <TabsIndicator />
        </TabsList>
      </Tabs>

      {showKind && (
        <Select
          items={KIND_ITEMS}
          value={params.kind}
          onValueChange={(value) => onChange({ kind: value as KindFilter })}
        >
          <SelectTrigger aria-label="Kind" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KIND_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select
        items={SOURCE_ITEMS}
        value={params.source}
        onValueChange={(value) => onChange({ source: value as SourceFilter })}
      >
        <SelectTrigger aria-label="Source" className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SOURCE_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default Filters;
