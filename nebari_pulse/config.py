"""Load and validate sources.yaml."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import yaml

SOURCES = ("quay", "pypi", "conda", "github_releases")
KINDS = ("product", "pack")


@dataclass(frozen=True)
class Product:
    id: str
    name: str
    kind: str
    artifacts: dict[str, list[str]] = field(default_factory=dict)

    def refs(self, source: str) -> list[str]:
        return self.artifacts.get(source, [])


@dataclass(frozen=True)
class DownloadsConfig:
    products: list[Product]
    quay_namespace: str
    quay_ignore: frozenset[str]
    github_releases_ignore_suffixes: tuple[str, ...]

    def refs(self, source: str) -> list[tuple[Product, str]]:
        """All (product, artifact ref) pairs for one source, in config order."""
        return [(p, ref) for p in self.products for ref in p.refs(source)]


@dataclass(frozen=True)
class Config:
    downloads: DownloadsConfig


class ConfigError(ValueError):
    pass


def load(path: Path) -> Config:
    raw = yaml.safe_load(path.read_text())
    if not isinstance(raw, dict) or "downloads" not in raw:
        raise ConfigError(f"{path}: expected a top-level 'downloads' mapping")
    return Config(downloads=_load_downloads(raw["downloads"]))


def _load_downloads(raw: dict) -> DownloadsConfig:
    products: list[Product] = []
    seen_ids: set[str] = set()
    seen_refs: dict[tuple[str, str], str] = {}
    for entry in raw.get("products") or []:
        pid = entry.get("id")
        if not pid or pid in seen_ids:
            raise ConfigError(f"product id missing or duplicated: {pid!r}")
        seen_ids.add(pid)
        kind = entry.get("kind", "product")
        if kind not in KINDS:
            raise ConfigError(f"{pid}: kind must be one of {KINDS}, got {kind!r}")
        artifacts: dict[str, list[str]] = {}
        for source in SOURCES:
            refs = entry.get(source) or []
            if not isinstance(refs, list) or not all(isinstance(r, str) for r in refs):
                raise ConfigError(f"{pid}.{source}: expected a list of strings")
            for ref in refs:
                key = (source, ref)
                if key in seen_refs:
                    raise ConfigError(
                        f"{source} ref {ref!r} listed under both {seen_refs[key]} and {pid}"
                    )
                seen_refs[key] = pid
            if refs:
                artifacts[source] = refs
        products.append(
            Product(id=pid, name=entry.get("name", pid), kind=kind, artifacts=artifacts)
        )

    return DownloadsConfig(
        products=products,
        quay_namespace=raw.get("quay_namespace", "nebari"),
        quay_ignore=frozenset(raw.get("quay_ignore") or []),
        github_releases_ignore_suffixes=tuple(raw.get("github_releases_ignore_suffixes") or []),
    )
