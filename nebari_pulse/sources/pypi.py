"""PyPI downloads via pypistats.org (daily, excluding mirrors, ~180 days).

Also the daily breakdown by Python minor version and by operating system
(pypistats' `python_minor` and `system` endpoints), stored under
downloads/pypi_breakdown/<package>.csv as date,dimension,category,count.
pypistats reports "null" for downloads whose installer did not say.
"""

from __future__ import annotations

import logging
from datetime import date
from pathlib import Path

from .. import store
from ..config import DownloadsConfig
from ..http import HttpError, get_json
from . import CollectResult

log = logging.getLogger(__name__)

API = "https://pypistats.org/api/packages"
COLUMNS = ["date", "count"]
KEY = ["date"]
BREAKDOWN_COLUMNS = ["date", "dimension", "category", "count"]
BREAKDOWN_KEY = ["date", "dimension", "category"]
DIMENSIONS = ("python_minor", "system")


def collect(cfg: DownloadsConfig, data_dir: Path, today: date) -> CollectResult:
    result = CollectResult(source="pypi")
    for product, ref in cfg.refs("pypi"):
        try:
            payload = get_json(f"{API}/{ref}/overall?mirrors=false")
        except HttpError as e:
            result.errors.append(f"{ref}: {e}")
            continue
        rows = [
            {"date": d["date"], "count": int(d["downloads"])}
            for d in payload.get("data", [])
            if d.get("category") == "without_mirrors" and d["date"] < today.isoformat()
        ]
        path = store.path_for(data_dir, "downloads", "pypi", ref)
        result.rows_changed += store.upsert(path, COLUMNS, KEY, rows)
        result.artifacts += 1
        log.info("pypi %s (%s): %d days", ref, product.id, len(rows))

        breakdown: list[store.Row] = []
        for dimension in DIMENSIONS:
            try:
                payload = get_json(f"{API}/{ref}/{dimension}")
            except HttpError as e:
                result.errors.append(f"{ref} {dimension}: {e}")
                continue
            breakdown.extend(
                {
                    "date": d["date"],
                    "dimension": dimension,
                    "category": d.get("category") or "null",
                    "count": int(d["downloads"]),
                }
                for d in payload.get("data", [])
                if d["date"] < today.isoformat()
            )
        if breakdown:
            path = store.path_for(data_dir, "downloads", "pypi_breakdown", ref)
            result.rows_changed += store.upsert(path, BREAKDOWN_COLUMNS, BREAKDOWN_KEY, breakdown)
    return result
