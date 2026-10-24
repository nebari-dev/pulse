import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { stubSummaryFetch } from '@/test/fixtures';
import Sources from './Sources';

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/sources']}>
        <Sources />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Sources', () => {
  beforeEach(() => stubSummaryFetch());
  afterEach(() => vi.unstubAllGlobals());

  it('explains each source and when its counts begin', async () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'Data sources' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Missing is not zero')).toBeInTheDocument();
    const downloads = screen.getByRole('table', { name: 'Downloads' });
    const quay = within(downloads).getByText('Quay').closest('tr');
    // Filled in from summary.json once it loads.
    await within(quay as HTMLElement).findByText(/2026/);
    expect(
      screen.getByRole('table', { name: 'GitHub repositories' }),
    ).toHaveTextContent('Traffic');
  });
});
