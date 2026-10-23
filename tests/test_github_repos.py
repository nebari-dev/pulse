from nebari_pulse.sources import github_repos


def test_backfill_stars_accumulates_per_day(monkeypatch):
    pages = [
        [
            {"starred_at": "2024-01-01T10:00:00Z"},
            {"starred_at": "2024-01-01T11:00:00Z"},
            {"starred_at": "2024-03-05T00:00:00Z"},
        ]
    ]
    monkeypatch.setattr(github_repos, "get_json", lambda url, headers=None: pages.pop(0))
    rows = github_repos._backfill_stars("o/r")
    assert rows == [
        {"date": "2024-01-01", "stars": 2},
        {"date": "2024-03-05", "stars": 3},
    ]
