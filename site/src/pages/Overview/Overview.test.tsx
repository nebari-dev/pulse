import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { stubSummaryFetch } from '@/test/fixtures';
import Overview from './Overview';

function renderOverview(url = '/') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Overview />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Overview', () => {
  beforeEach(() => stubSummaryFetch());
  afterEach(() => vi.unstubAllGlobals());

  it('shows totals and every product once data loads', async () => {
    renderOverview();
    expect(await screen.findByText('Nebari Operator')).toBeInTheDocument();
    expect(screen.getByText('Chat Pack')).toBeInTheDocument();
    // operator 550 + nic 6 + 15 + chat 10 = 581 over the 90d window
    expect(screen.getByText('581')).toBeInTheDocument();
    expect(screen.getByText('Data through')).toBeInTheDocument();
  });

  it('filters by kind and source from the URL', async () => {
    renderOverview('/?kind=pack&source=quay');
    expect(await screen.findByText('Chat Pack')).toBeInTheDocument();
    expect(screen.queryByText('Nebari Operator')).not.toBeInTheDocument();
    expect(screen.getByText(/from Quay/)).toBeInTheDocument();
  });

  it('stacks the chart by artifact type and filters by type', async () => {
    renderOverview();
    const legend = await screen.findByRole('list', { name: 'Legend' });
    expect(legend).toHaveTextContent('Images');
    expect(legend).toHaveTextContent('Helm charts');
    expect(legend).toHaveTextContent('Packages');
    expect(legend).toHaveTextContent('Binaries');

    renderOverview('/?type=chart');
    expect(
      await screen.findByText(/Daily helm charts by source/),
    ).toBeInTheDocument();
  });

  it('reports a load failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500 })),
    );
    renderOverview();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not load/i,
    );
  });
});
