import { seedDarkDefault } from './theme';

describe('seedDarkDefault', () => {
  beforeEach(() => localStorage.clear());

  it('stores dark on a first visit', () => {
    seedDarkDefault();
    expect(localStorage.getItem('nebari:themeMode')).toBe('dark');
  });

  it('keeps an existing preference', () => {
    localStorage.setItem('nebari:themeMode', 'light');
    seedDarkDefault();
    expect(localStorage.getItem('nebari:themeMode')).toBe('light');
  });

  it('tolerates unavailable storage', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    expect(() => seedDarkDefault(broken)).not.toThrow();
  });
});
