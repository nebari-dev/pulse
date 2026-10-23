import { DEFAULT_THEME_STORAGE_KEY } from '@/hooks/use-theme-preference';

/**
 * Pulse defaults to dark mode. The Nebari theme hook defaults to `system`
 * and persists whatever the user picks, so seed a `dark` preference on the
 * first visit and leave any later choice alone. The inline script in
 * index.html does the same before first paint so there is no light flash.
 */
export function seedDarkDefault(storage: Storage = localStorage): void {
  try {
    if (storage.getItem(DEFAULT_THEME_STORAGE_KEY) === null) {
      storage.setItem(DEFAULT_THEME_STORAGE_KEY, 'dark');
    }
  } catch {
    // Storage unavailable (private mode): the hook falls back to in-memory
    // state and the bootstrap script has already applied dark.
  }
}
