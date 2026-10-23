import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { stubSummaryFetch } from '@/test/fixtures';
import Repos from './Repos';

function renderPage(url = '/repos') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Repos />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Repos', () => {
  beforeEach(() => stubSummaryFetch());
  afterEach(() => vi.unstubAllGlobals());

  it('lists every repo with its health and totals', async () => {
    renderPage();
    const row = (
      await screen.findByRole('link', { name: /nebari-operator/ })
    ).closest('tr') as HTMLElement;
    expect(within(row).getByText('42')).toBeInTheDocument(); // stars
    expect(within(row).getByText('+2')).toBeInTheDocument(); // gained
    expect(within(row).getByText('12')).toBeInTheDocument(); // open issues
    expect(within(row).getByText('2 days ago')).toBeInTheDocument();
    // NIC has a repo but no health snapshot yet: dashes, not zeros.
    const nic = screen
      .getByRole('link', { name: /nebari-infrastructure-core/ })
      .closest('tr') as HTMLElement;
    expect(within(nic).getAllByText('—').length).toBeGreaterThan(3);
    expect(screen.getByText('across 1 repos')).toBeInTheDocument();
  });

  it('filters by search', async () => {
    renderPage();
    await screen.findByRole('link', { name: /nebari-operator/ });
    await userEvent.type(screen.getByRole('searchbox'), 'infra');
    expect(
      screen.queryByRole('link', { name: /nebari-operator/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /nebari-infrastructure-core/ }),
    ).toBeInTheDocument();
  });
});
