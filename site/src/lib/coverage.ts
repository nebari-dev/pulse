import { type Coverage, SOURCE_LABEL, type Source } from '@/lib/summary';

const list = new Intl.ListFormat('en', { type: 'conjunction' });

export function sourceList(sources: readonly Source[]): string {
  return list.format(sources.map((s) => SOURCE_LABEL[s]));
}

/** "PyPI starts" etc., one line per date a source begins. */
export function coverageLines(
  cov: Coverage,
): Array<{ date: string; label: string }> {
  return cov.starts.map(({ date, sources }) => ({
    date,
    label: `${sourceList(sources)} ${sources.length > 1 ? 'start' : 'starts'}`,
  }));
}

/** Tooltip note for the incomplete tail. */
export function partialNote(cov: Coverage, weekly: boolean): string {
  const unit = weekly ? 'week' : 'day';
  if (cov.lagging.length === 0) return `This ${unit} is not over yet.`;
  return `${sourceList(cov.lagging)} ${cov.lagging.length > 1 ? 'have' : 'has'} not reported this ${unit} yet, so it reads low.`;
}
