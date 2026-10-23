from pathlib import Path

import pytest

from nebari_pulse import config

ROOT = Path(__file__).resolve().parent.parent


def test_real_sources_yaml_loads():
    cfg = config.load(ROOT / "sources.yaml")
    ids = [p.id for p in cfg.downloads.products]
    assert "nebari-operator" in ids and "nic" in ids
    assert cfg.downloads.quay_namespace == "nebari"
    gh_refs = [r for _, r in cfg.downloads.refs("github_releases")]
    assert "nebari-dev/nebari-infrastructure-core" in gh_refs


def test_duplicate_ref_rejected():
    with pytest.raises(config.ConfigError, match="listed under both"):
        config._load_downloads(
            {"products": [{"id": "a", "quay": ["ns/x"]}, {"id": "b", "quay": ["ns/x"]}]}
        )


def test_bad_kind_rejected():
    with pytest.raises(config.ConfigError, match="kind"):
        config._load_downloads({"products": [{"id": "a", "kind": "thing"}]})
