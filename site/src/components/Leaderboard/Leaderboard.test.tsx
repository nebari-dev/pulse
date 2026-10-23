import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { chatPack, operator } from '@/test/fixtures';
import Leaderboard, { type LeaderboardRow } from './Leaderboard';

const rows: LeaderboardRow[] = [
  {
    product: chatPack,
    comparison: { current: 10, previous: 5, delta: 1 },
    share: 0.1,
    points: chatPack.artifacts[0].series,
  },
  {
    product: operator,
    comparison: { current: 90, previous: 0, delta: null },
    share: 0.9,
    points: operator.artifacts[0].series,
  },
];

function names() {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('cell')[0].textContent);
}

describe('Leaderboard', () => {
  it('sorts by downloads descending by default and links to products', () => {
    render(
      <MemoryRouter>
        <Leaderboard rows={rows} rangeLabel="90 days" />
      </MemoryRouter>,
    );
    expect(names()).toEqual(['Nebari Operator', 'Chat Pack']);
    expect(screen.getByRole('link', { name: 'Chat Pack' })).toHaveAttribute(
      'href',
      '/product/chat-pack',
    );
    expect(screen.getByText('—')).toBeInTheDocument(); // null delta
  });

  it('re-sorts when a header is clicked', async () => {
    render(
      <MemoryRouter>
        <Leaderboard rows={rows} rangeLabel="90 days" />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: /product/i }));
    expect(names()).toEqual(['Chat Pack', 'Nebari Operator']);
    expect(
      screen.getByRole('columnheader', { name: /product/i }),
    ).toHaveAttribute('aria-sort', 'ascending');
  });
});
