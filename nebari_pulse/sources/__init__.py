"""One module per upstream source. Each exposes:

    collect(cfg, data_dir, today) -> CollectResult

Daily sources (quay, pypi) write `date,count` rows. Cumulative sources
(conda, github_releases) write a snapshot row per day with the running
total, and the daily series is derived later in summary.py.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class CollectResult:
    source: str
    artifacts: int = 0
    rows_changed: int = 0
    errors: list[str] = field(default_factory=list)
    notes: dict[str, object] = field(default_factory=dict)
