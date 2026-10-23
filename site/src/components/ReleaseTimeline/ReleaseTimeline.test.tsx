import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { nic, operator } from '@/test/fixtures';
import ReleaseTimeline from './ReleaseTimeline';

describe('ReleaseTimeline', () => {
  it('draws a row per product with a link per release, hollow for prereleases', () => {
    render(
      <MemoryRouter>
        <ReleaseTimeline
          title="Timeline"
          start="2026-09-01"
          end="2026-10-11"
          rows={[
            {
              product: operator,
              releases: [
                {
                  tag: 'v1.2.0',
                  date: '2026-10-08',
                  prerelease: false,
                  repo: 'nebari-dev/nebari-operator',
                },
                {
                  tag: 'v1.2.0-rc1',
                  date: '2026-10-01',
                  prerelease: true,
                  repo: 'nebari-dev/nebari-operator',
                },
              ],
            },
            { product: nic, releases: [] },
          ]}
        />
      </MemoryRouter>,
    );
    const row = screen.getByRole('list', { name: 'Nebari Operator releases' });
    const marks = within(row).getAllByRole('listitem');
    expect(marks).toHaveLength(2);
    expect(marks[0]).toHaveAttribute(
      'href',
      'https://github.com/nebari-dev/nebari-operator/releases/tag/v1.2.0',
    );
    expect(marks[0]).not.toHaveAttribute('data-prerelease');
    expect(marks[1]).toHaveAttribute('data-prerelease', 'true');
    expect(marks[1]).toHaveAccessibleName(
      /v1\.2\.0-rc1, Oct 1, 2026, nebari-operator, prerelease/,
    );
    // Oct 8 is 37 of 40 days in: the mark sits at 92.5%.
    expect(marks[0]).toHaveStyle({ left: '92.5%' });
    // A product with nothing in the window keeps its row.
    const empty = screen.getByRole('list', {
      name: 'Nebari Infrastructure Core releases',
    });
    expect(within(empty).queryAllByRole('listitem')).toHaveLength(0);
    expect(empty).toHaveTextContent('none in this period');
  });
});
