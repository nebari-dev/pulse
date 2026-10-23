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
    """GitHub repos (owner/name) whose health, releases and traffic count
    towards this product. Independent of the download sources."""
    repos: tuple[str, ...] = ()

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

    def repos(self) -> list[tuple[Product, str]]:
        """All (product, GitHub repo) pairs, in config order."""
        return [(p, repo) for p in self.products for repo in p.repos]


@dataclass(frozen=True)
class DocsSite:
    id: str
    name: str
    hosts: tuple[str, ...]


@dataclass(frozen=True)
class DocsConfig:
    cloudflare_zone: str
    sites: tuple[DocsSite, ...] = ()


@dataclass(frozen=True)
class Config:
    downloads: DownloadsConfig
    docs: DocsConfig = DocsConfig(cloudflare_zone="")


class ConfigError(ValueError):
    pass


def load(path: Path) -> Config:
    raw = yaml.safe_load(path.read_text())
    if not isinstance(raw, dict) or "downloads" not in raw:
        raise ConfigError(f"{path}: expected a top-level 'downloads' mapping")
    return Config(
        downloads=_load_downloads(raw["downloads"]),
        docs=_load_docs(raw.get("docs") or {}),
    )


def _load_docs(raw: dict) -> DocsConfig:
    sites: list[DocsSite] = []
    seen_ids: set[str] = set()
    seen_hosts: dict[str, str] = {}
    for entry in raw.get("sites") or []:
        sid = entry.get("id")
        if not sid or sid in seen_ids:
            raise ConfigError(f"docs site id missing or duplicated: {sid!r}")
        seen_ids.add(sid)
        hosts = entry.get("hosts") or []
        if not isinstance(hosts, list) or not hosts or not all(isinstance(h, str) for h in hosts):
            raise ConfigError(f"docs.{sid}.hosts: expected a non-empty list of hostnames")
        for h in hosts:
            if h in seen_hosts:
                raise ConfigError(f"docs host {h!r} listed under both {seen_hosts[h]} and {sid}")
            seen_hosts[h] = sid
        sites.append(DocsSite(id=sid, name=entry.get("name", sid), hosts=tuple(hosts)))
    zone = raw.get("cloudflare_zone", "")
    if sites and not zone:
        raise ConfigError("docs.cloudflare_zone is required when docs sites are listed")
    return DocsConfig(cloudflare_zone=zone, sites=tuple(sites))


def _load_downloads(raw: dict) -> DownloadsConfig:
    products: list[Product] = []
    seen_ids: set[str] = set()
    seen_refs: dict[tuple[str, str], str] = {}
    seen_repos: dict[str, str] = {}
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
        repos = entry.get("repos") or []
        if not isinstance(repos, list) or not all(
            isinstance(r, str) and r.count("/") == 1 for r in repos
        ):
            raise ConfigError(f"{pid}.repos: expected a list of 'owner/name' strings")
        for repo in repos:
            if repo in seen_repos:
                raise ConfigError(f"repo {repo!r} listed under both {seen_repos[repo]} and {pid}")
            seen_repos[repo] = pid
        products.append(
            Product(
                id=pid,
                name=entry.get("name", pid),
                kind=kind,
                artifacts=artifacts,
                repos=tuple(repos),
            )
        )

    return DownloadsConfig(
        products=products,
        quay_namespace=raw.get("quay_namespace", "nebari"),
        quay_ignore=frozenset(raw.get("quay_ignore") or []),
        github_releases_ignore_suffixes=tuple(raw.get("github_releases_ignore_suffixes") or []),
    )
