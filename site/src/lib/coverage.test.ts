import { coverageLines, partialNote } from './coverage';
import type { Coverage } from './summary';

const cov: Coverage = {
  starts: [{ date: '2026-10-11', keys: ['conda', 'github_releases'] }],
  partialFrom: '2026-10-24',
  lagging: ['quay', 'pypi'],
  keys: ['quay', 'pypi', 'conda', 'github_releases'],
};

describe('coverage captions', () => {
  it('says "Data starts" when every series starts at once', () => {
    const all: Coverage<string> = {
      starts: [{ date: 'd', keys: ['a', 'b'] }],
      partialFrom: null,
      lagging: [],
      keys: ['a', 'b'],
    };
    expect(coverageLines(all, (k) => k.toUpperCase())).toEqual([
      { date: 'd', label: 'Data starts' },
    ]);
  });

  it('labels start lines and the incomplete tail', () => {
    expect(coverageLines(cov)).toEqual([
      { date: '2026-10-11', label: 'conda-forge and GitHub Releases start' },
    ]);
    expect(partialNote(cov, false)).toBe(
      'Quay and PyPI have not reported this day yet, so it reads low.',
    );
    expect(partialNote({ ...cov, lagging: [] }, true)).toBe(
      'This week is not over yet.',
    );
  });
});
