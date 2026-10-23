const compact = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const full = new Intl.NumberFormat('en');
const percent = new Intl.NumberFormat('en', {
  style: 'percent',
  maximumFractionDigits: 0,
  signDisplay: 'exceptZero',
});

export function formatCompact(n: number): string {
  return compact.format(n);
}

export function formatNumber(n: number): string {
  return full.format(n);
}

export function formatDelta(delta: number | null): string {
  return delta === null ? '—' : percent.format(delta);
}

export function formatDate(iso: string, withYear = false): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    year: withYear ? 'numeric' : undefined,
    timeZone: 'UTC',
  });
}

/** "today", "yesterday", "12 days ago", "3 months ago", "2 years ago". */
export function formatAgo(days: number | null): string {
  if (days === null) return '—';
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 60) return `${days} days ago`;
  if (days < 365 * 1.5) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
}
