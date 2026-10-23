# pulse

Adoption and health metrics for the Nebari ecosystem: downloads, releases,
repos, community.

Phase 1 tracks **downloads** of Nebari, the operator, NIC, Nebi and every
software pack, across Quay (images and Helm charts), PyPI, conda-forge and
GitHub Releases. A GitHub Action runs the collector daily and commits the
results under `data/`, so the repo itself is the database: every source
upstream is either a rolling window (Quay: ~90 days, PyPI: ~180 days) or a
cumulative counter (GitHub, conda), and the history only exists because we
snapshot it.

## Layout

```
sources.yaml            what is tracked - products, packs, their artifacts per source
nebari_pulse/           collector (Python 3.12, stdlib + pyyaml)
  sources/<source>.py   one fetcher per upstream
  summary.py            builds data/summary.json, the dashboard's contract
data/
  downloads/<source>/<artifact>.csv   raw rows, one file per artifact
  summary.json                        per-product daily series + 7/30/90d totals
  untracked.json                      Quay repos not yet in sources.yaml
site/                   dashboard (Vite + React + Nebari design system)
.github/workflows/
  collect.yml           daily cron -> pulse collect -> commit data/ -> dispatch deploy
  deploy.yml            build site/ and deploy to Cloudflare Pages (project: nebari-pulse)
  preview-deploy.yml    per-PR preview deployment for site/ changes
  ci.yml                collector lint/tests/dry-run + site lint/tests/build on PRs
```

## Data model

| Source | Rows | Granularity |
|---|---|---|
| `quay` | `date,count` | daily pulls, from the Quay API (`includeStats=true`) |
| `pypi` | `date,count` | daily downloads excluding mirrors, from pypistats.org |
| `conda` | `date,version,file,cumulative` | daily snapshot of per-file totals from api.anaconda.org |
| `github_releases` | `date,tag,asset,cumulative` | daily snapshot of per-asset `download_count` |

For cumulative sources the daily series in `summary.json` is the delta
between consecutive snapshots. Attestation and checksum assets are excluded
(`github_releases_ignore_suffixes` in `sources.yaml`).

Not available anywhere: **GHCR pull counts**. GitHub exposes them only in
the package UI. Images published solely to `ghcr.io/nebari-dev` are invisible
here; publish them to Quay as well to count them.

## Running locally

```sh
uv sync
uv run pulse check                    # validate sources.yaml
uv run pulse collect --dry-run -v     # fetch into a temp dir
uv run pulse collect                  # update data/
uv run pulse summarize                # rebuild summary.json only
uv run pytest && uv run ruff check .
```

`GITHUB_TOKEN` is optional locally (`export GITHUB_TOKEN=$(gh auth token)`)
but avoids the 60 req/h anonymous limit.

## Dashboard

`site/` is a static Vite + React app that fetches `data/summary.json` at
runtime (served from `../data` in dev, copied into `dist/data` on build).
Filters live in the URL, so any view is shareable.

```sh
cd site
npm install
npm run dev            # http://localhost:5173, reads ../data/summary.json
npm run build && npm run test -- --run && npm run check
```

Deploys go to Cloudflare Pages via `wrangler-action`; the repo needs the
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets and a Pages
project named `nebari-pulse` (`pulse.pages.dev` was already taken). Each daily data commit redeploys the site.

## Adding a product or pack

Add an entry under `downloads.products` in `sources.yaml` and open a PR. The
collector lists every public repo in `quay.io/nebari` it does not know about
in `data/untracked.json` and in the run log, so new images surface on their
own; add them to a product or to `quay_ignore`.

## Roadmap

- Phase 3: GitHub traffic (clones/views), repo health (stars, issues, PR
  throughput, release cadence), docs traffic from the analytics pack.
