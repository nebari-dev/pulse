# AGENTS.md — pulse-dashboard

This file provides guidance for AI agents (Claude Code, Copilot, Cursor, etc.) working in this repository. Read it before making changes.

---

## Project Overview

| Item                  | Value                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Project**           | pulse-dashboard                                                                                                     |
| **Framework**         | React 19 + TypeScript + Vite                                                                                        |
| **Styling**           | Tailwind CSS 4 (CSS-first) + @nebari/design — Nebari brand tokens (Geist font, magenta primary), Base UI components |
| **Component library** | @nebari/design (shadcn registry, Base UI–based)                                                                     |
| **Routing**           | React Router v6                                                                                                     |
| **Data fetching**     | TanStack Query v5                                                                                                   |
| **Global state**      | Jotai v2                                                                                                            |
| **Testing**           | Vitest + Testing Library                                                                                            |
| **Quality**           | Biome (format + lint + import sort)                                                                                 |
| **Package manager**   | npm                                                                                                                 |
| **Dev port**          | 5173                                                                                                                |

---

## Repository Structure

```
pulse-dashboard/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── lib/
│   │   ├── utils.ts
│   │   ├── summary.ts     # summary.json types + pure helpers (windows, series, deltas)
│   │   └── format.ts
│   ├── hooks/
│   │   ├── useSummary.ts         # TanStack Query over /data/summary.json
│   │   ├── useDashboardParams.ts # range/kind/source filters in the URL
│   ├── components/
│   │   └── ui/            # Nebari components (installed via shadcn — managed)
│   ├── providers/
│   │   └── ThemeProvider/
│   │       ├── ThemeProvider.tsx
│   │       └── index.ts
│   ├── pages/
│   │   ├── Home/
│   │   │   ├── Home.tsx
│   │   │   ├── Home.test.tsx
│   │   │   └── index.ts
│   │   └── NotFound/
│   │       ├── NotFound.tsx
│   │       ├── NotFound.test.tsx
│   │       └── index.ts
│   └── test/
│       └── setup.ts
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── components.json
├── biome.json
└── AGENTS.md
```

> Tailwind v4 is configured in `src/index.css` (`@import "tailwindcss"`) with the Nebari brand tokens installed via `npx shadcn add @nebari/theme` — no `tailwind.config.ts` or `postcss.config.js`. Biome replaces ESLint + Prettier — no `eslint.config.js`.

---

## Development Commands

**After every major change: run build, test, and check before considering the task complete.**

```bash
npm run build && npm run test -- --run && npm run check
```

`npm run check` runs Biome — formats, lints, and organizes imports in one pass (`biome check --write`). It replaces ESLint + Prettier.

---

## Coding Standards

### Naming

| Thing     | Convention                                          | Example                         |
| --------- | --------------------------------------------------- | ------------------------------- |
| Component | PascalCase                                          | `UserCard`, `DashboardPage`     |
| Directory | PascalCase                                          | `UserCard/`, `DashboardPage/`   |
| File      | PascalCase (components), camelCase (non-components) | `UserCard.tsx`, `utils.ts`      |
| Hook      | camelCase, `use` prefix                             | `useCurrentUser`, `useProducts` |
| Utility   | camelCase                                           | `formatDate`, `cn`              |

> This applies to your app code. Nebari components installed under
> `src/components/ui/` keep their upstream kebab-case filenames (`button.tsx`) —
> don't rename them.

### Component Structure

Every component lives in its own PascalCase directory with a component file, test file, and `index.ts` barrel export. Same rule applies to pages.

```
src/components/UserCard/
├── UserCard.tsx
├── UserCard.test.tsx
└── index.ts
```

Import from the folder, not the file directly:

```tsx
import UserCard from '@/components/UserCard';
import Settings from '@/pages/Settings';
```

### Dark Mode

Always use semantic color tokens so dark mode works automatically:

```tsx
// Good
<div className="bg-background text-foreground">

// Bad — bypasses the token system
<div className="bg-white text-gray-900">
```

Toggle by adding/removing the `.dark` class on `<html>` (the `ThemeProvider` does this). Every Nebari component re-themes from the active token set — never add `dark:` variants of your own.

### @nebari/design components

Nebari is a **shadcn component registry** styled with the Nebari brand and built on **Base UI**. The `@nebari` registry is wired into `components.json`. Add components via CLI — **never hand-edit files in `src/components/ui/`**:

```bash
npx shadcn add @nebari/theme      # brand tokens (add once, first)
npx shadcn add @nebari/button     # a component
npx shadcn view @nebari/button    # inspect variants/props/source before installing
curl -s https://nebari-dev.github.io/nebari-design/r/registry.json   # list the catalog
```

