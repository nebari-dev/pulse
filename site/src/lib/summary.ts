/**
 * Types and pure helpers for the collector's files (its contract, mirrored
 * from nebari_pulse/summary.py):
 *
 *   /data/summary.json        Summary: products with series grouped by
 *                             (source, artifact kind). Enough for the
 *                             Downloads page and its filters.
 *   /data/repos.json          ReposFile: every product's GitHub repos.
 *   /data/products/<id>.json  ProductDetail: one product with every
 *                             artifact's own series and latest items.
 *
 * Everything on screen is derived from series at the finest level the
 * page has (groups on the index, artifacts on a product), so a source or
 * type filter recomputes totals instead of trusting a pre-aggregated one.
 */

export const SOURCES = ['quay', 'pypi', 'conda', 'github_releases'] as const;
export type Source = (typeof SOURCES)[number];

export const SOURCE_LABEL: Record<Source, string> = {
  quay: 'Quay',
  pypi: 'PyPI',
  conda: 'conda-forge',
  github_releases: 'GitHub Releases',
};

/**
 * Fixed hue per source (color follows the entity, never its rank). Order
 * magenta / yellow / blue / green was validated for CVD separation against
 * the Nebari chart tokens.
 */
export const SOURCE_COLOR: Record<Source, string> = {
  quay: 'var(--chart-1)',
  pypi: 'var(--chart-3)',
  conda: 'var(--chart-4)',
  github_releases: 'var(--chart-5)',
};

/** What one download is. Charts are kept apart because GitOps controllers
 * poll them continuously, which says nothing about adoption. */
export const ARTIFACT_KINDS = ['image', 'chart', 'package', 'binary'] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];
export const ARTIFACT_KIND_LABEL: Record<ArtifactKind, string> = {
  image: 'Images',
  chart: 'Helm charts',
  package: 'Packages',
  binary: 'Binaries',
};
/** Same validated hue order as SOURCE_COLOR. */
export const ARTIFACT_KIND_COLOR: Record<ArtifactKind, string> = {
  image: 'var(--chart-1)',
  chart: 'var(--chart-3)',
  package: 'var(--chart-4)',
  binary: 'var(--chart-5)',
};
export type ArtifactKindFilter = ArtifactKind | 'all';

export type Kind = 'product' | 'pack';
export const KIND_LABEL: Record<Kind, string> = {
  product: 'Product',
  pack: 'Pack',
};

export interface Point {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface Totals {
  '7d': number;
  '30d': number;
  '90d': number;
  all: number;
}

export interface LatestItem {
  cumulative: number;
  /** Snapshot deltas for this one version/tag; `all` is since collection began. */
  totals?: Totals;
  [column: string]: string | number | Totals | undefined;
}

/** The least a series needs to be filtered and summed: where it comes from
 * and what one count is. Artifacts and index groups both satisfy it. */
export interface Countable {
  source: Source;
  kind: ArtifactKind;
  series: Point[];
}

export interface Artifact extends Countable {
  ref: string;
  totals: Totals;
  latest_cumulative: number | null;
  latest_items: LatestItem[] | null;
}

/** Artifacts of one product summed per (source, kind), as in the index. */
export interface ArtifactGroup extends Countable {
  /** How many artifacts the group sums. */
  artifacts: number;
  /** Earliest date any artifact in the group has data for, or null. */
  since: string | null;
}

/** Latest daily snapshot of a GitHub repo. Blank upstream answers are null. */
export interface RepoHealth {
  date: string;
  pushed_at: string | null;
  stars: number | null;
  forks: number | null;
  subscribers: number | null;
  open_issues: number | null;
  open_prs: number | null;
  merged_prs_30d: number | null;
  issues_opened_30d: number | null;
  issues_closed_30d: number | null;
}

export interface HealthPoint {
  date: string;
  stars: number | null;
  open_issues: number | null;
  open_prs: number | null;
}

export interface TrafficPoint {
  date: string;
  views: number;
  unique_views: number;
  clones: number;
  unique_clones: number;
}

export interface Release {
  tag: string;
  date: string; // YYYY-MM-DD
  prerelease: boolean;
}

export interface Repo {
  repo: string; // owner/name
  health: RepoHealth | null;
  health_series: HealthPoint[];
  traffic: TrafficPoint[];
  /** Newest first. */
  releases: Release[];
}

export interface ProductBase {
  id: string;
  name: string;
  kind: Kind;
}

/** One product in full (products/<id>.json). */
export interface Product extends ProductBase {
  totals: Totals;
  series: Point[];
  artifacts: Artifact[];
  repos: Repo[];
}
export interface ProductDetail extends Product {
  generated_at: string;
}

/** A product as the index lists it (summary.json). */
export interface ProductIndex extends ProductBase {
  totals: Totals;
  groups: ArtifactGroup[];
}

export interface Summary {
  generated_at: string;
  sources: Record<string, { kind: 'daily' | 'cumulative'; artifacts: number }>;
  products: ProductIndex[];
  /** Repos tracked, and how many of them have traffic data. */
  repos: { count: number; traffic: number };
}

/** A product with only its repos (repos.json). */
export interface ProductRepos extends ProductBase {
  repos: Repo[];
}
export interface ReposFile {
  generated_at: string;
  products: ProductRepos[];
}

export const RANGES = ['30d', '90d', '1y', 'all'] as const;
export type Range = (typeof RANGES)[number];
export const RANGE_DAYS: Record<Range, number | null> = {
  '30d': 30,
  '90d': 90,
  '1y': 365,
  all: null,
};
export const RANGE_LABEL: Record<Range, string> = {
  '30d': '30 days',
  '90d': '90 days',
  '1y': '1 year',
  all: 'All time',
};

export type SourceFilter = Source | 'all';
export type KindFilter = Kind | 'all';

// ---- dates -----------------------------------------------------------------

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function diffDays(from: string, to: string): number {
  const toUtc = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

/** Monday of the ISO week containing the date. */
export function weekStart(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(iso, dow === 0 ? -6 : 1 - dow);
}

// ---- series ----------------------------------------------------------------

export function sumSeries(lists: Point[][]): Point[] {
  const byDate = new Map<string, number>();
  for (const list of lists) {
    for (const p of list)
      byDate.set(p.date, (byDate.get(p.date) ?? 0) + p.count);
  }
  return [...byDate]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, count]) => ({ date, count }));
}

