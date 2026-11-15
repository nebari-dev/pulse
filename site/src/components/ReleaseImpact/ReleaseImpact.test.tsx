import { render, screen, within } from '@testing-library/react';
import ReleaseImpact from './ReleaseImpact';

const release = (tag: string, date: string) => ({
  tag,
  date,
  prerelease: false,
  repo: 'nebari-dev/nebari-operator',
});

describe('ReleaseImpact', () => {
  it('shows before, after and change, with dashes for unknown windows', () => {
    render(
      <ReleaseImpact
        days={14}
        impacts={[
          {
            release: release('v1.3.0', '2026-10-30'),
            before: 200,
            after: null,
            change: null,
            beforeGap: null,
            afterGap: 'filling',
          },
          {
            release: release('v1.2.0', '2026-10-01'),
            before: 100,
            after: 150,
            change: 0.5,
            beforeGap: null,
            afterGap: null,
          },
        ]}
      />,
    );
    const table = screen.getByRole('table', {
      name: /14 days before and after/,
    });
    const [filling, done] = within(table).getAllByRole('row').slice(1);
    expect(within(done).getByText('+50%')).toBeInTheDocument();
    expect(within(done).getByText('150')).toBeInTheDocument();
    expect(within(filling).getByText('(still filling)')).toBeInTheDocument();
    expect(
      within(filling).getByRole('link', { name: /v1.3.0/ }),
    ).toHaveAttribute(
      'href',
      'https://github.com/nebari-dev/nebari-operator/releases/tag/v1.3.0',
    );
  });
});
