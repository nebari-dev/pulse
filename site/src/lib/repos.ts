/**
 * Pure helpers over the per-product `repos` data in summary.json: release
 * cadence, repository health and GitHub traffic.
 */
import {
  addDays,
  diffDays,
  type HealthPoint,
  type Point,
  type Product,
  type Release,
  type Repo,
  type StarPoint,
  type TrafficPoint,
  weekStart,
} from '@/lib/summary';

export function repoUrl(repo: string): string {
  return `https://github.com/${repo}`;
}

export function releaseUrl(repo: string, tag: string): string {
  return `https://github.com/${repo}/releases/tag/${encodeURIComponent(tag)}`;
}

// ---- releases ----------------------------------------------------------------

/** Releases that fall on one chart row (a day, or a week's Monday). */
export interface ReleaseMark {
  date: string;
  tags: string[];
}

/**
 * Chart marks for releases inside [start, end], grouped by chart row: the
 * day, or the Monday of its week on weekly charts. Oldest first.
 */
export function releaseMarks(
  releases: Release[],
  start: string,
  end: string,
  weekly = false,
): ReleaseMark[] {
  const by = new Map<string, string[]>();
  for (const r of [...releases].sort((a, b) => a.date.localeCompare(b.date))) {
    if (r.date < start || r.date > end) continue;
    const date = weekly ? weekStart(r.date) : r.date;
    by.set(date, [...(by.get(date) ?? []), r.tag]);
  }
  return [...by]
    .map(([date, tags]) => ({ date, tags }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface ReleaseImpact {
  release: ReleaseWithRepo;
  /** Downloads in the `days` days before the release day; null if not all collected. */
  before: number | null;
  /** Downloads from the release day on, for `days` days; null if not complete yet. */
  after: number | null;
  /** after / before - 1, as a fraction; null when either side is unknown or before is 0. */
  change: number | null;
  /** Why `before` / `after` is null. */
  beforeGap: ImpactGap | null;
  afterGap: ImpactGap | null;
}

/** "uncollected": the window starts before every source was collected; "filling": it has not ended. */
export type ImpactGap = 'uncollected' | 'filling';

/**
 * Downloads in the window before each release and the same-length window
 * starting on its day, newest release first. Releases with neither window
 * known are left out. A window that reaches before
 * `fullFrom` (the first day every source was collected) or past
 * `completeThrough` (the last day every source has reported) is unknown,
 * not zero, so a source that started later does not read as growth.
 */
export function releaseImpact(
  releases: ReleaseWithRepo[],
  series: Point[],
  fullFrom: string,
  completeThrough: string,
  days = 14,
  limit = 10,
): ReleaseImpact[] {
  const sum = (from: string, to: string) =>
    series.reduce(
      (n, p) => (p.date >= from && p.date <= to ? n + p.count : n),
      0,
    );
  const gap = (from: string, to: string): ImpactGap | null =>
    !fullFrom || from < fullFrom
      ? 'uncollected'
      : !completeThrough || to > completeThrough
        ? 'filling'
        : null;
  return releases
    .map((release) => {
      const beforeFrom = addDays(release.date, -days);
      const beforeTo = addDays(release.date, -1);
      const afterTo = addDays(release.date, days - 1);
      const beforeGap = gap(beforeFrom, beforeTo);
      const afterGap = gap(release.date, afterTo);
      const before = beforeGap ? null : sum(beforeFrom, beforeTo);
      const after = afterGap ? null : sum(release.date, afterTo);
      const change =
        before !== null && after !== null && before > 0
          ? after / before - 1
          : null;
      return { release, before, after, change, beforeGap, afterGap };
    })
    .filter((i) => i.before !== null || i.after !== null)
    .slice(0, limit);
}

export interface ReleaseWithRepo extends Release {
  repo: string;
}

/** Every release of a product across its repos, newest first. */
export function productReleases(
  product: Pick<Product, 'repos'>,
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

// ---- stars -------------------------------------------------------------------

/** Stars as of `date`: the last point on or before it, 0 before the first. */
export function starsAt(series: StarPoint[], date: string): number {
  let stars = 0;
  for (const p of series) {
    if (p.date > date) break;
    stars = p.stars;
  }
  return stars;
}

/** Stars gained inside [start, end], or null when the repo has no history. */
export function starsGained(
  repo: Repo,
  start: string,
  end: string,
): number | null {
  if (repo.stars_series.length === 0) return null;
  return (
    starsAt(repo.stars_series, end) -
    starsAt(repo.stars_series, addDays(start, -1))
  );
}

/** Daily cumulative stars across repos in [start, end], for charts. */
export function starsPoints(
  repos: Repo[],
  start: string,
  end: string,
): Point[] {
  const out: Point[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    out.push({
      date: d,
      count: repos.reduce((n, r) => n + starsAt(r.stars_series, d), 0),
    });
  }
  return out;
}

/** Days between a repo's last push and `asOf`, or null when unknown. */
export function daysSincePush(repo: Repo, asOf: string): number | null {
  return repo.health?.pushed_at ? diffDays(repo.health.pushed_at, asOf) : null;
}

/** Name of the repo without its owner. */
export function repoName(repo: string): string {
  return repo.split('/')[1] ?? repo;
}

// ---- open work ---------------------------------------------------------------

/** Chart row: date plus the two counts (index signature for TrendChart). */
export type OpenWorkPoint = {
  date: string;
  open_issues: number;
  open_prs: number;
} & Record<string, number | string>;

/** First and last health snapshot dates across repos, or null without any. */
export function healthRange(
  repos: Repo[],
): { start: string; end: string } | null {
  let start = '';
  let end = '';
  for (const r of repos) {
    const first = r.health_series[0];
    const last = r.health_series.at(-1);
    if (first && (!start || first.date < start)) start = first.date;
    if (last && last.date > end) end = last.date;
  }
  return start ? { start, end } : null;
}

/**
 * Open issues and PRs summed across repos per day in [start, end]. Each repo
 * carries its last known snapshot forward, so a day one repo missed does
 * not read as a drop. Days before a repo's first snapshot count it as 0.
 */
export function openWorkSeries(
  repos: Repo[],
  start: string,
  end: string,
): OpenWorkPoint[] {
  const out: OpenWorkPoint[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    let open_issues = 0;
    let open_prs = 0;
    for (const r of repos) {
      let last: HealthPoint | undefined;
      for (const h of r.health_series) {
        if (h.date > d) break;
        last = h;
      }
      open_issues += last?.open_issues ?? 0;
      open_prs += last?.open_prs ?? 0;
    }
    out.push({ date: d, open_issues, open_prs });
  }
  return out;
}

/** A repo's open issues per snapshot inside [start, end], for a sparkline. */
export function openIssuesPoints(
  repo: Repo,
  start: string,
  end: string,
): Point[] {
  return repo.health_series
    .filter((h) => h.date >= start && h.date <= end && h.open_issues !== null)
    .map((h) => ({ date: h.date, count: h.open_issues ?? 0 }));
}
