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
    const cells = within(row)
      .getAllByRole('cell')
      .map((c) => c.textContent);
    // unique visitors 5+10+15, unique cloners 1*3, then views and clones
    expect(cells.slice(2, 6)).toEqual(['30', '3', '60', '6']);
    expect(
      screen.getByText('Unique visitors, last 14 days'),
    ).toBeInTheDocument();
    expect(screen.getByText('Total clones')).toBeInTheDocument();
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
