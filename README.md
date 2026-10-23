# Nebari Pulse

Adoption and health metrics for the Nebari ecosystem, as a dashboard at
the `nebari-pulse` Cloudflare Worker and as plain CSV in this repo.

Pulse tracks every product and software pack in `sources.yaml`: Nebari
Classic, Nebari Infrastructure Core (NIC), the operator, Nebi, Landing, and
the packs. For each it collects **downloads** (Quay, PyPI, conda-forge,
GitHub Releases), **repository health**, **release cadence**, **star
history**, **contributors** and **GitHub traffic** from the product's
repos, plus **documentation traffic** for the docs sites.

A GitHub Action runs the collector every day at 06:20 UTC and commits the
results under `data/`, so the repo is the database. That matters because
almost every upstream is either a rolling window (Quay about 90 days, PyPI
about 180, GitHub traffic 14, Cloudflare analytics about 30) or a bare
cumulative counter (conda, GitHub Releases). History exists only because
Pulse snapshots it.

## Dashboard

| Page | What it shows |
|---|---|
| `/` Downloads | Headline downloads with change vs. the previous period, daily or weekly trend stacked by artifact type or by source, weekly share of downloads by product, and a sortable, searchable leaderboard. |
| `/product/:id` | One product: every artifact with its own counts, version adoption over the last 30 days and version share over time, PyPI downloads by Python version and OS, release cadence, repository health, stars over time, open issues and PRs, recent releases, GitHub traffic. |
| `/releases` | Release cadence per product: latest release and age, releases in the period, median gap over the last year, releases per week, and a feed with prereleases marked. |
| `/repos` | Repository health: stars and stars gained, open issues and PRs, PRs merged in 30 days, authors in 30 days, last push, with new and active contributors over time and open issues and PRs over time. |
| `/traffic` | GitHub traffic: unique visitors and cloners for the last 14 days with change vs. the 14 before, totals, and daily history for all tracked repos. |
| `/docs` | Documentation traffic: visits and page views per docs site over time, and each site's top pages for the last 7 days. |

Filters (range, product or pack, artifact type, source) and the table
search live in the URL, so any view can be shared as a link.

## Data sources and metrics

Each source below lists the upstream, what one row means, how far back the
upstream keeps data, and the caveats that affect how to read the numbers.
Files live under `data/`; one CSV per source and artifact (or repo, or
site). Rows are upserted by date, so rerunning a day replaces rather than
duplicates.

### Downloads

**Quay** (`downloads/quay/<repo>.csv`, `date,count`)
Daily pulls of each image and OCI Helm chart under `quay.io/nebari`, from
the Quay repository API with `includeStats=true`. Quay returns about 90
days. Charts are told apart from images by `/charts/` in the path and are
kept separate everywhere: GitOps controllers poll charts continuously, so
chart pulls say nothing about adoption and are left out of headline numbers
unless the chart type is selected explicitly. The collector also lists any
public repo in the namespace that `sources.yaml` does not mention, in
`data/untracked.json` and in the run log.

**PyPI** (`downloads/pypi/<package>.csv`, `date,count`)
Daily downloads excluding mirrors, from pypistats.org, which keeps about
180 days. A second file per package
(`downloads/pypi_breakdown/<package>.csv`,
`date,dimension,category,count`) holds the same days split by Python minor
version (`python_minor`) and by operating system (`system`). pypistats
reports `null` when the installer did not say; the dashboard shows that as
"unknown".

**conda-forge** (`downloads/conda/<channel>__<package>.csv`,
`date,version,file,cumulative`)
A daily snapshot of the all-time download counter of every file of the
package, from api.anaconda.org. The daily series is the day-over-day
difference of the counters, attributed to the later day; the first snapshot
of a file contributes nothing. Because the counter is per file and per
version, Pulse also derives which versions people install now.

**GitHub Releases** (`downloads/github_releases/<owner>__<repo>.csv`,
`date,tag,asset,cumulative`)
A daily snapshot of `download_count` for every release asset, for products
shipped as binaries or installed through a Homebrew tap. Same delta
treatment as conda. Attestation, signature and checksum assets are excluded
(`github_releases_ignore_suffixes` in `sources.yaml`) because nobody
downloads them by choice. Asset filenames also give the platform split
shown on product pages.

### Repositories

Every product lists its GitHub repos under `repos` in `sources.yaml`. Files
are named `repos/<family>/<owner>__<repo>.csv`.

