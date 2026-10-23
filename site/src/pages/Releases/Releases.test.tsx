import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { stubSummaryFetch } from '@/test/fixtures';
import Releases from './Releases';

function renderPage(url = '/releases') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Releases />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Releases', () => {
  beforeEach(() => stubSummaryFetch());
  afterEach(() => vi.unstubAllGlobals());

  it('shows cadence per product with repos, ignoring prereleases', async () => {
    renderPage();
    const table = await screen.findByRole('table', { name: /Release cadence/ });
    const row = within(table)
      .getByRole('link', { name: 'Nebari Operator' })
      .closest('tr') as HTMLElement;
    expect(within(row).getByText('v1.2.0')).toBeInTheDocument();
    // 3 stable releases in the 90d window ending 2026-10-11; gaps 31 and 28 days.
    expect(within(row).getByText('3')).toBeInTheDocument();
    expect(within(row).getByText('30 d')).toBeInTheDocument();
    // NIC has a repo but no releases; Chat Pack has no repos at all.
    expect(screen.getByText('no releases')).toBeInTheDocument();
    expect(within(table).queryByText('Chat Pack')).not.toBeInTheDocument();
    // The feed lists the prerelease too.
    expect(screen.getByText('v1.2.0-rc1')).toBeInTheDocument();
    expect(screen.getByText('prerelease')).toBeInTheDocument();
  });

  it('filters the table by search', async () => {
    renderPage();
    const table = await screen.findByRole('table', { name: /Release cadence/ });
    await userEvent.type(screen.getByRole('searchbox'), 'infra');
    expect(
      within(table).getByRole('link', { name: 'Nebari Infrastructure Core' }),
    ).toBeInTheDocument();
    expect(
      within(table).queryByRole('link', { name: 'Nebari Operator' }),
    ).not.toBeInTheDocument();
  });
});
