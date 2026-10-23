import {
  type Artifact,
  addDays,
  bucketWeekly,
  chartRows,
  compare,
  compareArtifacts,
  fillDaily,
  headlineArtifacts,
  platformOf,
  sumSeries,
  weekStart,
  windowFor,
} from './summary';

describe('dates', () => {
  it('adds days across month boundaries in UTC', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('finds the Monday of a week', () => {
    expect(weekStart('2026-10-23')).toBe('2026-10-19'); // Friday
    expect(weekStart('2026-10-19')).toBe('2026-10-19'); // Monday
    expect(weekStart('2026-10-25')).toBe('2026-10-19'); // Sunday
  });

  it('windows end at the as-of date', () => {
    expect(windowFor('30d', '2026-10-22', '2026-01-01')).toEqual({
      start: '2026-09-23',
      end: '2026-10-22',
      days: 30,
    });
    expect(windowFor('all', '2026-10-22', '2026-07-23').start).toBe(
      '2026-07-23',
    );
  });
});

describe('series', () => {
  const a = [
    { date: '2026-10-20', count: 1 },
    { date: '2026-10-22', count: 2 },
  ];
  const b = [{ date: '2026-10-22', count: 5 }];

  it('sums by date and sorts', () => {
    expect(sumSeries([b, a])).toEqual([
      { date: '2026-10-20', count: 1 },
      { date: '2026-10-22', count: 7 },
    ]);
  });

  it('zero-fills gaps', () => {
    expect(
      fillDaily(a, '2026-10-20', '2026-10-22').map((p) => p.count),
    ).toEqual([1, 0, 2]);
  });

  it('buckets by ISO week', () => {
    expect(
      bucketWeekly([
        { date: '2026-10-18', count: 1 }, // Sunday, week of 10-12
        { date: '2026-10-19', count: 2 }, // Monday, week of 10-19
        { date: '2026-10-23', count: 3 },
      ]),
    ).toEqual([
      { date: '2026-10-12', count: 1 },
      { date: '2026-10-19', count: 5 },
    ]);
  });

  it('compares against the previous period', () => {
    const s = [
      { date: '2026-10-19', count: 10 },
      { date: '2026-10-20', count: 10 },
      { date: '2026-10-21', count: 15 },
      { date: '2026-10-22', count: 15 },
    ];
    expect(compare(s, '2026-10-21', '2026-10-22')).toEqual({
      current: 30,
      previous: 20,
      delta: 0.5,
    });
    expect(compare(s, '2026-10-19', '2026-10-20').delta).toBeNull();
  });

  it('withholds the delta when the previous period predates collection', () => {
    const s = [
      { date: '2026-10-21', count: 15 },
      { date: '2026-10-22', count: 15 },
    ];
    expect(
      compare(s, '2026-10-21', '2026-10-22', '2026-10-20').delta,
    ).toBeNull();
    expect(
      compare(s, '2026-10-21', '2026-10-22', '2026-10-19').delta,
    ).toBeNull(); // previous = 0
  });

  it('builds chart rows with every key present', () => {
    const rows = chartRows({ x: a, y: b }, '2026-10-21', '2026-10-22', false);
    expect(rows).toEqual([
      { date: '2026-10-21', x: 0, y: 0 },
      { date: '2026-10-22', x: 2, y: 5 },
    ]);
  });
});

it('compares only artifacts that existed in the previous period', () => {
  const old = {
    source: 'pypi' as const,
    kind: 'package' as const,
    ref: 'x',
    totals: { '7d': 0, '30d': 0, '90d': 0, all: 0 },
    latest_cumulative: null,
    latest_items: null,
    series: [
      { date: '2026-10-19', count: 10 },
      { date: '2026-10-20', count: 10 },
      { date: '2026-10-21', count: 11 },
      { date: '2026-10-22', count: 11 },
    ],
  };
  const young = {
    ...old,
    source: 'quay' as const,
    kind: 'image' as const,
    series: [{ date: '2026-10-22', count: 2 }],
  };
  const c = compareArtifacts([old, young], '2026-10-21', '2026-10-22');
  expect(c.current).toBe(24); // everything counts now
  expect(c.previous).toBe(20); // only `old` existed before
  expect(c.delta).toBeCloseTo(0.1); // 22 vs 20, `young` excluded
  expect(
    compareArtifacts([young], '2026-10-21', '2026-10-22').delta,
  ).toBeNull();

  // When the covered artifacts are a sliver of the total, no delta.
  const big = { ...young, series: [{ date: '2026-10-22', count: 500 }] };
  expect(
    compareArtifacts([old, big], '2026-10-21', '2026-10-22').delta,
  ).toBeNull();
});

it('extracts a platform from release asset names', () => {
  expect(platformOf('nic_0.16.0_darwin_arm64.tar.gz')).toBe('darwin/arm64');
  expect(platformOf('nic_0.16.0_windows_x86_64.zip')).toBe('windows/x86_64');
  expect(platformOf('checksums.txt')).toBeNull();
});

describe('headlineArtifacts', () => {
  const image = { kind: 'image' } as Artifact;
  const chart = { kind: 'chart' } as Artifact;
  it('drops chart pulls unless charts are selected', () => {
    expect(
      headlineArtifacts([image, chart], { source: 'all', type: 'all' }),
    ).toEqual([image]);
    expect(
      headlineArtifacts([image, chart], { source: 'all', type: 'chart' }),
    ).toEqual([image, chart]);
  });
});
