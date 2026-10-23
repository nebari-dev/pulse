/**
 * "What changed this week": the handful of facts a weekly visitor wants
 * first, derived from the index and the repos file. Pure helpers; the
 * WhatChanged component renders them.
 */
import {
  daysSincePush,
  productReleases,
  type ReleaseWithRepo,
} from '@/lib/repos';
import {
  type ArtifactFilter,
  addDays,
  artifactsOf,
  type Comparison,
  compareArtifacts,
  headlineArtifacts,
  type KindFilter,
  matchesKind,
  type ProductIndex,
  type ProductRepos,
  type Repo,
  type ReposFile,
} from '@/lib/summary';

export const WEEK = 7;
/** Below this many downloads in the week a swing is noise, not a mover. */
export const MIN_WEEKLY = 20;

export interface Mover {
  product: ProductIndex;
  comparison: Comparison;
}

/**
 * Products with the largest percentage change in the last 7 days vs. the 7
 * before, split into up and down, biggest swing first. Respects the kind,
 * type and source filters so the strip agrees with the page.
 */
export function movers(
  products: ProductIndex[],
  filter: ArtifactFilter & { kind: KindFilter },
  asOf: string,
  limit = 3,
): { up: Mover[]; down: Mover[] } {
  const start = addDays(asOf, -(WEEK - 1));
  const all: Mover[] = [];
  for (const product of products) {
    if (!matchesKind(product, filter.kind)) continue;
    const counted = headlineArtifacts(
      artifactsOf(product.groups, filter),
      filter,
    );
    const comparison = compareArtifacts(counted, start, asOf);
    if (comparison.delta === null) continue;
    if (Math.max(comparison.current, comparison.previous) < MIN_WEEKLY)
      continue;
    if (comparison.delta === 0) continue;
    all.push({ product, comparison });
  }
  const byMagnitude = (a: Mover, b: Mover) =>
    Math.abs(b.comparison.delta ?? 0) - Math.abs(a.comparison.delta ?? 0);
  return {
    up: all
      .filter((m) => (m.comparison.delta ?? 0) > 0)
      .sort(byMagnitude)
      .slice(0, limit),
    down: all
      .filter((m) => (m.comparison.delta ?? 0) < 0)
      .sort(byMagnitude)
      .slice(0, limit),
  };
}

export interface RecentRelease extends ReleaseWithRepo {
  product: ProductRepos;
}

/** Releases (prereleases included) published in the last `days` days, newest first. */
export function recentReleases(
  repos: ReposFile,
  kind: KindFilter,
  days = WEEK,
): RecentRelease[] {
  const since = addDays(repos.generated_at, -(days - 1));
  return repos.products
    .filter((p) => matchesKind(p, kind))
    .flatMap((product) =>
      productReleases(product, { includePrereleases: true })
        .filter((r) => r.date >= since)
        .map((r) => ({ ...r, product })),
    )
    .sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
}

export interface QuietRepo {
  product: ProductRepos;
  repo: Repo;
  daysSincePush: number;
}

/**
 * Repos whose last push crossed the 90-day mark during the last `days`
 * days: quiet now, but not a week ago.
 */
export function wentQuiet(
  repos: ReposFile,
  kind: KindFilter,
  days = WEEK,
  threshold = 90,
): QuietRepo[] {
  const out: QuietRepo[] = [];
  for (const product of repos.products) {
    if (!matchesKind(product, kind)) continue;
    for (const repo of product.repos) {
      const age = daysSincePush(repo, repos.generated_at);
      if (age !== null && age > threshold && age <= threshold + days) {
        out.push({ product, repo, daysSincePush: age });
      }
    }
  }
  return out.sort((a, b) => a.daysSincePush - b.daysSincePush);
}
