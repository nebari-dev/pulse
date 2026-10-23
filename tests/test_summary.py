from datetime import date
from pathlib import Path

from nebari_pulse import config, store, summary

TODAY = date(2026, 10, 23)


def _cfg(products: list[dict]) -> config.DownloadsConfig:
    return config._load_downloads({"products": products})


def test_daily_and_cumulative_sources_combine(tmp_path: Path):
    cfg = _cfg(
        [
            {
                "id": "nic",
                "kind": "product",
                "quay": ["nebari/starters/aws"],
                "github_releases": ["nebari-dev/nic"],
            }
        ]
    )
    store.upsert(
        store.path_for(tmp_path, "downloads", "quay", "nebari/starters/aws"),
        ["date", "count"],
        ["date"],
        [{"date": "2026-10-20", "count": 3}, {"date": "2026-10-22", "count": 4}],
    )
    store.upsert(
        store.path_for(tmp_path, "downloads", "github_releases", "nebari-dev/nic"),
        ["date", "tag", "asset", "cumulative"],
        ["date", "tag", "asset"],
        [
            {"date": "2026-10-20", "tag": "v1", "asset": "a.tgz", "cumulative": 10},
            {"date": "2026-10-22", "tag": "v1", "asset": "a.tgz", "cumulative": 15},
            {"date": "2026-10-22", "tag": "v2", "asset": "a.tgz", "cumulative": 1},  # new release
        ],
    )

    out = summary.build(cfg, tmp_path, TODAY)
    product = out["products"][0]
    assert product["series"] == [
        {"date": "2026-10-20", "count": 3},
        {"date": "2026-10-22", "count": 4 + 5},
    ]
    assert product["totals"]["7d"] == 12
    assert product["totals"]["all"] == 12
    gh = next(a for a in product["artifacts"] if a["source"] == "github_releases")
    assert gh["latest_cumulative"] == 16
    assert gh["series"] == [{"date": "2026-10-22", "count": 5}]
    assert out["sources"]["github_releases"]["kind"] == "cumulative"


def test_windows_exclude_old_days(tmp_path: Path):
    cfg = _cfg([{"id": "p", "quay": ["ns/r"]}])
    store.upsert(
        store.path_for(tmp_path, "downloads", "quay", "ns/r"),
        ["date", "count"],
        ["date"],
        [
            {"date": "2026-10-23", "count": 1},
            {"date": "2026-10-17", "count": 1},
            {"date": "2026-10-16", "count": 1},
        ],
    )
    totals = summary.build(cfg, tmp_path, TODAY)["products"][0]["totals"]
    assert totals == {"7d": 2, "30d": 3, "90d": 3, "all": 3}


def test_missing_data_files_are_fine(tmp_path: Path):
    cfg = _cfg([{"id": "p", "pypi": ["nothing-yet"]}])
    out = summary.build(cfg, tmp_path, TODAY)
    assert out["products"][0]["totals"]["all"] == 0
    assert out["products"][0]["artifacts"][0]["series"] == []
