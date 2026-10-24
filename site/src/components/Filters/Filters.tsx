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
  ARTIFACT_KIND_LABEL,
  ARTIFACT_KINDS,
  type ArtifactKindFilter,
  KIND_LABEL,
  type KindFilter,
  RANGE_LABEL,
  RANGES,
  type Range,
  SOURCE_LABEL,
  SOURCES,
  type SourceFilter,
} from '@/lib/summary';

/** The page-wide controls, always rendered in this order. */
export type FilterControl = 'range' | 'kind' | 'type' | 'source';

interface FiltersProps {
  params: DashboardParams;
  onChange: (patch: Partial<DashboardParams>) => void;
  /** Which controls this page offers; order is fixed regardless. */
  show?: FilterControl[];
}

const ALL: FilterControl[] = ['range', 'kind', 'type', 'source'];

const KIND_ITEMS: Array<{ value: KindFilter; label: string }> = [
  { value: 'all', label: 'Products and packs' },
  { value: 'product', label: `${KIND_LABEL.product}s` },
  { value: 'pack', label: `${KIND_LABEL.pack}s` },
];

const TYPE_ITEMS: Array<{ value: ArtifactKindFilter; label: string }> = [
  { value: 'all', label: 'All types' },
  ...ARTIFACT_KINDS.map((k) => ({ value: k, label: ARTIFACT_KIND_LABEL[k] })),
];

const SOURCE_ITEMS: Array<{ value: SourceFilter; label: string }> = [
  { value: 'all', label: 'All sources' },
  ...SOURCES.map((s) => ({ value: s, label: SOURCE_LABEL[s] })),
];

/**
 * The page-wide controls, placed in the PageHeader by every page: date range,
 * kind, artifact type, source, in that order, each only where the page uses
 * it. State is in the URL, so a filter set on one page carries to the next.
 */
function Filters({ params, onChange, show = ALL }: FiltersProps) {
  const has = (c: FilterControl) => show.includes(c);
  return (
    <div className="flex flex-wrap items-center gap-3">
      {has('range') && (
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
      )}

      {has('kind') && (
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

      {has('type') && (
        <Select
          items={TYPE_ITEMS}
          value={params.type}
          onValueChange={(value) =>
            onChange({ type: value as ArtifactKindFilter })
          }
        >
          <SelectTrigger aria-label="Artifact type" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {has('source') && (
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
      )}
    </div>
  );
}

export default Filters;