**Health** (`repos/health`, `date,stars,forks,subscribers,open_issues,open_prs,merged_prs_30d,issues_opened_30d,issues_closed_30d,pushed_at`)
One snapshot per day from one GraphQL query for all repos: stars, forks,
watchers, open issues, open PRs, PRs merged and issues opened and closed in
the trailing 30 days, and the last push date. A blank cell means GitHub did
not answer, and the dashboard shows a dash, never a zero. Repos with no
push in 90 days are marked as quiet. The open issue and PR series feed the
"over time" charts, which only reach back to the first snapshot.

**Releases** (`repos/releases`, `tag,published_at,prerelease`)
Every release tag with its publish date, upserted by tag. Drafts are
skipped. Cadence on the Releases page counts stable releases only; the
median gap is measured over the last 365 days so a project that was busy
two years ago and is dormant now does not look healthy.

**Stars** (`repos/stars`, `date,stars`)
Cumulative stars per date, back to the first star. Backfilled once per
repo from the stargazers API, which gives a timestamp per star, then kept
current from the daily health snapshot so unstars show up too. This is
what makes "stars gained in 30 days" correct from day one instead of
waiting for snapshots to accumulate.

**Contributors** (`repos/contributors`, `date,author,commits`)
Commits per author per day on the default branch, backfilled once from the
commits list and refreshed from the start of the latest month on every
run. Authors are GitHub logins, or `email:<address>` for commits without a
GitHub user. Bots are excluded (`type: Bot`, `*[bot]`, noreply addresses
without a user). From these Pulse derives unique authors in the last 30
days and per month, per repo and across the ecosystem with a person counted
once, and first-time contributors per quarter (the quarter of a person's
first commit to any tracked repo).

**Traffic** (`repos/traffic`, `date,views,unique_views,clones,unique_clones`)
Daily page views and git clones with their unique counts, from the GitHub
traffic API, which keeps 14 days. Today's partial day is skipped. Needs a
token with push access (see Credentials). Total clones include CI
checkouts and mirrors, so the dashboard leads with unique visitors and
unique cloners and shows totals second.

### Documentation

Sites are listed under `docs` in `sources.yaml` with the hostnames that
serve them: the Nebari docs (`nebari.dev`, `www.nebari.dev`), the Classic
docs (`classic.nebari.dev`) and the Software Packs docs
(`packs.nebari.dev`). All are on the `nebari.dev` Cloudflare zone.

**Traffic** (`docs/traffic/<site>.csv`, `date,host,pageviews,visits`)
HTML responses with status 200 to real browsers (`requestSource:
eyeball`), per host per day, from Cloudflare zone analytics. Counted at
the edge, so the cookie-consent banner on the docs does not hide visitors
the way Google Analytics does. A visit is a page view not preceded by
another from the same visitor within 30 minutes, as Cloudflare defines it.
Fetched for the trailing 30 days on every run, which is about what the
zone retains.

**Top pages** (`docs/pages/<site>.csv`, `date,path,pageviews`)
A daily snapshot of the 200 most viewed paths over the last 7 days.

### Derived numbers

- **Windows and change.** Totals are shown for the selected range (30
  days, 90 days, 1 year, all) and compared with the period of the same
  length immediately before. The change is withheld (shown as a dash) when
  the previous period is not fully covered by collected data, or when
  artifacts covering less than 90% of the current total have a previous
  period, so a source that started collecting mid-way never reads as a
  surge.
- **Headline exclusion.** With no artifact type selected, Helm chart pulls
  are excluded from the headline tiles, the leaderboard and the share
  chart. The trend chart still draws them as their own band.
- **Anomalies.** A day more than three standard deviations above the
  trailing 28-day mean, at least three times that mean and at least 50 in
  absolute terms, is marked on the daily charts with a note. Values are
  not changed; the marker is a reading aid for CI loops and mirrors.
- **Version adoption and share.** From the per-version deltas of conda and
  GitHub Releases: downloads per version in the last 30 days, and weekly
  version share over time on the product page. PyPI and Quay do not report
  per-version counts.
- **Share of the ecosystem.** Weekly share of headline downloads by
  product, the five largest in the period as bands and the rest as
  "Other".

### Not available anywhere

- **GHCR pull counts.** GitHub exposes them only in the package UI. Images
  published solely to `ghcr.io/nebari-dev` are invisible; publish to Quay
  as well to count them.
- **Per-version PyPI or Quay downloads**, and anything about who the
  downloaders are.
