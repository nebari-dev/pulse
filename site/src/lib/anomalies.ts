/**
 * Single-day spikes that read as adoption but are more likely CI loops or
 * mirrors. A day is anomalous when it sits more than `sigma` standard
 * deviations above the trailing `window`-day mean, is at least `minFactor`
 * times that mean, and has at least `minCount` downloads. The marker
 * explains the day; nothing is changed in the plotted data.
 */
import type { Point } from '@/lib/summary';

export interface Anomaly {
  date: string;
  count: number;
  /** Trailing mean of the days before it. */
  mean: number;
  /** count / mean, rounded to one decimal. */
  factor: number;
}

export interface AnomalyOptions {
  window?: number;
  sigma?: number;
  minFactor?: number;
  minCount?: number;
}

export function anomalies(
  series: Point[],
  { window = 28, sigma = 3, minFactor = 3, minCount = 50 }: AnomalyOptions = {},
): Anomaly[] {
  const out: Anomaly[] = [];
  for (let i = 0; i < series.length; i++) {
    const prior = series.slice(Math.max(0, i - window), i);
    if (prior.length < 7) continue; // not enough history to call anything odd
    const mean = prior.reduce((n, p) => n + p.count, 0) / prior.length;
    const variance =
      prior.reduce((n, p) => n + (p.count - mean) ** 2, 0) / prior.length;
    const stdev = Math.sqrt(variance);
    const { date, count } = series[i];
    if (
      count >= minCount &&
      count > mean + sigma * stdev &&
      count >= minFactor * Math.max(mean, 1)
    ) {
      out.push({
        date,
        count,
        mean: Math.round(mean),
        factor: Math.round((count / Math.max(mean, 1)) * 10) / 10,
      });
    }
  }
  return out;
}

/** The note shown when hovering a marked day. */
export function anomalyNote(a: Anomaly, what = 'downloads'): string {
  return `${a.factor}× the trailing average (${a.count.toLocaleString('en')} vs. ${a.mean.toLocaleString('en')} ${what} a day). Likely CI or a mirror, not adoption.`;
}

export interface ChartMarker {
  date: string;
  note: string;
}

export function markersFor(
  series: Point[],
  what?: string,
  options?: AnomalyOptions,
): ChartMarker[] {
  return anomalies(series, options).map((a) => ({
    date: a.date,
    note: anomalyNote(a, what),
  }));
}
