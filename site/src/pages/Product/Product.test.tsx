import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { stubSummaryFetch } from '@/test/fixtures';
import Product from './Product';

function renderProduct(url: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/product/:id" element={<Product />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Product', () => {
  beforeEach(() => stubSummaryFetch());
  afterEach(() => vi.unstubAllGlobals());

  it('lists artifacts and release breakdowns', async () => {
    renderProduct('/product/nic');
    expect(
      await screen.findByRole('heading', {
        name: 'Nebari Infrastructure Core',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: /nebari-dev\/nebari-infrastructure-core/,
      }),
    ).toHaveAttribute(
      'href',
      'https://github.com/nebari-dev/nebari-infrastructure-core/releases',
    );
    // Listed under both all-time downloads and 30-day version adoption.
    expect(screen.getAllByText('v0.16.0')).toHaveLength(2);
    // v0.15.0 had no downloads in the window, so adoption leaves it out.
    expect(screen.getAllByText('v0.15.0')).toHaveLength(1);
    expect(screen.getByText('linux/x86_64')).toBeInTheDocument();
    // A repo without a health snapshot shows dashes, and no release tiles.
    expect(screen.getByText('no GitHub releases')).toBeInTheDocument();
  });

  it('shows repo health, cadence and traffic when a product has repos', async () => {
    renderProduct('/product/nebari-operator');
    await screen.findByRole('heading', { name: 'Nebari Operator' });
    expect(screen.getByText('Latest release')).toBeInTheDocument();
    // In the latest-release tile and in the recent releases list.
    expect(screen.getAllByText('v1.2.0')).toHaveLength(2);
    expect(screen.getByText('median 30 days apart')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /^nebari-operator/ }),
    ).toHaveAttribute('href', 'https://github.com/nebari-dev/nebari-operator');
    expect(screen.getByText('Unique visitors, 14 days')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('60 views in all')).toBeInTheDocument();
    expect(screen.getByText('Recent releases')).toBeInTheDocument();
    expect(screen.getByText('Stars over time')).toBeInTheDocument();
    // 90-day window ending Oct 11 starts Jul 14: 0 → 42 stars.
    expect(screen.getByText('1 repo, +42 90 days')).toBeInTheDocument();
    expect(screen.getByText('prerelease')).toBeInTheDocument();
  });

  it('searches artifacts and repos together from the URL', async () => {
    renderProduct('/product/nic?q=pypi');
    await screen.findByRole('heading', { name: 'Nebari Infrastructure Core' });
    expect(screen.getByRole('searchbox')).toHaveValue('pypi');
    expect(screen.getByRole('link', { name: /^nic/ })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', {
        name: /nebari-dev\/nebari-infrastructure-core/,
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('No repos match "pypi".')).toBeInTheDocument();
  });

  it('shows not found for an unknown id', async () => {
    renderProduct('/product/nope');
    expect(
      await screen.findByRole('heading', { name: '404' }),
    ).toBeInTheDocument();
  });
});
