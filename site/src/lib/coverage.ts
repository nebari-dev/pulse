import { type Coverage, SOURCE_LABEL, type Source } from '@/lib/summary';

const list = new Intl.ListFormat('en', { type: 'conjunction' });

export function sourceList(sources: readonly Source[]): string {
  return list.format(sources.map((s) => SOURCE_LABEL[s]));
}

const sourceLabel = (s: Source) => SOURCE_LABEL[s];

/**
 * "PyPI starts" etc., one line per start; "Data starts" when every series
 * begins there. `label` names a key (defaults to source names).
 */
export function coverageLines<K extends string>(
  cov: Coverage<K>,
  label: (key: K) => string = sourceLabel as (key: K) => string,
): Array<{ date: string; label: string }> {
  return cov.starts.map(({ date, keys }) => ({
    date,
    label:
      keys.length === cov.keys.length && keys.length > 1
        ? 'Data starts'
        : `${list.format(keys.map(label))} ${keys.length > 1 ? 'start' : 'starts'}`,
  }));
}

/** Tooltip note for the incomplete tail. */
export function partialNote<K extends string>(
  cov: Coverage<K>,
  weekly: boolean,
  label: (key: K) => string = sourceLabel as (key: K) => string,
): string {
  const unit = weekly ? 'week' : 'day';
  if (cov.lagging.length === 0) return `This ${unit} is not over yet.`;
  const names = list.format(cov.lagging.map(label));
  return `${names} ${cov.lagging.length > 1 ? 'have' : 'has'} not reported this ${unit} yet, so it reads low.`;
}
