# AGENTS.md — pulse

Guidance for AI agents (Claude Code, Copilot, Cursor, …) working in this
repository. Read it before making changes. The dashboard under `site/` has
its own `site/AGENTS.md` with the frontend conventions; this file covers the
repo as a whole and the collector.

## What this is

Adoption and health metrics for the Nebari ecosystem. A Python collector
runs daily in GitHub Actions, fetches public counters from Quay, PyPI,
conda-forge and GitHub, and commits the results as CSV under `data/`. The
repo is the database: upstreams only keep rolling windows (Quay ~90 days,
PyPI ~180 days, GitHub traffic 14 days) or cumulative counters, so the
history exists only because we snapshot it. The dashboard reads three kinds
of JSON written by `pulse summarize`: `data/summary.json` (the index),
`data/repos.json` and `data/products/<id>.json`.

| Part | Where | Stack |
|---|---|---|
| Config | `sources.yaml` | what is tracked: products, packs, their artifacts per source, their GitHub repos |
| Collector | `nebari_pulse/` | Python 3.12, stdlib + pyyaml, `uv`, pytest, ruff |
| Data | `data/` | CSV per (source, artifact) + `summary.json`, `repos.json`, `products/*.json` + `untracked.json` |
| Dashboard | `site/` | Vite + React 19 + TypeScript, Nebari design system, Cloudflare Worker |
| CI | `.github/workflows/` | `collect.yml` (daily cron), `deploy.yml`, `preview-deploy.yml`, `ci.yml` |

## Commands

```sh
uv sync
uv run pulse check                       # validate sources.yaml
uv run pulse collect --dry-run -v        # fetch into a temp dir, leave data/ alone
uv run pulse collect --only github_repos # one source only
uv run pulse collect                     # update data/ (what the cron does)
uv run pulse summarize                   # rebuild summary.json, repos.json, products/ from data/
uv run pytest && uv run ruff check . && uv run ruff format --check .

cd site && npm install
npm run dev                              # http://localhost:5173, reads ../data/summary.json
npm run build && npm run test -- --run && npm run check
```

`-v` goes before the subcommand (`pulse -v collect`). Set
`GITHUB_TOKEN=$(gh auth token)` locally: GraphQL (repo health) refuses
anonymous calls, and REST is limited to 60 requests/hour without one.
Traffic (views/clones) additionally needs push access to each repo; set
`PULSE_GITHUB_TOKEN` to such a token and it takes precedence.

**After every change to the collector**, run pytest, ruff, and a `--dry-run`
collect. **After every change to the site**, run build, test, and check. CI
runs the same on PRs.

## Layout

```
sources.yaml                 products/packs: id, name, kind, artifacts per source, repos
nebari_pulse/
  cli.py                     `pulse` entry point: collect | summarize | check
  config.py                  loads/validates sources.yaml -> Config dataclasses
  http.py                    stdlib HTTP with retries; get_json, post_json, github_headers
  store.py                   CSV upsert; one file per (family, source, artifact)
  summary.py                 builds the dashboard's JSON (the contract): index, repos, products
  sources/
    quay.py                  daily pulls per repo, ~90d window; scans namespace for untracked repos
    pypi.py                  daily downloads (no mirrors) from pypistats, ~180d
    conda.py                 cumulative per-file totals from anaconda.org, snapshotted daily
    github_releases.py       cumulative per-asset download_count, snapshotted daily
    github_repos.py          repo health (GraphQL), release tags/dates (REST), traffic (REST)
data/
  downloads/<source>/<artifact>.csv
  repos/health|releases|traffic/<owner>__<name>.csv
  summary.json               index: products with totals + series per (source, kind)
  repos.json                 every product's repos: health, traffic, releases
  products/<id>.json         one product in full: artifacts with series + items, repos
  untracked.json             Quay repos in the namespace not in sources.yaml
tests/                       pytest; fixtures build tiny CSVs in tmp_path and call summary.build
site/                        see site/AGENTS.md
```

## Data model

| Family / source | Row | Kind |
|---|---|---|
| downloads/quay | `date,count` | daily |
| downloads/pypi | `date,count` | daily |
| downloads/conda | `date,version,file,cumulative` | cumulative snapshot |
| downloads/github_releases | `date,tag,asset,cumulative` | cumulative snapshot |
| repos/health | `date,stars,forks,subscribers,open_issues,open_prs,merged_prs_30d,issues_opened_30d,issues_closed_30d,pushed_at` | daily snapshot |
| repos/releases | `tag,published_at,prerelease` | one row per release tag |
| repos/traffic | `date,views,unique_views,clones,unique_clones` | daily |

Rules the collector relies on:

- **Upserts, never appends.** `store.upsert` keys rows (by date, or
  date+item) so re-running for the same day replaces rather than
  duplicates. Files are rewritten fully sorted so git diffs stay small.
