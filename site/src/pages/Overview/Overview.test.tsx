import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
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
    // In the leaderboard, the what-changed strip and the share chart legend.
    expect(await screen.findAllByText('Nebari Operator')).not.toHaveLength(0);
    expect(screen.getByText('Chat Pack')).toBeInTheDocument();
    // operator 550 + nic 6 + 15 = 571 over the 90d window; Chat Pack's 10
    // chart pulls are polling and stay out of the headline.
    expect(screen.getByText('571')).toBeInTheDocument();
    expect(screen.getByText(/excluding chart polls/)).toBeInTheDocument();
    expect(screen.getByText('Data through')).toBeInTheDocument();
  });

  it("shows this week's releases in the what-changed strip", async () => {
    renderOverview();
    const strip = await screen.findByRole('region', {
      name: 'Releases this week',
    });
    expect(strip).toHaveTextContent('v1.2.0');
    expect(strip).not.toHaveTextContent('v1.1.0');
  });

  it("charts each product's share of the weekly total", async () => {
    renderOverview();
    const figure = await screen.findByRole('figure', {
      name: /Weekly share of downloads by product/,
    });
    expect(figure).toHaveTextContent('Nebari Operator');
    expect(figure).toHaveTextContent('Nebari Infrastructure Core');
    // Chat Pack only has chart pulls, which the headline leaves out.
    expect(figure).not.toHaveTextContent('Chat Pack');
  });

  it('filters by kind and source from the URL', async () => {
    renderOverview('/?kind=pack&source=quay');
    expect(await screen.findByText('Chat Pack')).toBeInTheDocument();
    expect(screen.queryByText('Nebari Operator')).not.toBeInTheDocument();
    expect(screen.getByText(/from Quay/)).toBeInTheDocument();
  });

  it('stacks the chart by artifact type and filters by type', async () => {
    const first = renderOverview();
    const trend = await screen.findByRole('figure', {
      name: /Daily downloads, 90 days/,
    });
    const legend = within(trend).getByRole('list', { name: 'Legend' });
    expect(legend).toHaveTextContent('Images');
    expect(legend).toHaveTextContent('Helm charts');
    expect(legend).toHaveTextContent('Packages');
    expect(legend).toHaveTextContent('Binaries');

    first.unmount();
    renderOverview('/?type=chart');
    expect(
      await screen.findByText(/Daily helm charts by source/),
    ).toBeInTheDocument();
    // Selecting charts explicitly counts them: Chat Pack's 10 pulls.
    expect(screen.getAllByText('10').length).toBeGreaterThan(0);
    expect(screen.queryByText(/excluding chart polls/)).not.toBeInTheDocument();
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
