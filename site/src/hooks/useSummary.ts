import { useQuery } from '@tanstack/react-query';
import type { ProductDetail, ReposFile, Summary } from '@/lib/summary';

export const SUMMARY_URL = '/data/summary.json';
export const REPOS_URL = '/data/repos.json';
export const productUrl = (id: string) =>
  `/data/products/${encodeURIComponent(id)}.json`;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * The collector's files are static per deploy, so they are never refetched.
 * Each page loads only what it shows: the Downloads page the index, the
 * repo pages repos.json, a product page its own file.
 */
const STATIC = { staleTime: Number.POSITIVE_INFINITY } as const;

/** summary.json: every product with totals and series grouped by source and type. */
export function useSummary() {
  return useQuery({
    queryKey: ['summary'],
    queryFn: () => fetchJson<Summary>(SUMMARY_URL),
    ...STATIC,
  });
}

/** repos.json: every product's GitHub repos (health, traffic, releases). */
export function useRepos() {
  return useQuery({
    queryKey: ['repos'],
    queryFn: () => fetchJson<ReposFile>(REPOS_URL),
    ...STATIC,
  });
}

/** products/<id>.json, or null when no such product is published. */
export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ['product', id],
    enabled: id !== undefined,
    queryFn: async () => {
      const res = await fetch(productUrl(id ?? ''));
      if (res.status === 404) return null;
      if (!res.ok)
        throw new Error(`Could not load product ${id}: ${res.status}`);
      return (await res.json()) as ProductDetail;
    },
    ...STATIC,
  });
}
