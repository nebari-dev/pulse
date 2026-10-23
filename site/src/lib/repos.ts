/**
 * Pure helpers over the per-product `repos` data in summary.json: release
 * cadence, repository health and GitHub traffic.
 */
import {
  addDays,
  diffDays,
  type Point,
  type Product,
  type Release,
  type Repo,
  type TrafficPoint,
} from '@/lib/summary';

export function repoUrl(repo: string): string {
  return `https://github.com/${repo}`;
}

export function releaseUrl(repo: string, tag: string): string {
  return `https://github.com/${repo}/releases/tag/${encodeURIComponent(tag)}`;
}

// ---- releases ----------------------------------------------------------------

export interface ReleaseWithRepo extends Release {
  repo: string;
}

/** Every release of a product across its repos, newest first. */
export function productReleases(
  product: Product,
  { includePrereleases = false } = {},
): ReleaseWithRepo[] {
  return product.repos
    .flatMap((r) =>
      r.releases
        .filter((rel) => includePrereleases || !rel.prerelease)
        .map((rel) => ({ ...rel, repo: r.repo })),
    )
    .sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
}

export interface Cadence {
  latest: ReleaseWithRepo | null;
  /** Days between the latest release and `asOf`. */
  daysSince: number | null;
  /** Releases inside the last `days` days. */
  recent: number;
  /** Median gap between consecutive releases in the last year, in days. */
  medianGapDays: number | null;
}

/**
 * Cadence over the releases given (already filtered for prereleases).
 * The median gap uses releases from the last 365 days so a project that was
 * busy two years ago and is dormant now does not look healthy.
 */
export function cadence(
  releases: ReleaseWithRepo[],
  asOf: string,
  days: number,
): Cadence {
  const latest = releases[0] ?? null;
  const since = addDays(asOf, -(days - 1));
  const yearAgo = addDays(asOf, -364);
  const lastYear = releases
    .filter((r) => r.date >= yearAgo)
    .map((r) => r.date)
    .sort();
  const gaps: number[] = [];
  for (let i = 1; i < lastYear.length; i++) {
    const gap = diffDays(lastYear[i - 1], lastYear[i]);
    if (gap > 0) gaps.push(gap);
  }
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  const median =
    gaps.length === 0
      ? null
      : gaps.length % 2
        ? gaps[mid]
        : Math.round((gaps[mid - 1] + gaps[mid]) / 2);
  return {
    latest,
    daysSince: latest ? diffDays(latest.date, asOf) : null,
    recent: releases.filter((r) => r.date >= since && r.date <= asOf).length,
    medianGapDays: median,
  };
}

/** Releases per ISO week as a Point series, for a sparkline. */
export function releasesPerWeek(
  releases: Release[],
  start: string,
  end: string,
): Point[] {
  const byWeek = new Map<string, number>();
  for (const r of releases) {
    if (r.date < start || r.date > end) continue;
    byWeek.set(r.date, (byWeek.get(r.date) ?? 0) + 1);
  }
  return [...byWeek]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, count]) => ({ date, count }));
}

// ---- traffic -----------------------------------------------------------------

export type TrafficMetric = keyof Omit<TrafficPoint, 'date'>;

export const TRAFFIC_METRICS: TrafficMetric[] = [
  'views',
  'unique_views',
  'clones',
  'unique_clones',
];
export const TRAFFIC_LABEL: Record<TrafficMetric, string> = {
  views: 'Views',
  unique_views: 'Unique visitors',
  clones: 'Clones',
  unique_clones: 'Unique cloners',
};

export function trafficSeries(repos: Repo[], metric: TrafficMetric): Point[] {
  const byDate = new Map<string, number>();
  for (const r of repos) {
    for (const t of r.traffic) {
      byDate.set(t.date, (byDate.get(t.date) ?? 0) + t[metric]);
    }
  }
  return [...byDate]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, count]) => ({ date, count }));
}

export function trafficTotal(
  repos: Repo[],
  metric: TrafficMetric,
  start: string,
  end: string,
): number {
  let sum = 0;
  for (const r of repos) {
    for (const t of r.traffic) {
      if (t.date >= start && t.date <= end) sum += t[metric];
    }
  }
  return sum;
}

/** The later of two ISO dates. (Math.max would coerce them to NaN.) */
export function laterDate(a: string, b: string): string {
  return a < b ? b : a;
}

/** Earliest and latest traffic dates across repos, or null without data. */
export function trafficRange(
  repos: Repo[],
): { start: string; end: string } | null {
  let start = '';
  let end = '';
  for (const r of repos) {
    const first = r.traffic[0];
    const last = r.traffic.at(-1);
    if (first && (!start || first.date < start)) start = first.date;
    if (last && last.date > end) end = last.date;
  }
  return start ? { start, end } : null;
}

// ---- health ------------------------------------------------------------------

export interface HealthTotals {
  stars: number;
  forks: number;
  open_issues: number;
  open_prs: number;
  merged_prs_30d: number;
  repos: number;
}

export function healthTotals(repos: Repo[]): HealthTotals {
  const t: HealthTotals = {
    stars: 0,
    forks: 0,
    open_issues: 0,
    open_prs: 0,
    merged_prs_30d: 0,
    repos: 0,
  };
  for (const r of repos) {
    if (!r.health) continue;
    t.repos += 1;
    t.stars += r.health.stars ?? 0;
    t.forks += r.health.forks ?? 0;
    t.open_issues += r.health.open_issues ?? 0;
    t.open_prs += r.health.open_prs ?? 0;
    t.merged_prs_30d += r.health.merged_prs_30d ?? 0;
  }
  return t;
}

/** Stars gained between the first snapshot on or after `start` and the last. */
export function starsDelta(repo: Repo, start: string): number | null {
  const inRange = repo.health_series.filter(
    (h) => h.date >= start && h.stars !== null,
  );
  const first = inRange[0];
  const last = inRange.at(-1);
  if (!first || !last || first === last) return null;
  return (last.stars ?? 0) - (first.stars ?? 0);
}

/** Days between a repo's last push and `asOf`, or null when unknown. */
export function daysSincePush(repo: Repo, asOf: string): number | null {
  return repo.health?.pushed_at ? diffDays(repo.health.pushed_at, asOf) : null;
}

/** Name of the repo without its owner. */
export function repoName(repo: string): string {
  return repo.split('/')[1] ?? repo;
}
