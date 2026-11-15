import { countryName } from './format';

describe('countryName', () => {
  it('names ISO codes and handles Cloudflare specials', () => {
    expect(countryName('US')).toBe('United States');
    expect(countryName('XX')).toBe('Unknown');
    expect(countryName('T1')).toBe('Tor network');
    expect(countryName('not a code')).toBe('not a code');
  });
});
