import MultiSelect, { type MultiSelectItem } from '@/components/MultiSelect';
import { Tabs, TabsIndicator, TabsList, TabsTab } from '@/components/ui/tabs';
import type { DashboardParams } from '@/hooks/useDashboardParams';
import {
  ARTIFACT_KIND_LABEL,
  ARTIFACT_KINDS,
  type ArtifactKind,
  KIND_LABEL,
  KINDS,
  type Kind,
  RANGE_LABEL,
  RANGES,
  type Range,
  SOURCE_LABEL,
  SOURCES,
  type Source,
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

const KIND_ITEMS: MultiSelectItem<Kind>[] = KINDS.map((k) => ({
  value: k,
  label: `${KIND_LABEL[k]}s`,
}));

const TYPE_ITEMS: MultiSelectItem<ArtifactKind>[] = ARTIFACT_KINDS.map((k) => ({
  value: k,
  label: ARTIFACT_KIND_LABEL[k],
}));

const SOURCE_ITEMS: MultiSelectItem<Source>[] = SOURCES.map((s) => ({
  value: s,
  label: SOURCE_LABEL[s],
}));

/**
 * The page-wide controls, placed in the PageHeader by every page: date range,
 * kind, artifact type, source, in that order, each only where the page uses
 * it. Kind, type and source are multi-selects. State is in the URL, so a
 * filter set on one page carries to the next.
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
        <MultiSelect
          label="Kind"
          items={KIND_ITEMS}
          value={params.kind}
          onChange={(kind) => onChange({ kind })}
          allLabel="Products and packs"
          className="w-48"
        />
      )}

      {has('type') && (
        <MultiSelect
          label="Artifact type"
          items={TYPE_ITEMS}
          value={params.type}
          onChange={(type) => onChange({ type })}
          allLabel="All types"
          className="w-48"
        />
      )}

      {has('source') && (
        <MultiSelect
          label="Source"
          items={SOURCE_ITEMS}
          value={params.source}
          onChange={(source) => onChange({ source })}
          allLabel="All sources"
          className="w-48"
        />
      )}
    </div>
  );
}

export default Filters;