- **Quay or PyPI history from before Pulse started** beyond each service's
  own window.

## Credentials

All sources read public data. Three secrets in this repository extend what
the daily run can see:

| Secret | Used for | Without it |
|---|---|---|
| `PULSE_GITHUB_TOKEN` | Repo traffic. A fine-grained PAT with resource owner `nebari-dev`, access to the tracked repos, and *Administration: Read-only*; or a classic PAT with `repo`. The org must approve fine-grained tokens if it requires approval. Health, releases, stars and contributors work with the default Actions token. | Traffic is skipped with a note and the Traffic page says so. |
| `CLOUDFLARE_ANALYTICS_TOKEN` | Docs traffic. An API token with *Zone: Read* and *Analytics: Read* on the `nebari.dev` zone. `CLOUDFLARE_API_TOKEN` is used as a fallback if it carries those scopes. | Docs traffic is skipped with a note and the Docs page says so. |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Deploying the dashboard Worker. | No deploys. |

A token can never see more than its owner; traffic for a repo where the
token's owner lacks push access stays denied, and the run log names the
repo and GitHub's answer.

## Layout

```
sources.yaml            what is tracked: products and packs with their artifacts per
                        source and their GitHub repos; docs sites with their hosts
nebari_pulse/           collector (Python 3.12, stdlib + pyyaml)
  cli.py                `pulse collect | summarize | check`
  config.py             loads and validates sources.yaml
  sources/<source>.py   one fetcher per upstream
  summary.py            builds the dashboard JSON (the contract; shapes in its docstring)
data/
  downloads/<source>/<artifact>.csv
  repos/health|releases|stars|contributors|traffic/<owner>__<repo>.csv
  docs/traffic|pages/<site>.csv
  summary.json          index: every product with totals and series per source and type
  repos.json            every product's repos; ecosystem contributors
  docs.json             docs sites: daily series and top pages
  products/<id>.json    one product in full, loaded by its page
  untracked.json        Quay repos in the namespace not in sources.yaml
site/                   dashboard (Vite + React + Nebari design system); see site/AGENTS.md
AGENTS.md               guidance for AI agents working on the repo and collector
.github/workflows/
  collect.yml           daily cron -> pulse collect -> commit data/ -> dispatch deploy
  deploy.yml            build site/ and deploy the nebari-pulse Worker (static assets)
  preview-deploy.yml    Workers Preview per PR touching site/; deleted on close
  ci.yml                collector lint, tests and dry run; site lint, tests and build
```

## Running locally

```sh
uv sync
uv run pulse check                       # validate sources.yaml
uv run pulse -v collect --dry-run        # fetch into a temp dir, leave data/ alone
uv run pulse -v collect --only github_repos
uv run pulse collect                     # update data/ (what the cron does)
uv run pulse summarize                   # rebuild the dashboard JSON from data/
uv run pytest && uv run ruff check .
```

Set `GITHUB_TOKEN=$(gh auth token)`: GraphQL (repo health) refuses
anonymous calls and REST allows 60 requests an hour without one.
`PULSE_GITHUB_TOKEN` and `CLOUDFLARE_ANALYTICS_TOKEN` work locally the same
way they do in CI.

```sh
cd site
npm install
npm run dev            # http://localhost:5173, reads ../data/*.json
npm run build && npm run test -- --run && npm run check && npx biome ci .
```

The site deploys as a static-assets-only Cloudflare Worker named
`nebari-pulse` (`site/wrangler.jsonc`; `cd site && npm run deploy` does it
from a laptop). Each daily data commit redeploys the site, and every PR
that touches `site/` gets a Workers Preview URL commented on it.

## Adding to what is tracked

- **A product or pack:** add an entry under `downloads.products` in
  `sources.yaml` with its `id` (stable; used in URLs), `name`, `kind`,
  artifact lists per source and `repos`, and open a PR. An artifact or repo
  may belong to one product only; `pulse check` enforces it. Before
  assigning an artifact, confirm which product publishes it by reading the
  source repo's release workflow, not just its name.
- **A Quay image or chart:** new repos in the namespace surface in
  `data/untracked.json` on their own; add each to a product or to
  `quay_ignore`.
- **A docs site:** add it under `docs.sites` with its hosts. All hosts must
  be on the configured Cloudflare zone.
- **A source:** see the "Adding a source" section of `AGENTS.md`.

## Roadmap

- Issue time to first response; a weekly digest; CSV export.
