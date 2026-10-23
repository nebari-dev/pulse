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
    assert [a["kind"] for a in product["artifacts"]] == ["image", "binary"]
    gh = next(a for a in product["artifacts"] if a["source"] == "github_releases")
    assert gh["latest_items"][0] == {
        "tag": "v1",
        "asset": "a.tgz",
        "cumulative": 15,
        "totals": {"7d": 5, "30d": 5, "90d": 5, "all": 5},
    }
    # v2 has one snapshot only: no delta yet, but it is listed for adoption.
    assert gh["latest_items"][1]["totals"]["all"] == 0
    assert product["repos"] == []
    assert out["repos"] == {"count": 0, "traffic": 0}
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


def test_artifact_kind():
    assert summary.artifact_kind("quay", "nebari/nebari-operator") == "image"
    assert summary.artifact_kind("quay", "nebari/charts/nebari-operator") == "chart"
    assert summary.artifact_kind("pypi", "nebari") == "package"
    assert summary.artifact_kind("conda", "conda-forge/nebi") == "package"
    assert summary.artifact_kind("github_releases", "nebari-dev/nic") == "binary"


def test_repos_health_releases_traffic(tmp_path: Path):
    cfg = _cfg([{"id": "p", "repos": ["nebari-dev/nebari"]}])
    store.upsert(
        store.path_for(tmp_path, "repos", "health", "nebari-dev/nebari"),
        [
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
        ],
        ["date"],
        [
            {
                "date": "2026-10-22",
                "stars": 300,
                "forks": 100,
                "subscribers": 10,
                "open_issues": 50,
                "open_prs": 5,
                "merged_prs_30d": 3,
                "issues_opened_30d": 4,
                "issues_closed_30d": 2,
                "pushed_at": "2026-10-20",
            },
            {
                "date": "2026-10-23",
                "stars": 301,
                "forks": 100,
                "subscribers": 10,
                "open_issues": 49,
                "open_prs": 6,
                "merged_prs_30d": "",
                "issues_opened_30d": 4,
                "issues_closed_30d": 2,
                "pushed_at": "2026-10-23",
            },
        ],
    )
    store.upsert(
        store.path_for(tmp_path, "repos", "releases", "nebari-dev/nebari"),
        ["tag", "published_at", "prerelease"],
        ["tag"],
        [
            {"tag": "2026.1.1", "published_at": "2026-01-10", "prerelease": "false"},
            {"tag": "2026.3.1rc1", "published_at": "2026-03-10", "prerelease": "true"},
            {"tag": "draftish", "published_at": "", "prerelease": "false"},
        ],
    )
    store.upsert(
        store.path_for(tmp_path, "repos", "traffic", "nebari-dev/nebari"),
        ["date", "views", "unique_views", "clones", "unique_clones"],
        ["date"],
        [{"date": "2026-10-22", "views": 10, "unique_views": 4, "clones": 2, "unique_clones": 1}],
    )
    out = summary.build(cfg, tmp_path, TODAY)
    repo = out["products"][0]["repos"][0]
    assert repo["repo"] == "nebari-dev/nebari"
    assert repo["health"]["stars"] == 301
    assert repo["health"]["merged_prs_30d"] is None  # blank cell -> null, not 0
    assert repo["health"]["pushed_at"] == "2026-10-23"
    assert [h["stars"] for h in repo["health_series"]] == [300, 301]
    assert [r["tag"] for r in repo["releases"]] == ["2026.3.1rc1", "2026.1.1"]
    assert repo["releases"][0]["prerelease"] is True
    assert repo["traffic"] == [
        {"date": "2026-10-22", "views": 10, "unique_views": 4, "clones": 2, "unique_clones": 1}
    ]
    assert out["repos"] == {"count": 1, "traffic": 1}
