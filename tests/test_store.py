from nebari_pulse import store


def test_slug_is_filesystem_safe():
    assert store.slug("nebari/charts/nebari-operator") == "nebari__charts__nebari-operator"
    assert store.slug("conda-forge/nebari") == "conda-forge__nebari"


def test_upsert_is_idempotent_and_sorted(tmp_path):
    path = tmp_path / "x.csv"
    cols, key = ["date", "count"], ["date"]
    n = store.upsert(
        path, cols, key, [{"date": "2026-01-02", "count": 2}, {"date": "2026-01-01", "count": 1}]
    )
    assert n == 2
    assert store.upsert(path, cols, key, [{"date": "2026-01-01", "count": 1}]) == 0
    assert store.upsert(path, cols, key, [{"date": "2026-01-01", "count": 5}]) == 1
    rows = store.read(path)
    assert [r["date"] for r in rows] == ["2026-01-01", "2026-01-02"]
    assert rows[0]["count"] == "5"


def test_upsert_writes_empty_file_once(tmp_path):
    path = tmp_path / "empty.csv"
    assert store.upsert(path, ["date", "count"], ["date"], []) == 0
    assert path.exists()
    assert store.read(path) == []
