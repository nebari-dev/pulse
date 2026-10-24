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
    // In the leaderboard and in the share chart legend.
    expect(await screen.findAllByText('Nebari Operator')).not.toHaveLength(0);
    expect(screen.getByText('Chat Pack')).toBeInTheDocument();
    // operator 550 + nic 6 + 15 = 571 over the 90d window; Chat Pack's 10
    // chart pulls are polling and Helm charts start deselected.
    expect(screen.getByText('571')).toBeInTheDocument();
    expect(screen.getAllByText(/Helm charts not included/)).not.toHaveLength(0);
    expect(
      screen.getByRole('combobox', { name: 'Artifact type' }),
    ).toHaveTextContent('All but Helm charts');
    expect(
      screen.getByRole('button', { name: 'About: About these figures' }),
    ).toBeInTheDocument();
  });

  it("charts each product's share of the weekly total", async () => {
    renderOverview();
    const figure = await screen.findByRole('figure', {
      name: /Weekly share of downloads by product/,
    });
    expect(figure).toHaveTextContent('Nebari Operator');
    expect(figure).toHaveTextContent('Nebari Infrastructure Core');
    // Chat Pack only has chart pulls, which are deselected by default.
    expect(figure).not.toHaveTextContent('Chat Pack');
  });

  it('filters by kind and source from the URL', async () => {
    renderOverview('/?kind=pack&source=quay&type=chart');
    expect(await screen.findByText('Chat Pack')).toBeInTheDocument();
    expect(screen.queryByText('Nebari Operator')).not.toBeInTheDocument();
    expect(screen.getByText(/from Quay/)).toBeInTheDocument();
  });

  it('accepts several values per filter', async () => {
    renderOverview('/?source=quay,pypi');
    expect(await screen.findByText(/from Quay and PyPI/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Source' })).toHaveTextContent(
      'Quay, PyPI',
    );
  });

  it('stacks the chart by artifact type and filters by type', async () => {
    const first = renderOverview('/?type=image,chart,package,binary');
    const trend = await screen.findByRole('figure', {
      name: /Daily downloads, 90 days/,
    });
    const legend = within(trend).getByRole('list', { name: 'Legend' });
    expect(legend).toHaveTextContent('Images');
    expect(legend).toHaveTextContent('Helm charts');
    expect(legend).toHaveTextContent('Packages');
    expect(legend).toHaveTextContent('Binaries');
    expect(
      screen.getByRole('combobox', { name: 'Artifact type' }),
    ).toHaveTextContent('All types');
    expect(screen.getByText('581')).toBeInTheDocument();

    first.unmount();
    renderOverview('/?type=chart');
    expect(
      await screen.findByText(/Daily helm charts by source/),
    ).toBeInTheDocument();
    // Selecting charts explicitly counts them: Chat Pack's 10 pulls.
    expect(screen.getAllByText('10').length).toBeGreaterThan(0);
    expect(
      screen.queryByText(/Helm charts not included/),
    ).not.toBeInTheDocument();
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
