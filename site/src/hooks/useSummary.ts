import { useQuery } from '@tanstack/react-query';
import type { Summary } from '@/lib/summary';

export const SUMMARY_URL = '/data/summary.json';

async function fetchSummary(): Promise<Summary> {
  const res = await fetch(SUMMARY_URL);
  if (!res.ok) throw new Error(`Could not load ${SUMMARY_URL}: ${res.status}`);
  return res.json() as Promise<Summary>;
}

/** The collector's summary.json; static per deploy, so never refetched. */
export function useSummary() {
  return useQuery({
    queryKey: ['summary'],
    queryFn: fetchSummary,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
