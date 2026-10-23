import { anomalies, anomalyNote, markersFor } from './anomalies';

function flat(days: number, count: number, from = 1) {
  return Array.from({ length: days }, (_, i) => ({
    date: `2026-09-${String(from + i).padStart(2, '0')}`,
    count,
  }));
}

describe('anomalies', () => {
  it('flags a day far above the trailing mean', () => {
    const series = [
      ...flat(14, 20),
      { date: '2026-09-15', count: 400 },
      ...flat(3, 20, 16),
    ];
    const found = anomalies(series);
    expect(found).toHaveLength(1);
    expect(found[0]).toEqual({
      date: '2026-09-15',
      count: 400,
      mean: 20,
      factor: 20,
    });
    expect(anomalyNote(found[0], 'pulls')).toMatch(
      /^20× the trailing average \(400 vs\. 20 pulls a day\)/,
    );
  });

  it('needs history, a minimum count, and a real multiple', () => {
    // Too little history before the spike.
    expect(
      anomalies([...flat(3, 20), { date: '2026-09-04', count: 400 }]),
    ).toEqual([]);
    // Big relative jump but tiny absolute numbers.
    expect(
      anomalies([...flat(14, 1), { date: '2026-09-15', count: 10 }]),
    ).toEqual([]);
    // Noisy series: a day inside the normal spread is not flagged.
    const noisy = flat(14, 100).map((p, i) => ({
      ...p,
      count: i % 2 ? 50 : 150,
    }));
    expect(anomalies([...noisy, { date: '2026-09-15', count: 160 }])).toEqual(
      [],
    );
  });

  it('turns anomalies into chart markers', () => {
    const series = [...flat(14, 20), { date: '2026-09-15', count: 400 }];
    expect(markersFor(series).map((m) => m.date)).toEqual(['2026-09-15']);
  });
});
