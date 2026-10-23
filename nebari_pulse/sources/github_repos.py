"""GitHub repository health, releases and traffic for every product's repos.

Three families of CSV under data/repos/:

    health/<repo>.csv   one snapshot row per day: stars, forks, subscribers,
                        open issues, open PRs, 30-day throughput, last push.
                        Fetched in one GraphQL query for all repos.
    releases/<repo>.csv one row per release tag with its publish date, so
                        release cadence can be computed. Upserted by tag.
    traffic/<repo>.csv  daily views and clones (unique too). GitHub keeps
                        only 14 days, so the history exists because we
                        snapshot it. Needs push access to the repo
                        (PULSE_GITHUB_TOKEN); otherwise skipped with a note.
    stars/<repo>.csv    cumulative stars per date. Backfilled once from the
                        stargazers API (which gives a timestamp per star),
                        then kept current from the daily health snapshot so
                        unstars are reflected too.
    contributors/<repo>.csv
                        commits per (date, author) on the default branch,
                        bots excluded. Backfilled once from the commits
                        list, then refreshed from the start of the latest
                        month seen. Authors are GitHub logins, or
                        "email:<address>" for commits without a GitHub user.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from pathlib import Path

from .. import store
from ..config import DownloadsConfig
from ..http import HttpError, get_json, github_headers, github_token, post_json
from . import CollectResult
from .github_releases import API, _all_releases

log = logging.getLogger(__name__)

GRAPHQL = "https://api.github.com/graphql"
HEALTH_COLUMNS = [
    "date",
    "stars",
    "forks",
    "subscribers",
    "open_issues",
    "open_prs",
    "merged_prs_30d",
    "issues_opened_30d",
    "issues_closed_30d",
    "pushed_at",
]
RELEASE_COLUMNS = ["tag", "published_at", "prerelease"]
TRAFFIC_COLUMNS = ["date", "views", "unique_views", "clones", "unique_clones"]
STARS_COLUMNS = ["date", "stars"]
CONTRIBUTOR_COLUMNS = ["date", "author", "commits"]
STAR_HEADERS = {"Accept": "application/vnd.github.star+json"}

# GraphQL aliases must be identifiers; one per repo, position-based.
REPO_FRAGMENT = """
%(alias)s: repository(owner: "%(owner)s", name: "%(name)s") {
  stargazerCount forkCount pushedAt isArchived
  watchers { totalCount }
  issues(states: OPEN) { totalCount }
  pullRequests(states: OPEN) { totalCount }
}
%(alias)s_merged: search(type: ISSUE,
  query: "repo:%(repo)s is:pr is:merged merged:>=%(since)s") { issueCount }
%(alias)s_opened: search(type: ISSUE,
  query: "repo:%(repo)s is:issue created:>=%(since)s") { issueCount }
%(alias)s_closed: search(type: ISSUE,
  query: "repo:%(repo)s is:issue is:closed closed:>=%(since)s") { issueCount }
