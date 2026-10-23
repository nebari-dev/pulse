import { Activity, Github, Moon, Sun } from 'lucide-react';
import logoDark from '@/assets/nebari-logo_dark.svg';
import logoLight from '@/assets/nebari-logo_light.svg';
import { Button } from '@/components/ui/button';
import {
  MenuBarActions,
  MenuBarBrand,
  NavigationMenu,
} from '@/components/ui/navigation-menu';
import { useTheme } from '@/hooks/theme-provider';

export const REPO_URL = 'https://github.com/nebari-dev/pulse';

function Header() {
  const { isDarkMode, setThemeMode } = useTheme();
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
      <MenuBarActions className="gap-2">
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
          aria-label={
            isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'
          }
          aria-pressed={isDarkMode}
          onClick={() => setThemeMode(isDarkMode ? 'light' : 'dark')}
        >
          {isDarkMode ? <Sun /> : <Moon />}
        </Button>
      </MenuBarActions>
    </NavigationMenu>
  );
}

export default Header;
