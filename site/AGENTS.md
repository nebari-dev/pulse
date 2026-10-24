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
| **Global state**      | URL search params via `useDashboardParams` (no store)                                                               |
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
│   │   ├── summary.ts     # summary.json types + pure helpers (windows, series, deltas, search)
│   │   ├── repos.ts       # release cadence, repo health and traffic helpers
│   │   ├── anomalies.ts   # single-day spike detection + chart marker notes
│   │   └── format.ts
│   ├── hooks/
│   │   ├── useSummary.ts         # useSummary (index), useRepos, useProduct(id), useDocs over /data/*.json
│   │   ├── useDashboardParams.ts # range/kind/type/source filters + search (q) in the URL
│   ├── components/
│   │   ├── ui/            # Nebari components (installed via shadcn — managed)
│   │   ├── Header/        # brand, section nav, GitHub link, theme toggle; one hamburger below sm
│   │   ├── PageHeader/    # title + description + page-wide controls row used by every page
│   │   ├── TableCard/     # card around one table; that table's controls sit top right
│   │   ├── SearchBox/     # text filter for tables; value lives in the URL (?q=)
│   │   ├── ShareChart/    # 100% stacked weekly share by product (lib/summary.ts shareRows)
│   │   ├── Filters/, Leaderboard/, StatTile/, TrendChart/, Sparkline/
│   ├── pages/
│   │   ├── Overview/      # / — filters, stat tiles, trend chart, share chart, searchable leaderboard
│   │   ├── Product/       # /product/:id — artifacts, version adoption, releases, repos, traffic
│   │   ├── Releases/      # /releases — cadence per product + release feed
│   │   ├── Repos/         # /repos — health table per repo
│   │   ├── Traffic/       # /traffic — GitHub views/clones
│   │   ├── Docs/          # /docs — documentation site visits and top pages (Cloudflare)
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

## Data and state

The only data source is the JSON the Python collector writes under
`../data/` (shapes in `nebari_pulse/summary.py`, types in `src/lib/summary.ts`):

| File                 | Hook             | Page                                                       |
| -------------------- | ---------------- | ---------------------------------------------------------- |
| `summary.json`       | `useSummary()`   | Downloads: products with series grouped by source and type |
| `repos.json`         | `useRepos()`     | Releases, Repos, Traffic                                   |
| `products/<id>.json` | `useProduct(id)` | one product in full; `null` on 404                         |

Each is fetched once and never refetched. Everything on screen is derived
in `useMemo` from `src/lib/summary.ts` helpers, from the finest series the
page has (index groups or a product's artifacts), so the source and type
filters stay consistent. The product page also reads the index so its
window and "as of" match the Downloads page. Tests stub `fetch` with
`stubSummaryFetch(products)` from `src/test/fixtures.ts`, which derives all
three files from full product fixtures the way the collector does.

| State type                                      | Where it lives                             |
| ----------------------------------------------- | ------------------------------------------ |
| Filters (range, kind, type, source), search `q` | URL search params via `useDashboardParams` |
| Component-local (sort order, hover)             | `useState` inside the component            |
| summary.json                                    | TanStack Query (`useSummary`)              |

Every table with more than a handful of rows gets a `SearchBox` placed
directly above it (never in the page header), bound to `params.q`,
filtered with `matchesQuery` over the row's visible names and ids, and an
empty-state row that echoes the query. Section navigation links carry the
current query string so filters survive switching pages.

Repo-derived data (`product.repos`) is optional per product: a repo can
exist without a health snapshot (`health: null`), traffic (`traffic: []`)
or releases. Render dashes for unknown values, never zeros, and leave repos
without traffic out of traffic tables rather than showing them as 0.

Charts use Recharts with Nebari chart tokens (`var(--chart-N)`); each source
and artifact type has a fixed color in `SOURCE_COLOR` / `ARTIFACT_KIND_COLOR`
— never assign colors by rank.

---

## Theme / Dark Mode

Dark is the default (`seedDarkDefault` in `src/lib/theme.ts` plus the
pre-paint script in `index.html`). The header toggle uses `useTheme` from
`@/hooks/theme-provider` (the `@nebari/use-theme-preference` registry item).
The Nebari brand tokens are installed via `npx shadcn add @nebari/theme` into
`src/index.css` — re-run that command to update them. Don't hand-copy token
values into the stylesheet.

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
4. Add it to `NAV` in `src/components/Header/Header.tsx` with a `match`
   predicate (the desktop links and the small-screen hamburger both read
   it), and use `PageHeader` for the title row so pages look alike
5. Place controls by what they filter. Page-wide filters go in
   `PageHeader` as `<Filters show={[...]} />`, which always renders range,
   kind, type, source in that order. Controls for one table go in that
   table's `TableCard` (`controls`), selects first and `SearchBox` last.
   Don't hand-roll range tabs or kind selects on a page

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
| Put a component in a flat file                                            | Give it its own PascalCase directory with a test file and `index.ts`                                                               |
| Import from the component file directly                                   | Import from the folder (`@/components/UserCard`, not `@/components/UserCard/UserCard`)                                             |