- **Cumulative sources become daily deltas in `summary.py`.** The delta
  between consecutive snapshots is attributed to the later date; the first
  snapshot of an item contributes nothing. Counters never go down, but the
  code guards with `max(delta, 0)` anyway.
- **Today is never written for daily sources that are still filling**
  (PyPI, traffic). Snapshots of cumulative counters are dated today.
- **Blank means unknown, not zero.** A health column the API did not answer
  is stored as an empty cell and surfaces as `null` in summary.json; the
  dashboard shows a dash. Do not coerce to 0.
- **Partial failure is a warning, total failure is an error.** A source
  that collects nothing exits 1 so the Actions run goes red; a few failed
  artifacts are reported and the rest kept.
- **Only public data.** Quay is called without credentials, GraphQL/REST use
  whichever GitHub token is present. Nothing here can see private repos.

## sources.yaml

Adding a product or pack, or an artifact to one, is the formal moment of
admitting it to the dashboard, and is done by PR. Each product has an `id`
(stable, used in URLs), `name`, `kind` (`product` | `pack`), artifact lists
per source (`quay`, `pypi`, `conda`, `github_releases`) and `repos`
(GitHub `owner/name`). An artifact or repo may belong to one product only;
`pulse check` enforces that.

- Quay images and OCI Helm charts both live under `quay`; charts are told
  apart by `/charts/` in the path and are kept separate in the dashboard
  because GitOps controllers poll them continuously.
- The collector lists every public repo in the Quay namespace it does not
  know about in `data/untracked.json`. Add it to a product or to
  `quay_ignore`.
- Before assigning an artifact, confirm which product actually ships it
  (read the publishing workflow in the source repo), not just its name:
  `nebari-keycloak-theme` is published by a repo named after Nebari but is a
  NIC component.
- "Nebari Classic" (`nebari-classic`) is the original platform
  (`nebari-dev/nebari`). "Nebari" alone is ambiguous now that it also
  means NIC, the operator and the packs.

## Adding a source

1. Create `nebari_pulse/sources/<name>.py` exposing
   `collect(cfg, data_dir, today) -> CollectResult`. Write through
   `store.upsert` with explicit `COLUMNS` and `KEY`. Log one line per
   artifact at INFO; put per-artifact failures in `result.errors`.
2. Register it in `cli.COLLECTORS` and, if it is a download source, in
   `config.SOURCES` and `summary.DAILY_SOURCES` / `CUMULATIVE_SOURCES`.
3. Extend `summary.build` and the docstring at the top of `summary.py`,
   which is the contract: the TypeScript types in `site/src/lib/summary.ts`
   must match it exactly.
4. Add a pytest that builds CSVs in `tmp_path` and asserts on
   `summary.build` output. Update the README data-model table.

## Dashboard contract

`summary.write_all` splits one full build into the files a page fetches,
so each page loads only what it shows:

| File | Loaded by | Carries |
|---|---|---|
| `summary.json` | Downloads page (`useSummary`) | every product: totals + series grouped by (source, artifact kind), with `since` per group |
| `repos.json` | Releases, Repos, Traffic (`useRepos`) | every product's repos: latest health, health series, traffic, releases |
| `products/<id>.json` | product page (`useProduct`) | one product in full: each artifact's series and latest items (with per-item totals, for version adoption), plus repos |

The index is ~15% of the full data, and grows per group rather than per
artifact. Files are compact JSON. The full shapes are in the docstring at
the top of `summary.py`; the TypeScript types in `site/src/lib/summary.ts`
mirror them. Keep the contract additive: adding fields is fine, renaming
or removing breaks deployed dashboards until the next data commit, since
the site is deployed separately from the data. Helpers that filter or sum
series (`artifactsOf`, `compareArtifacts`, `headlineArtifacts`) take
anything `Countable` (source, kind, series), so they work on both index
groups and full artifacts.

## Workflows and secrets

- `collect.yml` runs daily at 06:20 UTC and on pushes that touch the
  collector, commits `data/` as `pulse-bot`, then dispatches `deploy.yml`
  explicitly (pushes made with the Actions token do not trigger workflows).
- Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` for deploys;
  `PULSE_GITHUB_TOKEN` (optional) for traffic. Without it, traffic is
  skipped with a note and the Traffic page explains why.

## Conventions

- Python: ruff (`E,F,I,UP,B`, line length 100), type hints, dataclasses
  for config, no third-party HTTP client. Keep sources independent of each
  other except for shared helpers in `http.py` and `store.py`.
- Commits: conventional prefixes (`feat:`, `fix:`, `ci:`, `data:`). Data
  commits are made by the bot; do not hand-edit CSVs except to delete a
  wrong file.
- Do not commit the output of a local `pulse collect` unless the change is
  about new data (for example seeding a newly added artifact); the daily
  job will collect it anyway.
