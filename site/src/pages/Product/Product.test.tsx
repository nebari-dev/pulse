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
    expect(screen.getByText('v0.16.0')).toBeInTheDocument();
    expect(screen.getByText('linux/x86_64')).toBeInTheDocument();
  });

  it('shows not found for an unknown id', async () => {
    renderProduct('/product/nope');
    expect(
      await screen.findByRole('heading', { name: '404' }),
    ).toBeInTheDocument();
  });
});
