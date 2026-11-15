import { nic, operatorRepo } from '@/test/fixtures';
import {
  healthRange,
  openIssuesPoints,
  openWorkSeries,
  releaseImpact,
  releaseMarks,
} from './repos';

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

describe('releaseMarks', () => {
  const releases = [
    { tag: 'v2', date: '2026-10-08', prerelease: false },
    { tag: 'v1.1', date: '2026-10-06', prerelease: false },
    { tag: 'v1', date: '2026-09-01', prerelease: false },
  ];

  it('keeps releases in the window, one mark per day', () => {
    expect(releaseMarks(releases, '2026-10-01', '2026-10-31')).toEqual([
      { date: '2026-10-06', tags: ['v1.1'] },
      { date: '2026-10-08', tags: ['v2'] },
    ]);
  });

  it('groups by Monday on weekly charts', () => {
    // Oct 6 and Oct 8, 2026 are in the week of Monday, Oct 5.
    expect(releaseMarks(releases, '2026-08-01', '2026-10-31', true)).toEqual([
      { date: '2026-08-31', tags: ['v1'] },
      { date: '2026-10-05', tags: ['v1.1', 'v2'] },
    ]);
  });
});

describe('releaseImpact', () => {
  // 10 a day through Oct 10, 20 a day from Oct 11.
  const series = Array.from({ length: 40 }, (_, i) => {
    const date = new Date(Date.UTC(2026, 8, 20 + i)).toISOString().slice(0, 10);
    return { date, count: date >= '2026-10-11' ? 20 : 10 };
  });
  const rel = (tag: string, date: string) => ({
    tag,
    date,
    prerelease: false,
    repo: 'nebari-dev/x',
  });

  it('compares the 14 days before a release with the 14 from its day', () => {
    const [impact] = releaseImpact(
      [rel('v2', '2026-10-11')],
      series,
      '2026-09-20',
      '2026-10-29',
    );
    expect(impact.before).toBe(140);
    expect(impact.after).toBe(280);
    expect(impact.change).toBeCloseTo(1);
  });

  it('leaves a window unknown before collection began or while filling', () => {
    const [early, late] = releaseImpact(
      [rel('v3', '2026-10-25'), rel('v1', '2026-09-25')],
      series,
      '2026-09-20',
      '2026-10-29',
    );
    // v3's after-window runs to Nov 7, past the last complete day.
    expect(early.after).toBeNull();
    expect(early.before).toBe(280);
    expect(early.change).toBeNull();
    expect(early.afterGap).toBe('filling');
    // v1's before-window starts Sep 11, before Sep 20.
    expect(late.before).toBeNull();
    expect(late.beforeGap).toBe('uncollected');
    expect(late.after).toBe(140);
  });

  it('leaves out releases with neither window known', () => {
    expect(
      releaseImpact(
        [rel('v0', '2026-08-01')],
        series,
        '2026-09-20',
        '2026-10-29',
      ),
    ).toEqual([]);
  });
});
