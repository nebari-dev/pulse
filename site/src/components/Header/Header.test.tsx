import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/hooks/theme-provider';
import Header from './Header';

function renderHeader(url = '/') {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[url]}>
        <Header />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('Header', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('links the brand home', () => {
    renderHeader();
    expect(screen.getByRole('link', { name: /pulse home/i })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('marks the current section and keeps the query string', () => {
    renderHeader('/product/nic?range=30d');
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    const downloads = screen.getByRole('link', { name: 'Downloads' });
    expect(nav).toContainElement(downloads);
    expect(downloads).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Releases' })).toHaveAttribute(
      'href',
      '/releases?range=30d',
    );
    expect(screen.getByRole('link', { name: 'Repos' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('offers every section in the small-screen menu', async () => {
    renderHeader('/repos?kind=pack');
    const trigger = screen.getByRole('button', {
      name: 'Sections, current: Repos',
    });
    await userEvent.click(trigger);
    const menu = await screen.findByRole('menu');
    const items = within(menu).getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual([
      'Downloads',
      'Releases',
      'Repos',
      'Traffic',
    ]);
    expect(items[2]).toHaveAttribute('aria-current', 'page');
    expect(items[3]).toHaveAttribute('href', '/traffic?kind=pack');
  });

  it('toggles dark mode', async () => {
    renderHeader();
    await userEvent.click(
      screen.getByRole('button', { name: /switch to dark mode/i }),
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(
      screen.getByRole('button', { name: /switch to light mode/i }),
    ).toBeInTheDocument();
  });
});
