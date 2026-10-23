"""PyPI downloads via pypistats.org (daily, excluding mirrors, ~180 days)."""

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
    return result
