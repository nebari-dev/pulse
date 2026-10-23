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
