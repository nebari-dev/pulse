import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ARTIFACT_KINDS,
  type ArtifactKind,
  KINDS,
  type Kind,
  RANGES,
  type Range,
  SOURCES,
  type Source,
} from '@/lib/summary';

export interface DashboardParams {
  range: Range;
  /** Products and/or packs. */
  kind: Kind[];
  /** Artifact types: image, chart, package, binary. */
  type: ArtifactKind[];
  source: Source[];
  /** Free-text search over table rows. */
  q: string;
  /** Docs site ids; empty means every site. */
  site: string[];
}

const DEFAULTS: DashboardParams = {
  range: '90d',
  kind: [...KINDS],
  type: [...ARTIFACT_KINDS],
  source: [...SOURCES],
  q: '',
  site: [],
};

function isRange(v: string | null): v is Range {
  return (RANGES as readonly string[]).includes(v ?? '');
}

/** A comma-separated list, keeping only known values in canonical order;
 * the fallback when nothing valid is left. */
function parseList<T extends string>(
  raw: string | null,
  known: readonly T[],
  fallback: T[],
): T[] {
  const picked = new Set(raw?.split(',') ?? []);
  const list = known.filter((v) => picked.has(v));
  return list.length > 0 ? list : fallback;
}

function serialize(value: string | string[]): string {
  return Array.isArray(value) ? value.join(',') : value;
}

function sameValue(a: string | string[], b: string | string[]): boolean {
  if (!Array.isArray(a) || !Array.isArray(b)) return a === b;
  return a.length === b.length && a.every((v) => b.includes(v));
}

/**
 * Filter state lives in the URL so any view is shareable. Multi-selects are
 * comma-separated lists. A page may override the defaults (Downloads leaves
 * Helm charts out); pass a module-level constant so it stays stable. Values
 * equal to the page's default are omitted from the query string, so the same
 * link can mean the page's default on each page.
 */
export function useDashboardParams(
  overrides?: Partial<DashboardParams>,
): [DashboardParams, (patch: Partial<DashboardParams>) => void] {
  const [params, setParams] = useSearchParams();
  const defaults = useMemo(() => ({ ...DEFAULTS, ...overrides }), [overrides]);
  const range = params.get('range');
  const kind = params.get('kind');
  const type = params.get('type');
  const source = params.get('source');
  const q = params.get('q');
  const site = params.get('site');
  // Parsed once per query string, so the arrays are stable for memo deps.
  const current = useMemo<DashboardParams>(
    () => ({
      range: isRange(range) ? range : defaults.range,
      kind: parseList(kind, KINDS, defaults.kind),
      type: parseList(type, ARTIFACT_KINDS, defaults.type),
      source: parseList(source, SOURCES, defaults.source),
      q: q ?? defaults.q,
      site: site ? site.split(',') : defaults.site,
    }),
    [defaults, range, kind, type, source, q, site],
  );

  const update = useCallback(
    (patch: Partial<DashboardParams>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (sameValue(value, defaults[key as keyof DashboardParams])) {
              next.delete(key);
            } else {
              next.set(key, serialize(value));
            }
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams, defaults],
  );

  return [current, update];
}