export function total(series: Point[]): number {
  return series.reduce((acc, p) => acc + p.count, 0);
}

/** Points with start <= date <= end. */
export function between(series: Point[], start: string, end: string): Point[] {
  return series.filter((p) => p.date >= start && p.date <= end);
}

/** Zero-fill so every day from start to end has a point. */
export function fillDaily(
  series: Point[],
  start: string,
  end: string,
): Point[] {
  const have = new Map(series.map((p) => [p.date, p.count]));
  const out: Point[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    out.push({ date: d, count: have.get(d) ?? 0 });
  }
  return out;
}

export function bucketWeekly(series: Point[]): Point[] {
  return sumSeries([
    series.map((p) => ({ date: weekStart(p.date), count: p.count })),
  ]);
}

/** Latest date that has data anywhere; the dashboard's "as of". */
export function latestDate(summary: Summary): string {
  let max = '';
  for (const p of summary.products) {
    for (const g of p.groups) {
      const last = g.series.at(-1);
      if (last && last.date > max) max = last.date;
    }
  }
  return max || summary.generated_at;
}

export function earliestDate(summary: Summary): string {
  let min = '';
  for (const p of summary.products) {
    for (const g of p.groups) {
      if (g.since && (!min || g.since < min)) min = g.since;
    }
  }
  return min || summary.generated_at;
}

/** Inclusive window [start, end] for a range ending at `end`. */
export function windowFor(
  range: Range,
  end: string,
  earliest: string,
): { start: string; end: string; days: number } {
  const days = RANGE_DAYS[range];
  const start = days === null ? earliest : addDays(end, -(days - 1));
  return { start, end, days: diffDays(start, end) + 1 };
}

// ---- products --------------------------------------------------------------

export function matchesKind(product: ProductBase, kind: KindFilter): boolean {
  return kind === 'all' || product.kind === kind;
}

export interface ArtifactFilter {
  source: SourceFilter;
  type: ArtifactKindFilter;
}

/** The artifacts (or index groups) a source/type filter keeps. */
export function artifactsOf<T extends Countable>(
  items: T[],
  { source, type }: ArtifactFilter,
): T[] {
  return items.filter(
    (a) =>
      (source === 'all' || a.source === source) &&
      (type === 'all' || a.kind === type),
  );
}

export function productSeries(
  items: Countable[],
  filter: ArtifactFilter,
): Point[] {
  return sumSeries(artifactsOf(items, filter).map((a) => a.series));
}

