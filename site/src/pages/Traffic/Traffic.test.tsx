import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { chatPack, stubSummaryFetch, summary } from '@/test/fixtures';
import Traffic from './Traffic';

function renderPage(url = '/traffic') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Traffic />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Traffic', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sums views and clones per repo and overall', async () => {
    stubSummaryFetch();
    renderPage();
    const row = (
      await screen.findByRole('link', { name: /nebari-operator/ })
    ).closest('tr') as HTMLElement;
    expect(within(row).getByText('60')).toBeInTheDocument(); // views 10+20+30
    expect(within(row).getByText('6')).toBeInTheDocument(); // clones 2*3
    expect(screen.getByText('Views, last 14 days')).toBeInTheDocument();
    // Repos without traffic are left out rather than shown as zero.
    expect(
      screen.queryByRole('link', { name: /infrastructure-core/ }),
    ).not.toBeInTheDocument();
  });

  it('explains the token requirement when nothing has traffic', async () => {
    stubSummaryFetch({
      ...summary,
      products: [chatPack],
      repos: { count: 0, traffic: 0 },
    });
    renderPage();
    expect(await screen.findByText('No traffic data yet.')).toBeInTheDocument();
    expect(screen.getByText('PULSE_GITHUB_TOKEN')).toBeInTheDocument();
  });
});
