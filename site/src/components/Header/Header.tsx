import { Activity, CircleHelp, Github, Menu, Moon, Sun } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import logoDark from '@/assets/nebari-logo_dark.svg';
import logoLight from '@/assets/nebari-logo_light.svg';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MenuBarActions,
  MenuBarBrand,
  MenuBarNav,
  NavigationMenu,
  NavLink,
} from '@/components/ui/navigation-menu';
import { useTheme } from '@/hooks/theme-provider';

export const REPO_URL = 'https://github.com/nebari-dev/pulse';

/** Top-level sections. Product pages count as Downloads. */
export const NAV = [
  {
    to: '/',
    label: 'Downloads',
    match: (p: string) => p === '/' || p.startsWith('/product/'),
  },
  {
    to: '/releases',
    label: 'Releases',
    match: (p: string) => p.startsWith('/releases'),
  },
  {
    to: '/repos',
    label: 'Repos',
    match: (p: string) => p.startsWith('/repos'),
  },
  {
    to: '/traffic',
    label: 'Traffic',
    match: (p: string) => p.startsWith('/traffic'),
  },
  { to: '/docs', label: 'Docs', match: (p: string) => p.startsWith('/docs') },
];

function Header() {
  const { isDarkMode, setThemeMode } = useTheme();
  const { pathname, search } = useLocation();
  const themeLabel = isDarkMode
    ? 'Switch to light mode'
    : 'Switch to dark mode';
  const toggleTheme = () => setThemeMode(isDarkMode ? 'light' : 'dark');
  return (
    <NavigationMenu className="h-14 justify-between border-border bg-header pl-4 text-header-foreground">
      <MenuBarBrand href="/" aria-label="Pulse home" className="gap-3">
        <img
          src={isDarkMode ? logoDark : logoLight}
          alt="Nebari"
          className="h-8 w-auto"
        />
        <span className="flex items-center gap-1.5 border-border border-l pl-3">
          <Activity className="size-4 text-primary" aria-hidden="true" />
          <span className="font-semibold text-base tracking-tight">Pulse</span>
        </span>
      </MenuBarBrand>
      <MenuBarNav aria-label="Sections" className="ml-6 hidden gap-1 sm:flex">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            active={item.match(pathname)}
            render={<Link to={{ pathname: item.to, search }} />}
          >
            {item.label}
          </NavLink>
        ))}
      </MenuBarNav>
      <MenuBarActions className="hidden gap-2 sm:flex">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Data sources and how to read the charts"
          aria-current={pathname === '/sources' ? 'page' : undefined}
          render={<Link to={{ pathname: '/sources', search }} />}
        >
          <CircleHelp />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="View source on GitHub"
          render={<a href={REPO_URL} target="_blank" rel="noreferrer" />}
        >
          <Github />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={themeLabel}
          aria-pressed={isDarkMode}
          onClick={toggleTheme}
        >
          {isDarkMode ? <Sun /> : <Moon />}
        </Button>
      </MenuBarActions>
      {/* Below the sm breakpoint everything that is not the brand lives in
          one hamburger menu, so nothing competes for the remaining width. */}
      <MenuBarActions className="pr-2 sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            variant="ghost"
            aria-label="Menu"
            render={<Button variant="ghost" size="icon" />}
          >
            <Menu />
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent align="end" className="min-w-48">
              {NAV.map((item) => (
                <DropdownMenuItem
                  key={item.to}
                  aria-current={item.match(pathname) ? 'page' : undefined}
                  className="aria-[current=page]:font-semibold"
                  render={<Link to={{ pathname: item.to, search }} />}
                >
                  {item.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                aria-current={pathname === '/sources' ? 'page' : undefined}
                className="aria-[current=page]:font-semibold"
                render={<Link to={{ pathname: '/sources', search }} />}
              >
                <CircleHelp aria-hidden="true" />
                Data sources
              </DropdownMenuItem>
              <DropdownMenuItem
                render={<a href={REPO_URL} target="_blank" rel="noreferrer" />}
              >
                <Github aria-hidden="true" />
                View source on GitHub
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleTheme}>
                {isDarkMode ? (
                  <Sun aria-hidden="true" />
                ) : (
                  <Moon aria-hidden="true" />
                )}
                {themeLabel}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenu>
      </MenuBarActions>
    </NavigationMenu>
  );
}

export default Header;