/**
 * Artifacts that count towards a headline number. With no type selected,
 * Helm chart pulls are left out: GitOps controllers poll charts
 * continuously, so they dominate totals while saying nothing about
 * adoption. Selecting the chart type explicitly still shows them.
 */
export function headlineArtifacts<T extends Countable>(
  artifacts: T[],
  filter: ArtifactFilter,
): T[] {
  return filter.type === 'all'
    ? artifacts.filter((a) => a.kind !== 'chart')
    : artifacts;
}

/** True when the filter leaves chart pulls out of headline numbers. */
export function excludesCharts(filter: ArtifactFilter): boolean {
  return filter.type === 'all';
}

export interface Comparison {
  current: number;
  previous: number;
  /** Fractional change, null when the previous period had nothing. */
  delta: number | null;
}

/**
 * Total in [start, end] vs the same-length period immediately before it.
 * The delta is null when the previous period is not fully covered by
 * collected data (`earliest`), since comparing against a partial window
 * would read as a huge spurious increase.
 */
export function compare(
  series: Point[],
  start: string,
  end: string,
  earliest = '',
): Comparison {
  const days = diffDays(start, end) + 1;
  const prevStart = addDays(start, -days);
  const current = total(between(series, start, end));
  const previous = total(between(series, prevStart, addDays(start, -1)));
  const covered = prevStart >= earliest;
  return {
    current,
    previous,
    delta: covered && previous > 0 ? (current - previous) / previous : null,
  };
}

/**
 * Like `compare`, but the previous period is measured only on artifacts that
 * already had data then, so a source that started collecting mid-way (Quay
 * keeps ~90 days; cumulative sources begin at their first snapshot) cannot
 * show up as a spurious jump. `current` still counts every artifact.
 */
export function compareArtifacts(
  artifacts: Countable[],
  start: string,
  end: string,
): Comparison {
  const days = diffDays(start, end) + 1;
  const prevStart = addDays(start, -days);
  const prevEnd = addDays(start, -1);
  const sum = (list: Countable[], from: string, to: string) =>
    list.reduce((acc, a) => acc + total(between(a.series, from, to)), 0);
  const covered = artifacts.filter(
    (a) => a.series.length > 0 && a.series[0].date <= prevStart,
  );
  const previous = sum(covered, prevStart, prevEnd);
  const current = sum(artifacts, start, end);
  const currentCovered = sum(covered, start, end);
  // A delta over a sliver of the total (e.g. PyPI only, while Quay has no
  // prior window yet) would misdescribe the headline number; withhold it.
  const representative = current === 0 || currentCovered / current >= 0.9;
  return {
    current,
    previous,
    delta:
      representative && previous > 0
        ? (currentCovered - previous) / previous
        : null,
  };
}

/** True when the series has any downloads inside [start, end]. */
export function hasDataIn(
  series: Point[],
  start: string,
  end: string,
): boolean {
  return series.some((p) => p.date >= start && p.date <= end && p.count > 0);
}

/** Rows for a multi-series chart: one row per bucket with a key per series. */
export function chartRows(
  seriesByKey: Record<string, Point[]>,
  start: string,
  end: string,
  weekly: boolean,
): Array<Record<string, number | string>> {
  const rows = new Map<string, Record<string, number | string>>();
  for (const [key, series] of Object.entries(seriesByKey)) {
    let points = fillDaily(between(series, start, end), start, end);
    if (weekly) points = bucketWeekly(points);
    for (const p of points) {
      const row = rows.get(p.date) ?? { date: p.date };
      row[key] = p.count;
      rows.set(p.date, row);
    }
  }
  return [...rows.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function artifactUrl(a: Artifact): string {
  switch (a.source) {
    case 'quay':
      return `https://quay.io/repository/${a.ref}`;
    case 'pypi':
      return `https://pypi.org/project/${a.ref}/`;
    case 'conda':
      return `https://anaconda.org/${a.ref}`;
    case 'github_releases':
      return `https://github.com/${a.ref}/releases`;
  }
}

/** darwin_arm64 etc. from a release asset filename, or null. */
export function platformOf(asset: string): string | null {
  const m = asset.match(
    /(darwin|linux|windows)[_-](arm64|x86_64|amd64|aarch64)/i,
  );
  return m ? `${m[1].toLowerCase()}/${m[2].toLowerCase()}` : null;
}

/** Case-insensitive substring match on any of the given fields. */
export function matchesQuery(query: string, ...fields: string[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => f.toLowerCase().includes(q));
}
