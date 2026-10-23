"""Quay.io image and OCI chart pulls.

GET /api/v1/repository/{ns}/{name}?includeStats=true returns ~90 days of
daily pull counts for public repos, no auth. History older than that is
only in our CSVs, which is why this runs daily.
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

API = "https://quay.io/api/v1"
COLUMNS = ["date", "count"]
KEY = ["date"]


def collect(cfg: DownloadsConfig, data_dir: Path, today: date) -> CollectResult:
    result = CollectResult(source="quay")
    for product, ref in cfg.refs("quay"):
        try:
            payload = get_json(f"{API}/repository/{ref}?includeStats=true")
        except HttpError as e:
            result.errors.append(f"{ref}: {e}")
            continue
        stats = payload.get("stats") or []
        rows = [
            {"date": s["date"], "count": int(s["count"])}
            for s in stats
            if s.get("date") and s["date"] < today.isoformat()  # today is partial
        ]
        path = store.path_for(data_dir, "downloads", "quay", ref)
        result.rows_changed += store.upsert(path, COLUMNS, KEY, rows)
        result.artifacts += 1
        log.info("quay %s (%s): %d days", ref, product.id, len(rows))

    result.notes["untracked"] = _untracked(cfg)
    return result


def _untracked(cfg: DownloadsConfig) -> list[str]:
    """Public repos in the namespace that sources.yaml neither tracks nor ignores."""
    tracked = {ref for _, ref in cfg.refs("quay")} | cfg.quay_ignore
    found: list[str] = []
    url = f"{API}/repository?namespace={cfg.quay_namespace}&public=true"
    try:
        while url:
            payload = get_json(url)
            for repo in payload.get("repositories", []):
                full = f"{repo['namespace']}/{repo['name']}"
                if full not in tracked:
                    found.append(full)
            next_page = payload.get("next_page")
            url = (
                f"{API}/repository?namespace={cfg.quay_namespace}&public=true&next_page={next_page}"
                if next_page
                else ""
            )
    except HttpError as e:
        log.warning("could not list quay namespace: %s", e)
    return sorted(found)
