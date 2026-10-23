import { nic, operatorRepo } from '@/test/fixtures';
import { healthRange, openIssuesPoints, openWorkSeries } from './repos';

describe('open work', () => {
  it('sums snapshots across repos, carrying each repo forward', () => {
    const repos = [operatorRepo, nic.repos[0]];
    expect(healthRange(repos)).toEqual({
      start: '2026-10-01',
      end: '2026-10-10',
    });
    const series = openWorkSeries(repos, '2026-09-30', '2026-10-02');
    expect(series).toEqual([
      { date: '2026-09-30', open_issues: 0, open_prs: 0 },
      { date: '2026-10-01', open_issues: 10, open_prs: 3 },
      { date: '2026-10-02', open_issues: 10, open_prs: 3 },
    ]);
    expect(openIssuesPoints(operatorRepo, '2026-10-01', '2026-10-10')).toEqual([
      { date: '2026-10-01', count: 10 },
      { date: '2026-10-10', count: 12 },
    ]);
  });
});
