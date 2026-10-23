"""Build data/summary.json, the contract the dashboard reads.

Shape:
    {
      "generated_at": "YYYY-MM-DD" (collection date, UTC),
      "sources": {<source>: {"kind": "daily"|"cumulative", "artifacts": N}},
      "products": [
        {
          "id", "name", "kind",
          "totals": {"7d": N, "30d": N, "90d": N, "all": N},
          "series": [{"date": "YYYY-MM-DD", "count": N}, ...],   # daily, summed
          "artifacts": [
            {"source", "ref", "totals": {...}, "latest_cumulative": N|null,
             "latest_items": [{<key cols>..., "cumulative": N,
                               "totals": {"7d", "30d", "90d", "all"}}] | null,
             "series": [...]}
          ],
          "repos": [
            {"repo": "owner/name",
             "health": {<latest health snapshot>} | null,
             "health_series": [{"date", "stars", "open_issues", "open_prs"}],
             "traffic": [{"date", "views", "unique_views", "clones", "unique_clones"}],
             "releases": [{"tag", "date", "prerelease"}]}   # newest first
          ]
        }
      ],
      "repos": {"count": N, "traffic": N}   # repos tracked / with traffic data
    }

Per-item totals on cumulative artifacts are the same snapshot deltas,
kept per version/tag so the dashboard can show which releases people
install today (version adoption), not just all-time counters.

Daily sources (quay, pypi) contribute their rows directly. Cumulative
sources (conda, github_releases) contribute the day-over-day delta
between snapshots, attributed to the later snapshot date; the first
snapshot of an item contributes nothing. "all" is the sum of every
daily count we hold, so it grows as history accumulates.
"""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

from . import store
from .config import DownloadsConfig

DAILY_SOURCES = ("quay", "pypi")
CUMULATIVE_SOURCES = ("conda", "github_releases")
WINDOWS = {"7d": 7, "30d": 30, "90d": 90}

Series = dict[str, int]  # date -> count


def build(cfg: DownloadsConfig, data_dir: Path, today: date) -> dict:
    products = []
    source_counts: dict[str, int] = defaultdict(int)
    repo_count = traffic_count = 0
    for product in cfg.products:
        artifacts = []
        product_series: Series = defaultdict(int)
        for source in DAILY_SOURCES + CUMULATIVE_SOURCES:
            for ref in product.refs(source):
                rows = store.read(store.path_for(data_dir, "downloads", source, ref))
                if source in DAILY_SOURCES:
                    series = _daily_series(rows)
                    latest, items = None, None
                else:
                    series, latest, items = _cumulative_series(rows, today)
                for d, n in series.items():
                    product_series[d] += n
                source_counts[source] += 1
                artifacts.append(
                    {
                        "source": source,
                        "ref": ref,
                        "kind": artifact_kind(source, ref),
                        "totals": _totals(series, today),
                        "latest_cumulative": latest,
                        "latest_items": items,
                        "series": _as_list(series),
                    }
                )
        repos = [_repo(data_dir, repo) for repo in product.repos]
        repo_count += len(repos)
        traffic_count += sum(1 for r in repos if r["traffic"])
        products.append(
            {
                "id": product.id,
                "name": product.name,
                "kind": product.kind,
                "totals": _totals(product_series, today),
                "series": _as_list(product_series),
                "artifacts": artifacts,
                "repos": repos,
            }
        )
    return {
        "generated_at": today.isoformat(),
        "sources": {
            s: {"kind": "daily" if s in DAILY_SOURCES else "cumulative", "artifacts": n}
            for s, n in sorted(source_counts.items())
        },
        "products": products,
        "repos": {"count": repo_count, "traffic": traffic_count},
    }


HEALTH_INTS = (
    "stars",
    "forks",
    "subscribers",
    "open_issues",
    "open_prs",
    "merged_prs_30d",
    "issues_opened_30d",
    "issues_closed_30d",
)


