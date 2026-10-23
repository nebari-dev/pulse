import { chatPack, nic, operator, toIndex, toRepos } from '@/test/fixtures';
import { movers, recentReleases, wentQuiet } from './changes';

const ALL = { kind: 'all', type: 'all', source: 'all' } as const;

describe('movers', () => {
  it('ranks by swing, drops tiny volumes and uncovered periods', () => {
    // operator: 2026-10-01..10 ramps 10→100; last 7 days (Oct 4–10) = 490,
    // previous 7 days only partly covered (series starts Oct 1) → no delta.
    const index = toIndex([operator, nic, chatPack]);
    const { up, down } = movers(index.products, ALL, '2026-10-10');
    expect(up).toEqual([]);
    expect(down).toEqual([]);
  });

  it('reports a product whose week doubled', () => {
    const index = toIndex([operator]);
    // Shift "as of" so both weeks fall inside the series: Oct 1–7 vs Oct 8–10
    // is not a full week either, so compare day-level by hand: use a custom
    // product with 14 days of data.
    const p = {
      ...index.products[0],
      groups: [
        {
          source: 'quay' as const,
          kind: 'image' as const,
          artifacts: 1,
          since: '2026-09-27',
          series: Array.from({ length: 14 }, (_, i) => ({
            date: `2026-${i < 4 ? '09' : '10'}-${String(i < 4 ? 27 + i : i - 3).padStart(2, '0')}`,
            count: i < 7 ? 10 : 20,
          })),
        },
      ],
    };
    const { up } = movers([p], ALL, '2026-10-10');
    expect(up).toHaveLength(1);
    expect(up[0].comparison).toEqual({ current: 140, previous: 70, delta: 1 });
  });
});

describe('recentReleases and wentQuiet', () => {
  it("finds this week's releases and repos that just crossed 90 days", () => {
    const repos = toRepos([operator, nic], '2026-10-11');
    const releases = recentReleases(repos, 'all');
    // v1.2.0 (Oct 8) is inside the week; the Oct 1 prerelease is not.
    expect(releases.map((r) => r.tag)).toEqual(['v1.2.0']);
    expect(releases[0].product.id).toBe('nebari-operator');

    // Pushed Oct 9 → 2 days: not quiet.
    expect(wentQuiet(repos, 'all')).toEqual([]);
    const stale = {
      ...repos,
      products: repos.products.map((p) => ({
        ...p,
        repos: p.repos.map((r) =>
          r.health
            ? { ...r, health: { ...r.health, pushed_at: '2026-07-10' } }
            : r,
        ),
      })),
    };
    const quiet = wentQuiet(stale, 'all');
    expect(quiet).toHaveLength(1);
    expect(quiet[0].daysSincePush).toBe(93);
  });
});
