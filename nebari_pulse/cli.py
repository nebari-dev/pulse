"""`pulse` command line.

pulse collect [--only quay,pypi] [--dry-run]   fetch sources, upsert data/, rebuild summary
                                                (sources: quay, pypi, conda, github_releases,
                                                 github_repos, cloudflare_docs)
pulse summarize                                 rebuild summary.json, repos.json, products/
pulse check                                     validate sources.yaml
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import UTC, datetime
from pathlib import Path

from . import config, summary
from .sources import (
    CollectResult,
    cloudflare_docs,
    conda,
    github_releases,
    github_repos,
    pypi,
    quay,
)

COLLECTORS = {
    "quay": quay.collect,
    "pypi": pypi.collect,
    "conda": conda.collect,
    "github_releases": github_releases.collect,
    "github_repos": github_repos.collect,
    "cloudflare_docs": cloudflare_docs.collect,
}

ROOT = Path(__file__).resolve().parent.parent


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="pulse")
    parser.add_argument("--sources", type=Path, default=ROOT / "sources.yaml")
    parser.add_argument("--data-dir", type=Path, default=ROOT / "data")
    parser.add_argument("-v", "--verbose", action="store_true")
    sub = parser.add_subparsers(dest="command", required=True)

    p_collect = sub.add_parser("collect", help="fetch all sources and update data/")
    p_collect.add_argument("--only", help="comma-separated subset of: " + ",".join(COLLECTORS))
    p_collect.add_argument(
        "--dry-run", action="store_true", help="fetch into a temp dir; leave data/ untouched"
    )
    sub.add_parser("summarize", help="rebuild the dashboard data files without fetching")
    sub.add_parser("check", help="validate sources.yaml")

    args = parser.parse_args(argv)
    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING,
        format="%(levelname)s %(name)s: %(message)s",
    )

    try:
        cfg = config.load(args.sources)
    except config.ConfigError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2

    if args.command == "check":
        n = sum(len(p.artifacts.get(s, [])) for p in cfg.downloads.products for s in config.SOURCES)
        repos = len(cfg.downloads.repos())
        print(
            f"ok: {len(cfg.downloads.products)} products, {n} artifact refs, {repos} repos, "
            f"{len(cfg.docs.sites)} docs sites"
        )
        return 0

    today = datetime.now(UTC).date()

    if args.command == "collect":
        return _collect(cfg, args, today)

    _summarize(cfg, args.data_dir, today)
    return 0


def _collect(cfg: config.Config, args: argparse.Namespace, today) -> int:
    data_dir = args.data_dir
    if args.dry_run:
        import shutil
        import tempfile

        tmp = Path(tempfile.mkdtemp(prefix="pulse-"))
        if data_dir.exists():
            shutil.copytree(data_dir, tmp, dirs_exist_ok=True)
        data_dir = tmp
        print(f"dry run: writing to {tmp}")

    names = args.only.split(",") if args.only else list(COLLECTORS)
    unknown = [n for n in names if n not in COLLECTORS]
    if unknown:
        print(
            f"error: unknown source(s) {unknown}; choose from {list(COLLECTORS)}", file=sys.stderr
        )
        return 2

    results: list[CollectResult] = []
    for name in names:
        family = cfg.docs if name == "cloudflare_docs" else cfg.downloads
        res = COLLECTORS[name](family, data_dir, today)
        results.append(res)
        status = f"{res.artifacts} artifacts, {res.rows_changed} rows changed"
        if res.errors:
            status += f", {len(res.errors)} errors"
        print(f"{name:17s} {status}")
        for err in res.errors:
            print(f"  ! {err}")

    for res in results:
        if res.source == "cloudflare_docs" and res.notes.get("skipped"):
            print(f"docs traffic skipped: {res.notes['skipped']}")
        if res.source == "github_repos" and res.notes.get("traffic_denied"):
            denied = res.notes["traffic_denied"]
            print(
                f"traffic skipped for {len(denied)} repo(s): "
                f"{res.notes.get('traffic_reason') or 'token needs push access'}"
            )
        if res.source == "quay":
            untracked = res.notes.get("untracked", [])
            (data_dir / "untracked.json").parent.mkdir(parents=True, exist_ok=True)
            (data_dir / "untracked.json").write_text(
                json.dumps({"quay": untracked}, indent=1) + "\n"
            )
            if untracked:
                print(
                    f"untracked quay repos ({len(untracked)}), add to sources.yaml or quay_ignore:"
                )
                for ref in untracked:
                    print(f"  - {ref}")

    _summarize(cfg, data_dir, today)

    # Partial failure is a warning (we keep what we got); total failure of a
    # source is an error so the workflow run goes red.
    failed = [r.source for r in results if r.errors and r.artifacts == 0]
    if failed:
        print(f"error: no data collected for {failed}", file=sys.stderr)
        return 1
    return 0


def _summarize(cfg: config.Config, data_dir: Path, today) -> None:
    written = summary.write_all(summary.build(cfg.downloads, data_dir, today), data_dir)
    docs_out = summary.write_docs(summary.build_docs(cfg.docs, data_dir, today), data_dir)
    print(
        f"wrote {data_dir / summary.INDEX_FILE}, {data_dir / summary.REPOS_FILE}, "
        f"{docs_out} and {len(written) - 2} product files under "
        f"{data_dir / summary.PRODUCTS_DIR}/"
    )


if __name__ == "__main__":
    sys.exit(main())
