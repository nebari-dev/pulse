import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ProductRepos } from '@/lib/summary';
import ReleaseCadence from './ReleaseCadence';

const operator: ProductRepos = {
  id: 'nebari-operator',
  name: 'Nebari Operator',
  kind: 'product',
  repos: [
    {
      repo: 'nebari-dev/nebari-operator',
      health: null,
      health_series: [],
      traffic: [],
      stars_series: [],
      contributors: { active_30d: 0, monthly: [] },
      releases: [
        { tag: 'v1.2.0-rc1', date: '2026-10-05', prerelease: true },
        { tag: 'v1.2.0', date: '2026-10-01', prerelease: false },
        { tag: 'v1.1.0', date: '2026-09-03', prerelease: false },
        { tag: 'v1.0.0', date: '2026-08-03', prerelease: false },
      ],
    },
  ],
};

const nic: ProductRepos = {
  id: 'nic',
  name: 'Nebari Infrastructure Core',
  kind: 'product',
  repos: [{ ...operator.repos[0], repo: 'nebari-dev/nic', releases: [] }],
};

const chat: ProductRepos = {
  id: 'chat-pack',
  name: 'Chat Pack',
  kind: 'pack',
  repos: [],
};

function renderTable(products = [operator, nic, chat]) {
  return render(
    <MemoryRouter>
      <ReleaseCadence products={products} asOf="2026-10-11" />
    </MemoryRouter>,
  );
}

describe('ReleaseCadence', () => {
  it('shows cadence per product with repos, ignoring prereleases', () => {
    renderTable();
    const table = screen.getByRole('table', { name: /Release cadence/ });
    const row = within(table)
      .getByRole('link', { name: 'Nebari Operator' })
      .closest('tr') as HTMLElement;
    expect(within(row).getByText('v1.2.0')).toBeInTheDocument();
    // 3 stable releases in the 90 days ending 2026-10-11; gaps 31 and 28 days.
    expect(within(row).getByText('3')).toBeInTheDocument();
    expect(within(row).getByText('30 d')).toBeInTheDocument();
    expect(within(table).queryByText('v1.2.0-rc1')).not.toBeInTheDocument();
    // NIC has a repo but no releases; Chat Pack has no repos at all.
    expect(within(table).getByText('no releases')).toBeInTheDocument();
    expect(within(table).queryByText('Chat Pack')).not.toBeInTheDocument();
    expect(
      screen.getByText(/3 stable releases in the last 90 days; 1 of 2/),
    ).toBeInTheDocument();
  });

  it('sorts by product name', async () => {
    renderTable();
    await userEvent.click(screen.getByRole('button', { name: 'Product' }));
    const links = within(screen.getByRole('table')).getAllByRole('link', {
      name: /^Nebari /,
    });
    expect(links.map((l) => l.textContent)).toEqual([
      'Nebari Infrastructure Core',
      'Nebari Operator',
    ]);
  });
});
