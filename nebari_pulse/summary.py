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
             "latest_items": [{<key cols>..., "cumulative": N}] | null,
             "series": [...]}
          ]
        }
      ]
    }

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
                    series, latest, items = _cumulative_series(rows)
                for d, n in series.items():
                    product_series[d] += n
                source_counts[source] += 1
                artifacts.append(
                    {
                        "source": source,
                        "ref": ref,
                        "totals": _totals(series, today),
                        "latest_cumulative": latest,
                        "latest_items": items,
                        "series": _as_list(series),
                    }
                )
        products.append(
            {
                "id": product.id,
                "name": product.name,
                "kind": product.kind,
                "totals": _totals(product_series, today),
                "series": _as_list(product_series),
                "artifacts": artifacts,
            }
        )
    return {
        "generated_at": today.isoformat(),
        "sources": {
            s: {"kind": "daily" if s in DAILY_SOURCES else "cumulative", "artifacts": n}
            for s, n in sorted(source_counts.items())
        },
        "products": products,
    }


def write(summary: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(summary, indent=1, sort_keys=False) + "\n")


def _daily_series(rows: list[store.Row]) -> Series:
    return {r["date"]: int(r["count"]) for r in rows}


def _cumulative_series(
    rows: list[store.Row],
) -> tuple[Series, int | None, list[dict] | None]:
    """Delta between consecutive snapshots per item, summed per date.

    Also returns the latest snapshot's items (tag/asset or version/file plus
    their cumulative count) so the dashboard can break a repo down by release.
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
        for (_, prev), (d, cur) in zip(snapshots, snapshots[1:], strict=False):
            series[d] += max(cur - prev, 0)  # counters never go down; guard anyway
        if snapshots and snapshots[-1][0] == latest_date:
            latest_items.append(
                {**dict(zip(key_cols, key, strict=True)), "cumulative": snapshots[-1][1]}
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
