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

  it('shows tiles for Nebari, Software Packs and Nebi docs, provenance behind (i)', async () => {
    stub(docs);
    renderPage();
    expect(await screen.findByText('Nebari docs, visits')).toBeInTheDocument();
    expect(screen.getByText('400')).toBeInTheDocument(); // 10 days × 40
    expect(screen.getByText('Software Packs docs, visits')).toBeInTheDocument();
    // Nebi has no data in this file yet, so its tile shows a dash.
    expect(screen.getByText('Nebi docs, visits')).toBeInTheDocument();
    expect(screen.getByText('no data collected yet')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'About: About these figures' }),
    ).toBeInTheDocument();
    // Classic is charted and listed but has no tile.
    expect(
      screen.queryByText('Nebari Classic docs, visits'),
    ).not.toBeInTheDocument();
  });

  it('shows the chart and every site in the top-pages table', async () => {
    stub(docs);
    renderPage();
    await screen.findByText('Nebari docs, visits');
    expect(
      screen.getByRole('figure', { name: /Daily docs visits by site/ }),
    ).toBeInTheDocument();
    const table = screen.getByRole('table', {
      name: /Top documentation pages/,
    });
    const rows = within(table).getAllByRole('row').slice(1);
    // Every site's pages in one table, biggest first.
    expect(
      rows.map((r) => within(r).getAllByRole('cell')[1].textContent),
    ).toEqual(['/', '/get-started/', '/welcome/', '/packs/chat/']);
    expect(within(rows[0]).getByText('Nebari docs')).toBeInTheDocument();
    expect(
      within(table).getByRole('link', { name: /get-started/ }),
    ).toHaveAttribute('href', 'https://nebari.dev/get-started/');
  });

  it('filters the table by site from the URL', async () => {
    stub(docs);
    renderPage('/docs?site=classic-docs');
    const table = await screen.findByRole('table', {
      name: /Top documentation pages/,
    });
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(1);
    expect(within(table).getByText('/welcome/')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Site' })).toHaveTextContent(
      'Nebari Classic docs',
    );
  });

  it('accepts several sites', async () => {
    stub(docs);
    renderPage('/docs?site=classic-docs,packs-docs');
    const table = await screen.findByRole('table', {
      name: /Top documentation pages/,
    });
    expect(
      within(table)
        .getAllByRole('row')
        .slice(1)
        .map((r) => within(r).getAllByRole('cell')[1].textContent),
    ).toEqual(['/welcome/', '/packs/chat/']);
    expect(screen.getByRole('combobox', { name: 'Site' })).toHaveTextContent(
      'All but Nebari docs',
    );
  });

  it('shows an empty row when the search matches nothing', async () => {
    stub(docs);
    renderPage('/docs?q=nothing-here');
    const table = await screen.findByRole('table', {
      name: /Top documentation pages/,
    });
    expect(table).toHaveTextContent('No pages match "nothing-here".');
  });

  it('explains the token when there is no data', async () => {
    stub({ ...docs, sites: docs.sites.map((s) => ({ ...s, series: [] })) });
    renderPage();
    expect(await screen.findByText('No docs traffic yet.')).toBeInTheDocument();
    expect(screen.getByText('CLOUDFLARE_ANALYTICS_TOKEN')).toBeInTheDocument();
  });
});
