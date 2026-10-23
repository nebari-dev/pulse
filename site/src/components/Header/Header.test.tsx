import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/hooks/theme-provider';
import Header from './Header';

function renderHeader() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
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
