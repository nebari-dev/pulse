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
    referrers/<site>.csv  date,referrer,pageviews      page views arriving
                        from another host, per referrer host per day.
                        Clicks between the site's own hosts are dropped,
                        so this counts arrivals; "(direct)" is no referrer.
    countries/<site>.csv  date,country,pageviews       page views per
                        visitor country (ISO code) per day.
                        Both refetched for the last 30 days like traffic.

Referrers and countries are one query each, separate from traffic, so a
failure in one is reported without losing the others. Cloudflare only
exposes the referrer field on some zone plans; when the zone refuses it,
referrers are skipped with a note instead of an error on every run.

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
from ..config import DocsConfig, DocsSite
from ..http import HttpError, get_json, post_json
from . import CollectResult

log = logging.getLogger(__name__)

API = "https://api.cloudflare.com/client/v4"
GRAPHQL = f"{API}/graphql"
TRAFFIC_COLUMNS = ["date", "host", "pageviews", "visits"]
PAGES_COLUMNS = ["date", "path", "pageviews"]
REFERRER_COLUMNS = ["date", "referrer", "pageviews"]
COUNTRY_COLUMNS = ["date", "country", "pageviews"]
DIRECT = "(direct)"
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


ORIGIN_QUERY = """
query ($zone: String!, $hosts: [String!], $start: Date!, $end: Date!) {
  viewer {
    zones(filter: { zoneTag: $zone }) {
      %s: httpRequestsAdaptiveGroups(
        limit: 10000
        orderBy: [count_DESC]
        filter: {
          date_geq: $start, date_leq: $end
          requestSource: "eyeball"
          clientRequestHTTPHost_in: $hosts
          edgeResponseContentTypeName: "html"
          edgeResponseStatus: 200
        }
      ) {
        count
        dimensions { date %s }
      }
    }
  }
}
"""

REFERRERS_QUERY = ORIGIN_QUERY % ("referrers", "clientRefererHost")
COUNTRIES_QUERY = ORIGIN_QUERY % ("countries", "clientCountryName")
# Text of the GraphQL error when the zone plan does not expose a field.
FIELD_DENIED = "does not have access to the field"


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
        result.rows_changed += collect_origins(zone, site, start, end, data_dir, result)
    return result


def collect_origins(
    zone: str, site: DocsSite, start: date, end: date, data_dir: Path, result: CollectResult
) -> int:
    """Referrer and country rows for one site. Each is its own query, so one
    failing keeps the other; a failure is a partial error, except a field the
    zone plan does not expose, which is a note."""
    variables = {
        "zone": zone,
        "hosts": list(site.hosts),
        "start": start.isoformat(),
        "end": end.isoformat(),
    }
    zone_data: dict[str, list] = {}
    for key, query in (("referrers", REFERRERS_QUERY), ("countries", COUNTRIES_QUERY)):
        try:
            payload = post_json(
                GRAPHQL, {"query": query, "variables": variables}, headers=headers()
            )
        except HttpError as e:
            result.errors.append(f"{site.id} {key}: {e}")
            continue
        if payload.get("errors"):
            message = payload["errors"][0].get("message") or ""
            if FIELD_DENIED in message:
                result.notes[f"{key}_unavailable"] = message
            else:
                result.errors.append(f"{site.id} {key}: {message}")
            continue
        zones = (payload.get("data") or {}).get("viewer", {}).get("zones") or []
        if zones:
            zone_data[key] = zones[0].get(key) or []
    referrers, countries = parse_origins({"data": {"viewer": {"zones": [zone_data]}}}, site.hosts)
    changed = 0
    if "referrers" in zone_data:
        changed += store.upsert(
            store.path_for(data_dir, "docs", "referrers", site.id),
            REFERRER_COLUMNS,
            ["date", "referrer"],
            referrers,
        )
    if "countries" in zone_data:
        changed += store.upsert(
            store.path_for(data_dir, "docs", "countries", site.id),
            COUNTRY_COLUMNS,
            ["date", "country"],
            countries,
        )
    log.info("docs %s: %d referrer-days, %d country-days", site.id, len(referrers), len(countries))
    return changed


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


def parse_origins(
    payload: dict, own_hosts: tuple[str, ...]
) -> tuple[list[store.Row], list[store.Row]]:
    """Referrer and country rows from one origins response. Referrers that
    are the site's own hosts are internal navigation and are dropped; a
    blank referrer becomes DIRECT. Rows with the same key are summed."""
    zones = (payload.get("data") or {}).get("viewer", {}).get("zones") or []
    if not zones:
        return [], []
    zone = zones[0]
    own = {h.lower() for h in own_hosts}
    referrers: dict[tuple[str, str], int] = {}
    for g in zone.get("referrers") or []:
        host = (g["dimensions"].get("clientRefererHost") or "").lower()
        if host in own:
            continue
        key = (g["dimensions"]["date"], host or DIRECT)
        referrers[key] = referrers.get(key, 0) + int(g.get("count") or 0)
    countries: dict[tuple[str, str], int] = {}
    for g in zone.get("countries") or []:
        code = g["dimensions"].get("clientCountryName") or "XX"
        key = (g["dimensions"]["date"], code)
        countries[key] = countries.get(key, 0) + int(g.get("count") or 0)
    return (
        [{"date": d, "referrer": r, "pageviews": n} for (d, r), n in referrers.items()],
        [{"date": d, "country": c, "pageviews": n} for (d, c), n in countries.items()],
    )
