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


def test_parse_origins_drops_internal_navigation():
    payload = {
        "data": {
            "viewer": {
                "zones": [
                    {
                        "referrers": [
                            {
                                "count": 50,
                                "dimensions": {
                                    "date": "2026-10-21",
                                    "clientRefererHost": "nebari.dev",
                                },
                            },
                            {
                                "count": 7,
                                "dimensions": {
                                    "date": "2026-10-21",
                                    "clientRefererHost": "WWW.nebari.dev",
                                },
                            },
                            {
                                "count": 12,
                                "dimensions": {
                                    "date": "2026-10-21",
                                    "clientRefererHost": "github.com",
                                },
                            },
                            {
                                "count": 9,
                                "dimensions": {"date": "2026-10-21", "clientRefererHost": ""},
                            },
                            {
                                "count": 1,
                                "dimensions": {"date": "2026-10-21", "clientRefererHost": None},
                            },
                        ],
                        "countries": [
                            {
                                "count": 40,
                                "dimensions": {"date": "2026-10-21", "clientCountryName": "US"},
                            },
                            {
                                "count": 3,
                                "dimensions": {"date": "2026-10-21", "clientCountryName": ""},
                            },
                        ],
                    }
                ]
            }
        }
    }
    referrers, countries = cloudflare_docs.parse_origins(payload, ("nebari.dev", "www.nebari.dev"))
    assert sorted(referrers, key=lambda r: r["referrer"]) == [
        {"date": "2026-10-21", "referrer": "(direct)", "pageviews": 10},
        {"date": "2026-10-21", "referrer": "github.com", "pageviews": 12},
    ]
    assert countries == [
        {"date": "2026-10-21", "country": "US", "pageviews": 40},
        {"date": "2026-10-21", "country": "XX", "pageviews": 3},
    ]
    assert cloudflare_docs.parse_origins({"data": {"viewer": {"zones": []}}}, ()) == ([], [])


TRAFFIC_PAYLOAD = {
    "data": {
        "viewer": {
            "zones": [
                {
                    "traffic": [
                        {
                            "count": 3,
                            "sum": {"visits": 1},
                            "dimensions": {
                                "date": "2026-10-22",
                                "clientRequestHTTPHost": "nebari.dev",
                            },
                        }
                    ],
                    "pages": [],
                }
            ]
        }
    }
}

COUNTRIES_PAYLOAD = {
    "data": {
        "viewer": {
            "zones": [
                {
                    "countries": [
                        {
                            "count": 4,
                            "dimensions": {"date": "2026-10-22", "clientCountryName": "DE"},
                        }
                    ]
                }
            ]
        }
    }
}

REFERRERS_PAYLOAD = {
    "data": {
        "viewer": {
            "zones": [
                {
                    "referrers": [
                        {
                            "count": 2,
                            "dimensions": {
                                "date": "2026-10-22",
                                "clientRefererHost": "github.com",
                            },
                        }
                    ]
                }
            ]
        }
    }
}


def run_docs(tmp_path, monkeypatch, responses):
    """Collect one site with post_json answered per query from `responses`."""
    from nebari_pulse.config import DocsConfig, DocsSite

    monkeypatch.setenv("CLOUDFLARE_ANALYTICS_TOKEN", "t")
    monkeypatch.setattr(cloudflare_docs, "zone_id", lambda name: "zone")

    def fake_post(url, body, headers):
        answer = responses[body["query"]]
        if isinstance(answer, Exception):
            raise answer
        return answer

    monkeypatch.setattr(cloudflare_docs, "post_json", fake_post)
    cfg = DocsConfig(
        cloudflare_zone="nebari.dev", sites=(DocsSite("docs", "Docs", ("nebari.dev",)),)
    )
    return cloudflare_docs.collect(cfg, tmp_path, TODAY)


def test_origins_failure_keeps_traffic(tmp_path, monkeypatch):
    from nebari_pulse.http import HttpError

    failure = HttpError("url", 500, "boom")
    res = run_docs(
        tmp_path,
        monkeypatch,
        {
            cloudflare_docs.QUERY: TRAFFIC_PAYLOAD,
            cloudflare_docs.REFERRERS_QUERY: failure,
            cloudflare_docs.COUNTRIES_QUERY: failure,
        },
    )
    assert res.artifacts == 1
    assert len(res.errors) == 2
    assert (tmp_path / "docs" / "traffic" / "docs.csv").exists()
    assert not (tmp_path / "docs" / "referrers" / "docs.csv").exists()
    assert not (tmp_path / "docs" / "countries" / "docs.csv").exists()


def test_referrer_field_denied_is_a_note_and_keeps_countries(tmp_path, monkeypatch):
    denied = {
        "data": None,
        "errors": [
            {
                "message": "zone 'abc' does not have access to the field "
                "'clientrefererhost' from the path"
            }
        ],
    }
    res = run_docs(
        tmp_path,
        monkeypatch,
        {
            cloudflare_docs.QUERY: TRAFFIC_PAYLOAD,
            cloudflare_docs.REFERRERS_QUERY: denied,
            cloudflare_docs.COUNTRIES_QUERY: COUNTRIES_PAYLOAD,
        },
    )
    assert res.errors == []
    assert "referrers_unavailable" in res.notes
    assert not (tmp_path / "docs" / "referrers" / "docs.csv").exists()
    rows = (tmp_path / "docs" / "countries" / "docs.csv").read_text().splitlines()
    assert rows == ["date,country,pageviews", "2026-10-22,DE,4"]


def test_country_failure_keeps_referrers(tmp_path, monkeypatch):
    from nebari_pulse.http import HttpError

    res = run_docs(
        tmp_path,
        monkeypatch,
        {
            cloudflare_docs.QUERY: TRAFFIC_PAYLOAD,
            cloudflare_docs.REFERRERS_QUERY: REFERRERS_PAYLOAD,
            cloudflare_docs.COUNTRIES_QUERY: HttpError("url", 500, "boom"),
        },
    )
    assert len(res.errors) == 1 and "countries" in res.errors[0]
    rows = (tmp_path / "docs" / "referrers" / "docs.csv").read_text().splitlines()
    assert rows == ["date,referrer,pageviews", "2026-10-22,github.com,2"]
    assert not (tmp_path / "docs" / "countries" / "docs.csv").exists()
