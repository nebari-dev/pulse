import { render, screen, within } from '@testing-library/react';
import TrendChart from './TrendChart';

const rows = [
  { date: '2026-10-01', quay: 5 },
  { date: '2026-10-02', quay: 9 },
];

describe('TrendChart', () => {
  it('lists releases in the legend and for screen readers', () => {
    render(
      <TrendChart
        rows={rows}
        series={[{ key: 'quay', label: 'Quay', color: 'var(--chart-1)' }]}
        releases={[
          { date: '2026-10-02', tags: ['v1.2.0'] },
          // Outside the rows: not drawn or announced.
          { date: '2026-09-01', tags: ['v1.0.0'] },
        ]}
        title="Downloads"
      />,
    );
    const figure = screen.getByRole('figure', { name: 'Downloads' });
    expect(
      within(screen.getByRole('list', { name: 'Legend' })).getByText('Release'),
    ).toBeInTheDocument();
    expect(figure).toHaveTextContent('Releases: v1.2.0 (Oct 2, 2026).');
    expect(figure).not.toHaveTextContent('v1.0.0');
  });

  it('shows no legend for one series without releases', () => {
    render(
      <TrendChart
        rows={rows}
        series={[{ key: 'quay', label: 'Quay', color: 'var(--chart-1)' }]}
        title="Downloads"
      />,
    );
    expect(screen.queryByRole('list', { name: 'Legend' })).toBeNull();
  });
});
