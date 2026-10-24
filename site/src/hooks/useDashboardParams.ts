import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ARTIFACT_KINDS,
  type ArtifactKindFilter,
  type KindFilter,
  RANGES,
  type Range,
  SOURCES,
  type SourceFilter,
} from '@/lib/summary';

export interface DashboardParams {
  range: Range;
  /** Product vs pack. */
  kind: KindFilter;
  /** Artifact type: image, chart, package, binary. */
  type: ArtifactKindFilter;
  source: SourceFilter;
  /** Free-text search over table rows. */
  q: string;
  /** Docs site id, or 'all'. */
  site: string;
}

const DEFAULTS: DashboardParams = {
  range: '90d',
  kind: 'all',
  type: 'all',
  source: 'all',
  q: '',
  site: 'all',
};

function isRange(v: string | null): v is Range {
  return (RANGES as readonly string[]).includes(v ?? '');
}
function isKind(v: string | null): v is KindFilter {
  return v === 'product' || v === 'pack';
}
function isType(v: string | null): v is ArtifactKindFilter {
  return (ARTIFACT_KINDS as readonly string[]).includes(v ?? '');
}
function isSource(v: string | null): v is SourceFilter {
  return (SOURCES as readonly string[]).includes(v ?? '');
}

/**
 * Filter state lives in the URL so any view is shareable. Defaults are
 * omitted from the query string to keep links short.
 */
export function useDashboardParams(): [
  DashboardParams,
  (patch: Partial<DashboardParams>) => void,
] {
  const [params, setParams] = useSearchParams();
  const range = params.get('range');
  const kind = params.get('kind');
  const type = params.get('type');
  const source = params.get('source');
  const current: DashboardParams = {
    range: isRange(range) ? range : DEFAULTS.range,
    kind: isKind(kind) ? kind : DEFAULTS.kind,
    type: isType(type) ? type : DEFAULTS.type,
    source: isSource(source) ? source : DEFAULTS.source,
    q: params.get('q') ?? DEFAULTS.q,
    site: params.get('site') ?? DEFAULTS.site,
  };

  const update = useCallback(
    (patch: Partial<DashboardParams>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value === DEFAULTS[key as keyof DashboardParams]) {
              next.delete(key);
            } else {
              next.set(key, value);
            }
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return [current, update];
}