def _repo(data_dir: Path, repo: str) -> dict:
    health_rows = store.read(store.path_for(data_dir, "repos", "health", repo))
    health_rows.sort(key=lambda r: r["date"])
    health = None
    if health_rows:
        last = health_rows[-1]
        health = {"date": last["date"], "pushed_at": last.get("pushed_at") or None}
        for col in HEALTH_INTS:
            health[col] = _int_or_none(last.get(col))
    traffic = [
        {
            "date": r["date"],
            "views": int(r["views"] or 0),
            "unique_views": int(r["unique_views"] or 0),
            "clones": int(r["clones"] or 0),
            "unique_clones": int(r["unique_clones"] or 0),
        }
        for r in sorted(
            store.read(store.path_for(data_dir, "repos", "traffic", repo)),
            key=lambda r: r["date"],
        )
    ]
    releases = [
        {
            "tag": r["tag"],
            "date": r["published_at"],
            "prerelease": r.get("prerelease") == "true",
        }
        for r in store.read(store.path_for(data_dir, "repos", "releases", repo))
        if r.get("published_at")
    ]
    releases.sort(key=lambda r: (r["date"], r["tag"]), reverse=True)
    return {
        "repo": repo,
        "health": health,
        "health_series": [
            {
                "date": r["date"],
                "stars": _int_or_none(r.get("stars")),
                "open_issues": _int_or_none(r.get("open_issues")),
                "open_prs": _int_or_none(r.get("open_prs")),
            }
            for r in health_rows
        ],
        "traffic": traffic,
        "releases": releases,
    }


def _int_or_none(value: str | None) -> int | None:
    return int(value) if value not in (None, "") else None


def artifact_kind(source: str, ref: str) -> str:
    """What one download of this artifact is: an image or Helm chart pull, a
    package install, or a release binary. Chart pulls are kept apart from
    image pulls because GitOps controllers poll charts continuously."""
    if source == "quay":
        return "chart" if "/charts/" in ref else "image"
    if source in ("pypi", "conda"):
        return "package"
    return "binary"


def write(summary: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(summary, indent=1, sort_keys=False) + "\n")


def _daily_series(rows: list[store.Row]) -> Series:
    return {r["date"]: int(r["count"]) for r in rows}


def _cumulative_series(
    rows: list[store.Row], today: date
) -> tuple[Series, int | None, list[dict] | None]:
    """Delta between consecutive snapshots per item, summed per date.

    Also returns the latest snapshot's items (tag/asset or version/file plus
    their cumulative count and their own windowed deltas) so the dashboard
    can break a repo down by release.
    """
    by_item: dict[tuple, list[tuple[str, int]]] = defaultdict(list)
    key_cols: list[str] = []
    for r in rows:
        key_cols = [k for k in r if k not in ("date", "cumulative")]
        key = tuple(r[k] for k in key_cols)
        by_item[key].append((r["date"], int(r["cumulative"])))
    series: Series = defaultdict(int)
    latest_date = max((r["date"] for r in rows), default=None)
    latest_items: list[dict] = []
    for key, snapshots in by_item.items():
        snapshots.sort()
        item_series: Series = {}
        for (_, prev), (d, cur) in zip(snapshots, snapshots[1:], strict=False):
            delta = max(cur - prev, 0)  # counters never go down; guard anyway
            series[d] += delta
            item_series[d] = delta
        if snapshots and snapshots[-1][0] == latest_date:
            latest_items.append(
                {
                    **dict(zip(key_cols, key, strict=True)),
                    "cumulative": snapshots[-1][1],
                    "totals": _totals(item_series, today),
                }
            )
    if latest_date is None:
        return dict(series), None, None
    latest_items.sort(key=lambda i: -i["cumulative"])
    return dict(series), sum(i["cumulative"] for i in latest_items), latest_items


def _totals(series: Series, today: date) -> dict[str, int]:
    totals = {name: 0 for name in WINDOWS}
    for d, n in series.items():
        age = (today - date.fromisoformat(d)).days
        for name, days in WINDOWS.items():
            if 0 <= age < days:
                totals[name] += n
    totals["all"] = sum(series.values())
    return totals


def _as_list(series: Series) -> list[dict]:
    return [{"date": d, "count": series[d]} for d in sorted(series)]


def window_start(today: date, days: int) -> date:
    return today - timedelta(days=days - 1)