"""
BATCH = 15  # repos per GraphQL query; each costs 4 fields, keep well under limits


def collect(cfg: DownloadsConfig, data_dir: Path, today: date) -> CollectResult:
    result = CollectResult(source="github_repos")
    pairs = cfg.repos()
    if not pairs:
        return result
    repos = [repo for _, repo in pairs]

    stars_today = _collect_health(repos, data_dir, today, result)
    _collect_releases(repos, data_dir, result)
    _collect_traffic(repos, data_dir, today, result)
    _collect_stars(repos, data_dir, today, stars_today, result)
    _collect_contributors(repos, data_dir, result)
    result.artifacts = len(repos)
    return result


# ---- health -----------------------------------------------------------------


def _collect_health(
    repos: list[str], data_dir: Path, today: date, result: CollectResult
) -> dict[str, int]:
    """Snapshot every repo; returns today's star count per repo for the stars file."""
    stars: dict[str, int] = {}
    if not github_token():
        result.errors.append("health: GITHUB_TOKEN not set; GraphQL needs a token")
        return stars
    since = (today - timedelta(days=30)).isoformat()
    for start in range(0, len(repos), BATCH):
        batch = repos[start : start + BATCH]
        query = "query {" + "".join(_fragment(i, repo, since) for i, repo in enumerate(batch)) + "}"
        try:
            payload = post_json(GRAPHQL, {"query": query}, headers=github_headers())
        except HttpError as e:
            result.errors.append(f"health batch {start // BATCH}: {e}")
            continue
        data = payload.get("data") or {}
        for err in payload.get("errors") or []:
            log.warning("graphql: %s", err.get("message"))
        for i, repo in enumerate(batch):
            node = data.get(f"r{i}")
            if not node:
                result.errors.append(f"health {repo}: not found or no access")
                continue
            row = {
                "date": today.isoformat(),
                "stars": node["stargazerCount"],
                "forks": node["forkCount"],
                "subscribers": node["watchers"]["totalCount"],
                "open_issues": node["issues"]["totalCount"],
                "open_prs": node["pullRequests"]["totalCount"],
                "merged_prs_30d": (data.get(f"r{i}_merged") or {}).get("issueCount", ""),
                "issues_opened_30d": (data.get(f"r{i}_opened") or {}).get("issueCount", ""),
                "issues_closed_30d": (data.get(f"r{i}_closed") or {}).get("issueCount", ""),
                "pushed_at": (node.get("pushedAt") or "")[:10],
            }
            path = store.path_for(data_dir, "repos", "health", repo)
            result.rows_changed += store.upsert(path, HEALTH_COLUMNS, ["date"], [row])
            stars[repo] = int(node["stargazerCount"])
            log.info("health %s: %s stars, %s open issues", repo, row["stars"], row["open_issues"])
    return stars


def _fragment(i: int, repo: str, since: str) -> str:
    owner, name = repo.split("/", 1)
    return REPO_FRAGMENT % {
        "alias": f"r{i}",
        "owner": owner,
        "name": name,
        "repo": repo,
        "since": since,
    }


# ---- releases ---------------------------------------------------------------


def _collect_releases(repos: list[str], data_dir: Path, result: CollectResult) -> None:
    for repo in repos:
        try:
            releases = _all_releases(repo)
        except HttpError as e:
            result.errors.append(f"releases {repo}: {e}")
            continue
        rows = [
            {
                "tag": rel["tag_name"],
                "published_at": (rel.get("published_at") or rel.get("created_at") or "")[:10],
                "prerelease": "true" if rel.get("prerelease") else "false",
            }
            for rel in releases
            if not rel.get("draft")
        ]
        path = store.path_for(data_dir, "repos", "releases", repo)
        result.rows_changed += store.upsert(path, RELEASE_COLUMNS, ["tag"], rows)
        log.info("releases %s: %d", repo, len(rows))


# ---- traffic ----------------------------------------------------------------


def _collect_traffic(repos: list[str], data_dir: Path, today: date, result: CollectResult) -> None:
    denied: list[str] = []
    for repo in repos:
        try:
            views = get_json(f"{API}/repos/{repo}/traffic/views", headers=github_headers())
            clones = get_json(f"{API}/repos/{repo}/traffic/clones", headers=github_headers())
        except HttpError as e:
            if e.status in (401, 403, 404):
                denied.append(repo)
            else:
                result.errors.append(f"traffic {repo}: {e}")
            continue
        by_date: dict[str, dict[str, int]] = {}
        for v in views.get("views", []):
            d = v["timestamp"][:10]
            by_date.setdefault(d, {})
            by_date[d].update(views=v["count"], unique_views=v["uniques"])
        for c in clones.get("clones", []):
            d = c["timestamp"][:10]
            by_date.setdefault(d, {})
            by_date[d].update(clones=c["count"], unique_clones=c["uniques"])
        # Today's bucket is still filling; keep only complete days.
        rows = [
            {"date": d, "views": 0, "unique_views": 0, "clones": 0, "unique_clones": 0, **v}
            for d, v in sorted(by_date.items())
            if d < today.isoformat()
        ]
        path = store.path_for(data_dir, "repos", "traffic", repo)
        result.rows_changed += store.upsert(path, TRAFFIC_COLUMNS, ["date"], rows)
        log.info("traffic %s: %d days", repo, len(rows))
    if denied:
        result.notes["traffic_denied"] = denied
        log.warning(
            "traffic: no push access to %d repo(s) (set PULSE_GITHUB_TOKEN): %s",
            len(denied),
            ", ".join(denied),
        )


