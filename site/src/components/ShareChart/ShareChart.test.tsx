import { render, screen } from '@testing-library/react';
import ShareChart from './ShareChart';

describe('ShareChart', () => {
  it('names the figure and lists every band in the legend', () => {
    render(
      <ShareChart
        title="Share by product"
        rows={[{ date: '2026-10-05', a: 60, a_n: 6, other: 40, other_n: 4 }]}
        series={[
          { key: 'a', label: 'A', color: 'red' },
          { key: 'other', label: 'Other', color: 'grey' },
        ]}
      />,
    );
    expect(
      screen.getByRole('figure', { name: 'Share by product' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Legend' })).toHaveTextContent(
      'AOther',
    );
  });
});
