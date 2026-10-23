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
    repos = dict((r, p.id) for p, r in cfg.downloads.repos())
    assert repos["nebari-dev/nebari"] == "nebari-classic"
    assert cfg.docs.cloudflare_zone == "nebari.dev"
    assert [s.id for s in cfg.docs.sites] == ["docs", "classic-docs", "packs-docs"]


def test_duplicate_ref_rejected():
    with pytest.raises(config.ConfigError, match="listed under both"):
        config._load_downloads(
            {"products": [{"id": "a", "quay": ["ns/x"]}, {"id": "b", "quay": ["ns/x"]}]}
        )


def test_bad_kind_rejected():
    with pytest.raises(config.ConfigError, match="kind"):
        config._load_downloads({"products": [{"id": "a", "kind": "thing"}]})


def test_duplicate_repo_rejected():
    with pytest.raises(config.ConfigError, match="repo 'o/r' listed under both"):
        config._load_downloads(
            {"products": [{"id": "a", "repos": ["o/r"]}, {"id": "b", "repos": ["o/r"]}]}
        )


def test_bad_repo_rejected():
    with pytest.raises(config.ConfigError, match="owner/name"):
        config._load_downloads({"products": [{"id": "a", "repos": ["not-a-repo"]}]})


def test_docs_host_listed_twice_rejected():
    with pytest.raises(config.ConfigError, match="listed under both"):
        config._load_docs(
            {
                "cloudflare_zone": "z",
                "sites": [
                    {"id": "a", "hosts": ["x.dev"]},
                    {"id": "b", "hosts": ["x.dev"]},
                ],
            }
        )


def test_docs_zone_required_with_sites():
    with pytest.raises(config.ConfigError, match="cloudflare_zone"):
        config._load_docs({"sites": [{"id": "a", "hosts": ["x.dev"]}]})
