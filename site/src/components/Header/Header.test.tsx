import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/hooks/theme-provider';
import Header, { REPO_URL } from './Header';

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

  it('puts sections, the source link and the theme toggle in one hamburger', async () => {
    renderHeader('/repos?kind=pack');
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
    const menu = await screen.findByRole('menu');
    const items = within(menu).getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual([
      'Downloads',
      'Releases',
      'Repos',
      'Traffic',
      'Docs',
      'View source on GitHub',
      'Switch to dark mode',
    ]);
    expect(items[2]).toHaveAttribute('aria-current', 'page');
    expect(items[3]).toHaveAttribute('href', '/traffic?kind=pack');
    expect(items[5]).toHaveAttribute('href', REPO_URL);
    await userEvent.click(items[6]);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
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
