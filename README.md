# pulse

Adoption and health metrics for the Nebari ecosystem: downloads, releases,
repos, community.

Tracks **downloads** of Nebari Classic, the operator, NIC, Nebi and every
software pack, across Quay (images and Helm charts), PyPI, conda-forge and
GitHub Releases, plus **release cadence**, **repository health** (stars,
open issues and PRs, merge throughput) and **GitHub traffic** (views and
clones) for each product's repos. A GitHub Action runs the collector daily
and commits the results under `data/`, so the repo itself is the database:
every upstream is either a rolling window (Quay: ~90 days, PyPI: ~180 days,
GitHub traffic: 14 days) or a cumulative counter (GitHub, conda), and the
history only exists because we snapshot it.

## Layout

```
sources.yaml            what is tracked - products, packs, their artifacts per source, their repos
nebari_pulse/           collector (Python 3.12, stdlib + pyyaml)
  sources/<source>.py   one fetcher per upstream
  summary.py            builds data/summary.json, the dashboard's contract
data/
  downloads/<source>/<artifact>.csv   raw rows, one file per artifact
  repos/health/<repo>.csv             daily snapshot: stars, forks, open issues/PRs, throughput
  repos/releases/<repo>.csv           one row per release tag with its date
  repos/traffic/<repo>.csv            daily views and clones (needs PULSE_GITHUB_TOKEN)
  repos/stars/<repo>.csv              cumulative stars per date, back to the first star
  repos/contributors/<repo>.csv       commits per author per day, bots excluded
  summary.json                        index: products with totals + series per source and type
  repos.json                          every product's repos: health, traffic, releases
  products/<id>.json                  one product in full, loaded by its page
  untracked.json                      Quay repos not yet in sources.yaml
AGENTS.md               guidance for AI agents; site/AGENTS.md covers the dashboard
site/                   dashboard (Vite + React + Nebari design system)
.github/workflows/
  collect.yml           daily cron -> pulse collect -> commit data/ -> dispatch deploy
  deploy.yml            build site/ and deploy the nebari-pulse Worker (static assets)
  preview-deploy.yml    Workers Preview per PR touching site/; deleted on close
  ci.yml                collector lint/tests/dry-run + site lint/tests/build on PRs
```

## Data model

| Source | Rows | Granularity |
|---|---|---|
| `quay` | `date,count` | daily pulls, from the Quay API (`includeStats=true`) |
| `pypi` | `date,count` | daily downloads excluding mirrors, from pypistats.org |
| `pypi_breakdown` | `date,dimension,category,count` | daily downloads by Python minor version (`python_minor`) and OS (`system`), from pypistats.org |
| `conda` | `date,version,file,cumulative` | daily snapshot of per-file totals from api.anaconda.org |
| `github_releases` | `date,tag,asset,cumulative` | daily snapshot of per-asset `download_count` |

| `repos/health` | `date,stars,forks,subscribers,open_issues,open_prs,merged_prs_30d,issues_opened_30d,issues_closed_30d,pushed_at` | daily snapshot via GraphQL |
| `repos/releases` | `tag,published_at,prerelease` | one row per release tag |
| `repos/traffic` | `date,views,unique_views,clones,unique_clones` | daily, 14-day window from GitHub |
| `repos/stars` | `date,stars` | cumulative; backfilled once from each star's timestamp, then daily |
| `repos/contributors` | `date,author,commits` | commits per author per day on the default branch, bots excluded; backfilled once, then the latest month refreshed daily |

For cumulative sources the daily series in `summary.json` is the delta
between consecutive snapshots, kept per version/tag as well so the
dashboard can show which versions people install now. Attestation and
checksum assets are excluded (`github_releases_ignore_suffixes` in
`sources.yaml`).

Each product also lists its GitHub `repos`. Health and releases need any
GitHub token (GraphQL refuses anonymous calls). Traffic is only shared with
accounts that can push to the repo, which the Actions token cannot do for
other repos: set the `PULSE_GITHUB_TOKEN` repository secret to a
fine-grained PAT with *Administration: read* on the tracked repos (or a
classic PAT with `repo`). Without it, traffic is skipped with a note and
the Traffic page says so.

Not available anywhere: **GHCR pull counts**. GitHub exposes them only in
the package UI. Images published solely to `ghcr.io/nebari-dev` are invisible
here; publish them to Quay as well to count them.

## Running locally

```sh
uv sync
uv run pulse check                    # validate sources.yaml
uv run pulse collect --dry-run -v     # fetch into a temp dir
uv run pulse collect                  # update data/
uv run pulse summarize                # rebuild the dashboard JSON only
uv run pytest && uv run ruff check .
```

`GITHUB_TOKEN` is optional locally (`export GITHUB_TOKEN=$(gh auth token)`)
but avoids the 60 req/h anonymous limit and is required for repo health.
`PULSE_GITHUB_TOKEN`, if set, is used instead and also unlocks traffic.

## Dashboard

`site/` is a static Vite + React app that fetches the collector's JSON at
runtime (served from `../data` in dev, copied into `dist/data` on build):
the index for the Downloads page, `repos.json` for the repo pages, and one
file per product for its page.
Filters and the table search live in the URL, so any view is shareable.

| Page | What it shows |
|---|---|
| `/` Downloads | totals, what changed this week, trend by artifact type or source, weekly share by product, searchable leaderboard |
| `/product/:id` | one product: artifacts, version adoption, PyPI Python/OS mix, releases, repo health, traffic |
| `/releases` | cadence per product (latest, count in window, median gap) and a release feed |
| `/repos` | stars, stars gained, open issues/PRs, merged PRs, authors per repo; new and active contributors, and open issues/PRs over time |
| `/traffic` | GitHub views and clones, 14-day totals and all collected history |

```sh
cd site
npm install
npm run dev            # http://localhost:5173, reads ../data/summary.json
npm run build && npm run test -- --run && npm run check
```

The site deploys as a static-assets-only Cloudflare Worker named
`nebari-pulse` (`site/wrangler.jsonc`; `cd site && npm run deploy` does it
from a laptop). CI uses `wrangler-action` with the `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` repo secrets. Each daily data commit redeploys the
site, and every PR that touches `site/` gets a Workers Preview URL commented
on it.

## Adding a product or pack

Add an entry under `downloads.products` in `sources.yaml` and open a PR. The
collector lists every public repo in `quay.io/nebari` it does not know about
in `data/untracked.json` and in the run log, so new images surface on their
own; add them to a product or to `quay_ignore`.

## Roadmap

- Docs traffic (docs.nebari.dev, classic.nebari.dev) from the analytics
  pack; PyPI downloads by Python version and OS; issue time-to-first-response.
