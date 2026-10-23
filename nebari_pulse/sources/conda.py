"""conda downloads via api.anaconda.org (cumulative per file, snapshotted daily)."""

from __future__ import annotations

import logging
from datetime import date
from pathlib import Path

from .. import store
from ..config import DownloadsConfig
from ..http import HttpError, get_json
from . import CollectResult

log = logging.getLogger(__name__)

API = "https://api.anaconda.org/package"
COLUMNS = ["date", "version", "file", "cumulative"]
KEY = ["date", "file"]


def collect(cfg: DownloadsConfig, data_dir: Path, today: date) -> CollectResult:
    result = CollectResult(source="conda")
    for product, ref in cfg.refs("conda"):
        try:
            files = get_json(f"{API}/{ref}/files")
        except HttpError as e:
            result.errors.append(f"{ref}: {e}")
            continue
        rows = [
            {
                "date": today.isoformat(),
                "version": f["version"],
                "file": f["basename"],
                "cumulative": int(f.get("ndownloads") or 0),
            }
            for f in files
        ]
        path = store.path_for(data_dir, "downloads", "conda", ref)
        result.rows_changed += store.upsert(path, COLUMNS, KEY, rows)
        result.artifacts += 1
        log.info("conda %s (%s): %d files", ref, product.id, len(rows))
    return result
