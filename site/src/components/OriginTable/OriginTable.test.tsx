import { render, screen, within } from '@testing-library/react';
import OriginTable from './OriginTable';

describe('OriginTable', () => {
  it('ranks names with their share and puts the rest in Other', () => {
    render(
      <OriginTable
        title="Referrers"
        column="Referrer"
        rank={{
          top: [
            { name: 'github.com', pageviews: 60 },
            { name: '(direct)', pageviews: 30 },
          ],
          other: 10,
          total: 100,
        }}
        label={(n) => (n === '(direct)' ? 'Direct or unknown' : n)}
        empty="Nothing yet."
      />,
    );
    const rows = within(screen.getByRole('table', { name: 'Referrers' }))
      .getAllByRole('row')
      .slice(1);
    expect(
      rows.map((r) => within(r).getAllByRole('cell')[0].textContent),
    ).toEqual(['github.com', 'Direct or unknown', 'Other']);
    expect(within(rows[0]).getByText('60%')).toBeInTheDocument();
    expect(within(rows[2]).getByText('10%')).toBeInTheDocument();
  });

  it('shows the empty message when there is nothing to rank', () => {
    render(
      <OriginTable
        title="Countries"
        column="Country"
        rank={{ top: [], other: 0, total: 0 }}
        empty="No country data yet."
      />,
    );
    expect(screen.getByText('No country data yet.')).toBeInTheDocument();
  });
});
