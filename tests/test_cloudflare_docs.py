from datetime import date

from nebari_pulse.sources import cloudflare_docs

TODAY = date(2026, 10, 23)


def test_parse_traffic_and_pages():
    payload = {
        "data": {
            "viewer": {
                "zones": [
                    {
                        "traffic": [
                            {
                                "count": 120,
                                "sum": {"visits": 40},
                                "dimensions": {
                                    "date": "2026-10-21",
                                    "clientRequestHTTPHost": "nebari.dev",
                                },
                            },
                            {
                                "count": 5,
                                "sum": {"visits": 2},
                                "dimensions": {
                                    "date": "2026-10-21",
                                    "clientRequestHTTPHost": "www.nebari.dev",
                                },
                            },
                        ],
                        "pages": [
                            {"count": 60, "dimensions": {"clientRequestPath": "/"}},
                            {"count": 30, "dimensions": {"clientRequestPath": "/get-started/"}},
                        ],
                    }
                ]
            }
        }
    }
    traffic, pages = cloudflare_docs.parse(payload, TODAY)
    assert traffic == [
        {"date": "2026-10-21", "host": "nebari.dev", "pageviews": 120, "visits": 40},
        {"date": "2026-10-21", "host": "www.nebari.dev", "pageviews": 5, "visits": 2},
    ]
    assert pages == [
        {"date": "2026-10-23", "path": "/", "pageviews": 60},
        {"date": "2026-10-23", "path": "/get-started/", "pageviews": 30},
    ]
    assert cloudflare_docs.parse({"data": {"viewer": {"zones": []}}}, TODAY) == ([], [])


def test_skipped_without_token(tmp_path, monkeypatch):
    from nebari_pulse.config import DocsConfig, DocsSite

    monkeypatch.delenv("CLOUDFLARE_ANALYTICS_TOKEN", raising=False)
    monkeypatch.delenv("CLOUDFLARE_API_TOKEN", raising=False)
    cfg = DocsConfig(
        cloudflare_zone="nebari.dev", sites=(DocsSite("docs", "Docs", ("nebari.dev",)),)
    )
    res = cloudflare_docs.collect(cfg, tmp_path, TODAY)
    assert res.artifacts == 0 and not res.errors
    assert "CLOUDFLARE_ANALYTICS_TOKEN" in res.notes["skipped"]


def test_falls_back_to_the_deploy_token(monkeypatch):
    monkeypatch.delenv("CLOUDFLARE_ANALYTICS_TOKEN", raising=False)
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "deploy")
    assert cloudflare_docs.token() == "deploy"
    monkeypatch.setenv("CLOUDFLARE_ANALYTICS_TOKEN", "analytics")
    assert cloudflare_docs.token() == "analytics"