# ---- stars -------------------------------------------------------------------


def _collect_stars(
    repos: list[str],
    data_dir: Path,
    today: date,
    stars_today: dict[str, int],
    result: CollectResult,
) -> None:
    for repo in repos:
        path = store.path_for(data_dir, "repos", "stars", repo)
        rows: list[store.Row] = []
        if not path.exists():
            try:
                rows = _backfill_stars(repo)
            except HttpError as e:
                result.errors.append(f"stars {repo}: {e}")
                continue
            log.info("stars %s: backfilled %d dates", repo, len(rows))
        if repo in stars_today:
            rows.append({"date": today.isoformat(), "stars": stars_today[repo]})
        if rows:
            result.rows_changed += store.upsert(path, STARS_COLUMNS, ["date"], rows)


def _backfill_stars(repo: str) -> list[store.Row]:
    """Cumulative stars per date from every star's `starred_at`. Unstars are
    invisible here, so the last value may exceed today's count; the daily
    snapshot row written afterwards corrects the present."""
    per_day: dict[str, int] = {}
    page = 1
    while True:
        batch = get_json(
            f"{API}/repos/{repo}/stargazers?per_page=100&page={page}",
            headers={**github_headers(), **STAR_HEADERS},
        )
        for star in batch:
            d = (star.get("starred_at") or "")[:10]
            if d:
                per_day[d] = per_day.get(d, 0) + 1
        if len(batch) < 100:
            break
        page += 1
    total = 0
    rows = []
    for d in sorted(per_day):
        total += per_day[d]
        rows.append({"date": d, "stars": total})
    return rows


# ---- contributors ------------------------------------------------------------


def _collect_contributors(repos: list[str], data_dir: Path, result: CollectResult) -> None:
    for repo in repos:
        path = store.path_for(data_dir, "repos", "contributors", repo)
        existing = store.read(path)
        since = None
        if existing:
            latest = max(r["date"] for r in existing)
            since = f"{latest[:7]}-01T00:00:00Z"  # refetch the latest month
        try:
            rows = _commits_by_author(repo, since)
        except HttpError as e:
            result.errors.append(f"contributors {repo}: {e}")
            continue
        if rows:
            result.rows_changed += store.upsert(path, CONTRIBUTOR_COLUMNS, ["date", "author"], rows)
        log.info(
            "contributors %s: %d author-days%s", repo, len(rows), " (backfill)" if not since else ""
        )


def _commits_by_author(repo: str, since: str | None) -> list[store.Row]:
    counts: dict[tuple[str, str], int] = {}
    page = 1
    while True:
        url = f"{API}/repos/{repo}/commits?per_page=100&page={page}"
        if since:
            url += f"&since={since}"
        batch = get_json(url, headers=github_headers())
        for c in batch:
            author = commit_author(c)
            if author is None:
                continue
            d = (c.get("commit", {}).get("author", {}).get("date") or "")[:10]
            if d:
                counts[(d, author)] = counts.get((d, author), 0) + 1
        if len(batch) < 100:
            break
        page += 1
    return [{"date": d, "author": a, "commits": n} for (d, a), n in sorted(counts.items())]


def commit_author(commit: dict) -> str | None:
    """A stable author key, or None for bots."""
    user = commit.get("author") or {}
    login = user.get("login")
    if login:
        if user.get("type") == "Bot" or login.endswith("[bot]"):
            return None
        return login
    email = (commit.get("commit", {}).get("author", {}).get("email") or "").strip().lower()
    if not email or "[bot]" in email or email.endswith("noreply.github.com"):
        return None
    return f"email:{email}"