- **Installed `ui/*` files are upstream-managed, not app-owned.** `shadcn add` overwrites them on upgrade — any local edit is silently lost. To change look or behavior, do it at the **call site**: pass extra classes via `className` (merged with `cn()`, so your classes win), swap the element with the Base UI `render` prop, or build a thin wrapper component in your own code.
- **Composition uses the Base UI `render` prop**, e.g. `<Button render={<a href="/docs" />}>Docs</Button>`. There is no `asChild`.
- **Need a component not in the catalog?** Fall back to the upstream shadcn component, then style it with the same semantic tokens.
- The `nebari-ui` skill (installed with the project) has the full catalog, composition, theming, and motion guidance.

---

## API Calls — TanStack Query Pattern

Create custom hooks in `src/hooks/` that wrap `useQuery` / `useMutation` using `src/lib/api.ts`.

```typescript
// src/hooks/use-products.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: () => api.get<Product[]>('/products'),
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProductInput) =>
      api.post<Product>('/products', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
```

---

## Global State — Jotai

Use Jotai for client-side state shared across multiple unrelated components. All atoms live in `src/store/`.

| State type                                             | Where it lives                              |
| ------------------------------------------------------ | ------------------------------------------- |
| Component-local (e.g. form input, toggle)              | `useState` inside the component             |
| Server data (e.g. API responses)                       | TanStack Query (`useQuery` / `useMutation`) |
| Shared client state (e.g. sidebar open, selected item) | Jotai atom in `src/store/`                  |

**Never duplicate server state in atoms.** Derive from query data instead.

```typescript
// src/store/appAtoms.ts
import { atom } from 'jotai';

export const sidebarOpenAtom = atom<boolean>(false);
export const selectedItemIdAtom = atom<string | null>(null);

// Derived (read-only)
export const hasSelectionAtom = atom((get) => get(selectedItemIdAtom) !== null);
```

```tsx
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { sidebarOpenAtom } from '@/store/appAtoms';

const [open, setOpen] = useAtom(sidebarOpenAtom); // read + write
const open = useAtomValue(sidebarOpenAtom); // read only
const setOpen = useSetAtom(sidebarOpenAtom); // write only
```

---

## Theme / Dark Mode

```tsx
import { useTheme } from '@/providers/ThemeProvider';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      Toggle theme
    </button>
  );
}
```

The Nebari brand tokens are installed via `npx shadcn add @nebari/theme` into `src/index.css` — re-run that command to update them. Don't hand-copy token values into the stylesheet.

---

## Testing Standards

- Test files live **next to** the component they test (same directory).
- Use `@testing-library/react` — query by role/label/text, not implementation details. Nebari components expose stable `data-slot` / `data-variant` / `data-size` attributes you can target when needed.
- Wrap components that use React Router in `<MemoryRouter>` in tests.
- Wrap components that use TanStack Query in `<QueryClientProvider>` in tests.

---

## Adding a New Page

1. Create `src/pages/PageName/` directory (PascalCase)
2. Add `PageName.tsx`, `PageName.test.tsx`, and `index.ts`
3. Add a `<Route>` in `src/App.tsx`

---

## Claude Code Skills

Claude Code skills for this project:
- **nebari-ui** — the Nebari design-system consumer skill (installed from the `@nebari` shadcn registry via `npx shadcn add @nebari/claude-skill`, lands in `~/.claude/skills/nebari-ui/`). Covers the component catalog, Base UI `render`-prop composition, theming, and motion. Activates when you ask to add or use Nebari components.

---

## What NOT To Do

| Don't                                                                     | Do instead                                                                                                                         |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Hand-edit `src/components/ui/` files                                      | They're managed by `shadcn add` and overwritten on upgrade — extend at the call site (`className`, Base UI `render`, or a wrapper) |
| Build a custom component when a Nebari one exists                         | Check the catalog (`npx shadcn view @nebari/<name>`); add it with `npx shadcn add @nebari/<name>`                                  |
| Reach for an `asChild` prop                                               | Use the Base UI `render` prop (`<Button render={<a />}>`)                                                                          |
| Add one-off utility classes that fight a component's variants             | Pass a `variant`/`size`, or extend via `className` (merged with `cn()`)                                                            |
| Use TypeScript `any`                                                      | Use proper types or `unknown` with narrowing                                                                                       |
| Use raw Tailwind colors (`bg-white`, `text-gray-900`) or `dark:` variants | Use semantic tokens (`bg-background`, `text-foreground`) — they flip with `.dark` automatically                                    |
| Hand-copy Nebari token values into `src/index.css`                        | Run `npx shadcn add @nebari/theme` — the theme item owns the tokens                                                                |
| Fetch directly in components                                              | Create a hook in `src/hooks/` using TanStack Query                                                                                 |
| Store server/API data in Jotai atoms                                      | Use TanStack Query — it owns server state                                                                                          |
| Scatter atoms across component files                                      | Put all atoms in `src/store/`                                                                                                      |
| Put a component in a flat file                                            | Give it its own PascalCase directory with a test file and `index.ts`                                                               |
| Import from the component file directly                                   | Import from the folder (`@/components/UserCard`, not `@/components/UserCard/UserCard`)                                             |
