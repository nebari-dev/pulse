import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { DocsFile } from '@/lib/summary';
import Docs from './Docs';

function stub(docs: DocsFile) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, json: async () => docs })),
  );
}

function renderPage(url = '/docs') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Docs />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const day = (i: number) => `2026-10-${String(1 + i).padStart(2, '0')}`;
const docs: DocsFile = {
  generated_at: '2026-10-11',
  sites: [
    {
      id: 'docs',
      name: 'Nebari docs',
      hosts: ['nebari.dev', 'www.nebari.dev'],
      series: Array.from({ length: 10 }, (_, i) => ({
        date: day(i),
        pageviews: 100,
        visits: 40,
      })),
      top_pages: [
        { path: '/', pageviews: 300 },
        { path: '/get-started/', pageviews: 120 },
      ],
      top_pages_date: '2026-10-11',
    },
    {
      id: 'classic-docs',
      name: 'Nebari Classic docs',
      hosts: ['classic.nebari.dev'],
      series: Array.from({ length: 10 }, (_, i) => ({
        date: day(i),
        pageviews: 20,
        visits: 10,
      })),
      top_pages: [{ path: '/welcome/', pageviews: 50 }],
      top_pages_date: '2026-10-11',
    },
    {
      id: 'packs-docs',
      name: 'Software Packs docs',
      hosts: ['packs.nebari.dev'],
      series: Array.from({ length: 10 }, (_, i) => ({
        date: day(i),
        pageviews: 8,
        visits: 4,
      })),
      top_pages: [{ path: '/packs/chat/', pageviews: 12 }],
      top_pages_date: '2026-10-11',
    },
  ],
};

describe('Docs', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows visits per site, the chart and top pages', async () => {
    stub(docs);
    renderPage();
    expect(await screen.findByText('Nebari docs, visits')).toBeInTheDocument();
    expect(screen.getByText('400')).toBeInTheDocument(); // 10 days × 40
    expect(screen.getByText('100')).toBeInTheDocument(); // classic 10 × 10
    expect(
      screen.getByRole('figure', { name: /Daily docs visits by site/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('table', { name: /top pages$/ })).toHaveLength(
      3,
    );
    const table = screen.getByRole('table', { name: 'Nebari docs top pages' });
    expect(
      within(table).getByRole('link', { name: /get-started/ }),
    ).toHaveAttribute('href', 'https://nebari.dev/get-started/');
  });

  it('filters the page tables by search', async () => {
    stub(docs);
    renderPage('/docs?q=welcome');
    const classic = await screen.findByRole('table', {
      name: 'Nebari Classic docs top pages',
    });
    expect(within(classic).getByText('/welcome/')).toBeInTheDocument();
    const main = screen.getByRole('table', { name: 'Nebari docs top pages' });
    expect(main).toHaveTextContent('No pages match "welcome".');
  });

  it('explains the token when there is no data', async () => {
    stub({ ...docs, sites: docs.sites.map((s) => ({ ...s, series: [] })) });
    renderPage();
    expect(await screen.findByText('No docs traffic yet.')).toBeInTheDocument();
    expect(screen.getByText('CLOUDFLARE_ANALYTICS_TOKEN')).toBeInTheDocument();
  });
});
