"""Documentation site traffic from Cloudflare zone analytics.

The docs are served through Cloudflare, so the edge sees every request
regardless of cookie consent (Google Analytics on the pages is consent
gated and undercounts). Two CSV families under data/docs/:

    traffic/<site>.csv  date,host,pageviews,visits   HTML responses with
                        status 200 to real browsers, per host per day.
                        Fetched for the last 30 days on every run (the
                        zone retains about that much) and upserted.
    pages/<site>.csv    date,path,pageviews            top paths over the
                        last 7 days, snapshotted daily.

Needs an API token with Zone:Read (to resolve the zone id by name) and
Analytics:Read on the zone: CLOUDFLARE_ANALYTICS_TOKEN, or the deploy
token CLOUDFLARE_API_TOKEN if it has been granted those two as well.
Without one the source is skipped with a note, like repo traffic without
a push-capable token. A token without the scopes fails the zone lookup
with a clear error instead.
"""

from __future__ import annotations

import logging
import os
from datetime import date, timedelta
from pathlib import Path

from .. import store
from ..config import DocsConfig
from ..http import HttpError, get_json, post_json
from . import CollectResult

log = logging.getLogger(__name__)

API = "https://api.cloudflare.com/client/v4"
GRAPHQL = f"{API}/graphql"
TRAFFIC_COLUMNS = ["date", "host", "pageviews", "visits"]
PAGES_COLUMNS = ["date", "path", "pageviews"]
TRAFFIC_DAYS = 30
PAGES_DAYS = 7

QUERY = """
query ($zone: String!, $hosts: [String!], $start: Date!, $end: Date!, $pagesStart: Date!) {
  viewer {
    zones(filter: { zoneTag: $zone }) {
      traffic: httpRequestsAdaptiveGroups(
        limit: 10000
        filter: {
          date_geq: $start, date_leq: $end
          requestSource: "eyeball"
          clientRequestHTTPHost_in: $hosts
          edgeResponseContentTypeName: "html"
          edgeResponseStatus: 200
        }
      ) {
        count
        sum { visits }
        dimensions { date clientRequestHTTPHost }
      }
      pages: httpRequestsAdaptiveGroups(
        limit: 200
        orderBy: [count_DESC]
        filter: {
          date_geq: $pagesStart, date_leq: $end
          requestSource: "eyeball"
          clientRequestHTTPHost_in: $hosts
          edgeResponseContentTypeName: "html"
          edgeResponseStatus: 200
        }
      ) {
        count
        dimensions { clientRequestPath }
      }
    }
  }
}
"""


def token() -> str | None:
    """CLOUDFLARE_ANALYTICS_TOKEN, or the deploy token (CLOUDFLARE_API_TOKEN)
    when that one has been given Zone:Read and Analytics:Read as well."""
    return (
        os.environ.get("CLOUDFLARE_ANALYTICS_TOKEN")
        or os.environ.get("CLOUDFLARE_API_TOKEN")
        or None
    )


def headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {token()}"}


def collect(cfg: DocsConfig, data_dir: Path, today: date) -> CollectResult:
    result = CollectResult(source="cloudflare_docs")
    if not cfg.sites:
        return result
    if not token():
        result.notes["skipped"] = "CLOUDFLARE_ANALYTICS_TOKEN (or CLOUDFLARE_API_TOKEN) not set"
        log.warning("docs traffic skipped: no Cloudflare token set")
        return result
    try:
        zone = zone_id(cfg.cloudflare_zone)
    except HttpError as e:
        result.errors.append(f"zone {cfg.cloudflare_zone}: {e}")
        return result

    end = today - timedelta(days=1)  # today is still filling at the edge
    start = end - timedelta(days=TRAFFIC_DAYS - 1)
    pages_start = end - timedelta(days=PAGES_DAYS - 1)
    for site in cfg.sites:
        try:
            payload = post_json(
                GRAPHQL,
                {
                    "query": QUERY,
                    "variables": {
                        "zone": zone,
                        "hosts": list(site.hosts),
                        "start": start.isoformat(),
                        "end": end.isoformat(),
                        "pagesStart": pages_start.isoformat(),
                    },
                },
                headers=headers(),
            )
        except HttpError as e:
            result.errors.append(f"{site.id}: {e}")
            continue
        if payload.get("errors"):
            result.errors.append(f"{site.id}: {payload['errors'][0].get('message')}")
            continue
        traffic, pages = parse(payload, today)
        result.rows_changed += store.upsert(
            store.path_for(data_dir, "docs", "traffic", site.id),
            TRAFFIC_COLUMNS,
            ["date", "host"],
            traffic,
        )
        if pages:
            result.rows_changed += store.upsert(
                store.path_for(data_dir, "docs", "pages", site.id),
                PAGES_COLUMNS,
                ["date", "path"],
                pages,
            )
        result.artifacts += 1
        log.info("docs %s: %d host-days, %d top paths", site.id, len(traffic), len(pages))
    return result


def zone_id(name: str) -> str:
    payload = get_json(f"{API}/zones?name={name}", headers=headers())
    zones = payload.get("result") or []
    if not zones:
        raise HttpError(f"{API}/zones?name={name}", 404, "zone not found or token lacks Zone:Read")
    return zones[0]["id"]


def parse(payload: dict, today: date) -> tuple[list[store.Row], list[store.Row]]:
    """Rows for the traffic and pages files from one GraphQL response."""
    zones = (payload.get("data") or {}).get("viewer", {}).get("zones") or []
    if not zones:
        return [], []
    zone = zones[0]
    traffic = [
        {
            "date": g["dimensions"]["date"],
            "host": g["dimensions"]["clientRequestHTTPHost"],
            "pageviews": int(g.get("count") or 0),
            "visits": int((g.get("sum") or {}).get("visits") or 0),
        }
        for g in zone.get("traffic") or []
    ]
    pages = [
        {
            "date": today.isoformat(),
            "path": g["dimensions"]["clientRequestPath"],
            "pageviews": int(g.get("count") or 0),
        }
        for g in zone.get("pages") or []
    ]
    return traffic, pages
