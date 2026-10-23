"""GitHub Release asset downloads (cumulative per asset, snapshotted daily).

Covers CLIs shipped as binaries (nic, skillsctl, frames) and anything a
Homebrew tap installs, since brew fetches the release asset.
"""

from __future__ import annotations

import logging
from datetime import date
from pathlib import Path

from .. import store
from ..config import DownloadsConfig
from ..http import HttpError, get_json, github_headers
from . import CollectResult

log = logging.getLogger(__name__)

API = "https://api.github.com"
COLUMNS = ["date", "tag", "asset", "cumulative"]
KEY = ["date", "tag", "asset"]


def collect(cfg: DownloadsConfig, data_dir: Path, today: date) -> CollectResult:
    result = CollectResult(source="github_releases")
    for product, ref in cfg.refs("github_releases"):
        try:
            releases = _all_releases(ref)
        except HttpError as e:
            result.errors.append(f"{ref}: {e}")
            continue
        rows = [
            {
                "date": today.isoformat(),
                "tag": rel["tag_name"],
                "asset": asset["name"],
                "cumulative": int(asset.get("download_count") or 0),
            }
            for rel in releases
            for asset in rel.get("assets", [])
            if not asset["name"].endswith(cfg.github_releases_ignore_suffixes)
        ]
        path = store.path_for(data_dir, "downloads", "github_releases", ref)
        result.rows_changed += store.upsert(path, COLUMNS, KEY, rows)
        result.artifacts += 1
        log.info("github_releases %s (%s): %d assets", ref, product.id, len(rows))
    return result


def _all_releases(repo: str) -> list[dict]:
    releases: list[dict] = []
    page = 1
    while True:
        batch = get_json(
            f"{API}/repos/{repo}/releases?per_page=100&page={page}", headers=github_headers()
        )
        releases.extend(batch)
        if len(batch) < 100:
            return releases
        page += 1
