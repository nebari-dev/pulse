import type {
  Artifact,
  ArtifactKind,
  Product,
  Repo,
  Source,
  Summary,
} from '@/lib/summary';

function days(start: string, counts: number[]) {
  const [y, m, d] = start.split('-').map(Number);
  return counts.map((count, i) => ({
    date: new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10),
    count,
  }));
}

function kindOf(source: Source, ref: string): ArtifactKind {
  if (source === 'quay') return ref.includes('/charts/') ? 'chart' : 'image';
  if (source === 'github_releases') return 'binary';
  return 'package';
}

function artifact(
  partial: Partial<Artifact> & Pick<Artifact, 'source' | 'ref'>,
): Artifact {
  return {
    kind: kindOf(partial.source, partial.ref),
    totals: { '7d': 0, '30d': 0, '90d': 0, all: 0 },
    latest_cumulative: null,
    latest_items: null,
    series: [],
    ...partial,
  };
}

export const operatorRepo: Repo = {
  repo: 'nebari-dev/nebari-operator',
  health: {
    date: '2026-10-10',
    pushed_at: '2026-10-09',
    stars: 42,
    forks: 7,
    subscribers: 3,
    open_issues: 12,
    open_prs: 4,
    merged_prs_30d: 9,
    issues_opened_30d: 5,
    issues_closed_30d: 6,
  },
  health_series: [
    { date: '2026-10-01', stars: 40, open_issues: 10, open_prs: 3 },
    { date: '2026-10-10', stars: 42, open_issues: 12, open_prs: 4 },
  ],
  traffic: days('2026-10-01', [10, 20, 30]).map((p) => ({
    date: p.date,
    views: p.count,
    unique_views: Math.ceil(p.count / 2),
    clones: 2,
    unique_clones: 1,
  })),
  releases: [
    { tag: 'v1.2.0', date: '2026-10-08', prerelease: false },
    { tag: 'v1.2.0-rc1', date: '2026-10-01', prerelease: true },
    { tag: 'v1.1.0', date: '2026-09-10', prerelease: false },
    { tag: 'v1.0.0', date: '2026-08-10', prerelease: false },
  ],
};

export const operator: Product = {
  id: 'nebari-operator',
  name: 'Nebari Operator',
  kind: 'product',
  totals: { '7d': 0, '30d': 0, '90d': 0, all: 0 },
  series: [],
  repos: [operatorRepo],
  artifacts: [
    artifact({
      source: 'quay',
      ref: 'nebari/nebari-operator',
      series: days('2026-10-01', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]),
    }),
  ],
};

export const nic: Product = {
  id: 'nic',
  name: 'Nebari Infrastructure Core',
  kind: 'product',
  totals: { '7d': 0, '30d': 0, '90d': 0, all: 0 },
  series: [],
  repos: [
    {
      repo: 'nebari-dev/nebari-infrastructure-core',
      health: null,
      health_series: [],
      traffic: [],
      releases: [],
    },
  ],
  artifacts: [
    artifact({
      source: 'github_releases',
      ref: 'nebari-dev/nebari-infrastructure-core',
      latest_cumulative: 12,
      latest_items: [
        {
          tag: 'v0.16.0',
          asset: 'nic_0.16.0_linux_x86_64.tar.gz',
          cumulative: 8,
          totals: { '7d': 3, '30d': 6, '90d': 6, all: 6 },
        },
        {
          tag: 'v0.15.0',
          asset: 'nic_0.15.0_darwin_arm64.tar.gz',
          cumulative: 4,
          totals: { '7d': 0, '30d': 0, '90d': 0, all: 0 },
        },
      ],
      series: days('2026-10-05', [1, 2, 3]),
    }),
    artifact({
      source: 'pypi',
      ref: 'nic',
      series: days('2026-10-08', [5, 5, 5]),
    }),
  ],
};

export const chatPack: Product = {
  id: 'chat-pack',
  name: 'Chat Pack',
  kind: 'pack',
  totals: { '7d': 0, '30d': 0, '90d': 0, all: 0 },
  series: [],
  repos: [],
  artifacts: [
    artifact({
      source: 'quay',
      ref: 'nebari/charts/nebari-chat',
      series: days('2026-10-01', [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    }),
  ],
};

export const summary: Summary = {
  generated_at: '2026-10-11',
  sources: {
    quay: { kind: 'daily', artifacts: 2 },
    pypi: { kind: 'daily', artifacts: 1 },
    github_releases: { kind: 'cumulative', artifacts: 1 },
  },
  products: [operator, nic, chatPack],
  repos: { count: 2, traffic: 1 },
};

/** Stub `fetch` so useSummary resolves with the fixture. */
export function stubSummaryFetch(data: Summary = summary) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => data })),
  );
}
