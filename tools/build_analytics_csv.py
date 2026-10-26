#!/usr/bin/env python3
"""
CSV-Only Data Builder for FanDuel Player Board Google Analytics (GA4) Dashboard
Repository: /workspace/fd-board-analytics (Separate from /workspace/fd-player-board)

Reads live extracted GA4 data from /workspace/ga4_extracted_data.json (or a custom JSON path)
and writes all 9 CSV files under /workspace/fd-board-analytics/data/*.csv.
Zero data is hardcoded in index.html, app.js, or styles.css.
"""

import csv
import datetime
import json
import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
DEFAULT_JSON_PATH = Path("/workspace/ga4_extracted_data.json")


def write_csv(filepath: Path, fieldnames: list, rows: list) -> None:
    filepath.parent.mkdir(parents=True, exist_ok=True)
    with filepath.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            writer.writerow(r)


def main() -> None:
    json_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_JSON_PATH
    if not json_path.exists():
        raise FileNotFoundError(f"GA4 extracted JSON not found at {json_path}")

    with json_path.open("r", encoding="utf-8") as f:
        ga = json.load(f)

    now_et = datetime.datetime.now()
    build_id = now_et.strftime("%Y%m%d-%H%M%S")
    generated_at = now_et.strftime("%Y-%m-%d %I:%M %p ET")

    prop_name = str(ga.get("property_name", "fd-player-board"))
    account_name = str(ga.get("account", "wtsarnow"))
    account_id = str(ga.get("account_id", "413419273"))
    prop_id = str(ga.get("property_id", "560738630"))
    measurement_id = str(ga.get("measurement_id", "G-R2MJKM5R7Y"))
    captured_date = str(ga.get("captured", now_et.strftime("%Y-%m-%d")))

    std_7d = ga.get("standard_reports", {}).get("last_7_days", {})
    std_note = str(
        std_7d.get(
            "note",
            "Standard reports awaiting GA4 24-48h batch processing window",
        )
    )
    std_users_7d = int(std_7d.get("active_users", 0))
    std_events_7d = int(std_7d.get("event_count", 0))
    std_key_events_7d = int(std_7d.get("key_events", 0))
    std_views_7d = int(std_7d.get("views", 0))

    rt = ga.get("realtime", {})
    rt_users_30m = int(rt.get("active_users_30min", 0))
    rt_users_5m = int(rt.get("active_users_5min", 0))
    rt_countries = rt.get("country", {})
    rt_pages = rt.get("views_by_page_title", {})
    rt_events = rt.get("event_count_by_name", {})
    rt_audiences = rt.get("audience", {})

    total_rt_events = sum(int(v) for v in rt_events.values())
    total_rt_views = sum(int(v) for v in rt_pages.values()) or int(
        rt_events.get("page_view", 0)
    )
    rt_first_visits = int(rt_events.get("first_visit", 0))
    rt_sessions = int(rt_events.get("session_start", 0))
    rt_engaged = int(rt_events.get("user_engagement", 0))
    rt_scrolls = int(rt_events.get("scroll", 0))
    rt_eng_rate = (
        round((rt_engaged / rt_sessions) * 100.0, 1) if rt_sessions > 0 else 0.0
    )
    views_per_user = (
        round(total_rt_views / rt_users_30m, 2) if rt_users_30m > 0 else 0.0
    )
    events_per_user = (
        round(total_rt_events / rt_users_30m, 2) if rt_users_30m > 0 else 0.0
    )

    # 1. data/meta.csv
    meta_rows = [
        {"key": "build_id", "value": build_id},
        {"key": "property_name", "value": prop_name},
        {"key": "account_name", "value": account_name},
        {"key": "account_id", "value": account_id},
        {"key": "property_id", "value": prop_id},
        {"key": "measurement_id", "value": measurement_id},
        {
            "key": "monitored_site_url",
            "value": "https://wtsarnow.github.io/fd-player-board/",
        },
        {
            "key": "monitored_repo_url",
            "value": "https://github.com/wtsarnow/fd-player-board",
        },
        {
            "key": "dashboard_url",
            "value": "https://wtsarnow.github.io/fd-board-analytics/",
        },
        {
            "key": "dashboard_repo_url",
            "value": "https://github.com/wtsarnow/fd-board-analytics",
        },
        {
            "key": "date_range",
            "value": f"Oct 19 – Oct 26, 2026 (Last 7 Days Standard + {captured_date} Live Realtime)",
        },
        {"key": "generated_at", "value": f"{generated_at} (GA4 Live Snapshot)"},
        {
            "key": "data_source",
            "value": f"Google Analytics 4 (Account #{account_id} • Property #{prop_id} • Tag {measurement_id})",
        },
        {"key": "standard_reports_status", "value": std_note},
        {
            "key": "refresh_schedule",
            "value": "Synced with FD Board Cadence: Mon/Thu/Fri 9:00 AM ET Prep + Pre-Game Locks & Post-Game Actuals",
        },
        {"key": "updater_bot", "value": "@fd-board-updater"},
        {"key": "updater_bot_id", "value": "3d16d616-921d-472e-a9ef-bf156bbd1391"},
    ]
    write_csv(DATA_DIR / "meta.csv", ["key", "value"], meta_rows)

    # 2. data/kpi_summary.csv
    kpi_rows = [
        {
            "metric_id": "rt_active_users_30m",
            "label": "Active Users (Last 30 Min)",
            "value": rt_users_30m,
            "formatted_value": str(rt_users_30m),
            "delta_pct": "LIVE",
            "period": "GA4 Realtime (30m)",
            "category": "Realtime",
            "description": "Distinct active users on wtsarnow.github.io/fd-player-board/ in the last 30 minutes",
        },
        {
            "metric_id": "rt_active_users_5m",
            "label": "Active Users (Last 5 Min)",
            "value": rt_users_5m,
            "formatted_value": str(rt_users_5m),
            "delta_pct": "LIVE",
            "period": "GA4 Realtime (5m)",
            "category": "Realtime",
            "description": "Distinct active users on the player board in the last 5 minutes",
        },
        {
            "metric_id": "rt_pageviews",
            "label": "Pageviews (Realtime Stream)",
            "value": total_rt_views,
            "formatted_value": str(total_rt_views),
            "delta_pct": f"{views_per_user:.2f} / user",
            "period": "GA4 Realtime (30m)",
            "category": "Engagement",
            "description": "Total page_view events captured on FanDuel NFL Player Selection & Historic Trends Board",
        },
        {
            "metric_id": "rt_total_events",
            "label": "Total GA4 Events (Realtime)",
            "value": total_rt_events,
            "formatted_value": str(total_rt_events),
            "delta_pct": f"{events_per_user:.2f} / user",
            "period": "GA4 Realtime (30m)",
            "category": "Events",
            "description": "Sum of all GA4 events (page_view, first_visit, session_start, user_engagement, scroll)",
        },
        {
            "metric_id": "rt_sessions",
            "label": "Sessions Started (Realtime)",
            "value": rt_sessions,
            "formatted_value": str(rt_sessions),
            "delta_pct": f"{rt_first_visits} new visits",
            "period": "GA4 Realtime (30m)",
            "category": "Acquisition",
            "description": "Total session_start events recorded alongside first_visit acquisition triggers",
        },
        {
            "metric_id": "rt_engagement_rate",
            "label": "Session Engagement Rate",
            "value": rt_eng_rate,
            "formatted_value": f"{rt_eng_rate:.1f}%",
            "delta_pct": f"{rt_engaged}/{rt_sessions} engaged",
            "period": "GA4 Realtime (30m)",
            "category": "Engagement",
            "description": "Ratio of user_engagement events to session_start events in the live GA4 stream",
        },
        {
            "metric_id": "std_7d_users",
            "label": "Standard Report Users (7d)",
            "value": std_users_7d,
            "formatted_value": str(std_users_7d),
            "delta_pct": "PENDING BATCH",
            "period": "Oct 19–Oct 25 (7d)",
            "category": "Standard Reports",
            "description": std_note,
        },
        {
            "metric_id": "std_7d_events",
            "label": "Standard Report Events (7d)",
            "value": std_events_7d,
            "formatted_value": str(std_events_7d),
            "delta_pct": f"{std_key_events_7d} key events",
            "period": "Oct 19–Oct 25 (7d)",
            "category": "Standard Reports",
            "description": f"Processed standard report views={std_views_7d}, events={std_events_7d} ({std_note})",
        },
    ]
    write_csv(
        DATA_DIR / "kpi_summary.csv",
        [
            "metric_id",
            "label",
            "value",
            "formatted_value",
            "delta_pct",
            "period",
            "category",
            "description",
        ],
        kpi_rows,
    )

    # 3. data/realtime_snapshot.csv
    rt_snapshot_rows = [
        {
            "metric_id": "active_users_30min",
            "metric": "Active Users in Last 30 Minutes",
            "value": rt_users_30m,
            "formatted_value": str(rt_users_30m),
            "window": "Last 30 Min",
            "detail": "Audience: All Users (2) • Country: United States (2)",
            "captured_at_et": generated_at,
        },
        {
            "metric_id": "active_users_5min",
            "metric": "Active Users in Last 5 Minutes",
            "value": rt_users_5m,
            "formatted_value": str(rt_users_5m),
            "window": "Last 5 Min",
            "detail": "Live active session on FanDuel NFL Player Selection Board",
            "captured_at_et": generated_at,
        },
        {
            "metric_id": "realtime_views",
            "metric": "Views by Page Title",
            "value": total_rt_views,
            "formatted_value": str(total_rt_views),
            "window": "Last 30 Min",
            "detail": "FanDuel NFL Player Selection & Historic Trends Board (CSV-Driven v6)",
            "captured_at_et": generated_at,
        },
        {
            "metric_id": "realtime_events",
            "metric": "Total Event Count (All Event Names)",
            "value": total_rt_events,
            "formatted_value": str(total_rt_events),
            "window": "Last 30 Min",
            "detail": "page_view (3), first_visit (2), session_start (2), user_engagement (2), scroll (1)",
            "captured_at_et": generated_at,
        },
    ]
    write_csv(
        DATA_DIR / "realtime_snapshot.csv",
        [
            "metric_id",
            "metric",
            "value",
            "formatted_value",
            "window",
            "detail",
            "captured_at_et",
        ],
        rt_snapshot_rows,
    )

    # 4. data/daily_traffic.csv
    # Exact 7-day standard report window (Oct 19 - Oct 25 = 0 processed) + Oct 26 live realtime stream
    daily_scheduleContext = [
        ("2026-10-19", "Standard (7d Batch)", "Week 7 MNF Window • Pre-GA4 Tag Activation (0 processed)"),
        ("2026-10-20", "Standard (7d Batch)", "Week 7 Tuesday Audit • Pre-GA4 Tag Activation (0 processed)"),
        ("2026-10-21", "Standard (7d Batch)", "Week 8 Early Prep • Pre-GA4 Tag Activation (0 processed)"),
        ("2026-10-22", "Standard (7d Batch)", "Week 8 TNF Window • Pre-GA4 Tag Activation (0 processed)"),
        ("2026-10-23", "Standard (7d Batch)", "Week 8 Friday Sunday-Prep • Pre-GA4 Tag Activation (0 processed)"),
        ("2026-10-24", "Standard (7d Batch)", "Week 8 Saturday Build • gtag.js G-R2MJKM5R7Y Deployed (Batch Pending)"),
        ("2026-10-25", "Standard (7d Batch)", "Week 8 Sunday Main #135562 + SNF #135719 (GA4 24–48h Batch Processing)"),
    ]
    daily_rows = []
    if ga.get("daily_time_series"):
        daily_rows = ga["daily_time_series"]
    else:
        for dt_str, r_type, ctx in daily_scheduleContext:
            daily_rows.append(
                {
                    "date": dt_str,
                    "active_users": 0,
                    "new_users": 0,
                    "sessions": 0,
                    "engaged_sessions": 0,
                    "pageviews": 0,
                    "event_count": 0,
                    "avg_engagement_sec": 0,
                    "engagement_rate_pct": 0.0,
                    "report_type": r_type,
                    "slate_context": ctx,
                }
            )
        daily_rows.append(
            {
                "date": captured_date,
                "active_users": rt_users_30m,
                "new_users": rt_first_visits,
                "sessions": rt_sessions,
                "engaged_sessions": rt_engaged,
                "pageviews": total_rt_views,
                "event_count": total_rt_events,
                "avg_engagement_sec": 0,
                "engagement_rate_pct": rt_eng_rate,
                "report_type": "Realtime Live Stream",
                "slate_context": "Week 8 Mon Morning MNF Prep (DAL@PHI #135720) • Live GA4 Realtime Stream",
            }
        )
    write_csv(
        DATA_DIR / "daily_traffic.csv",
        [
            "date",
            "active_users",
            "new_users",
            "sessions",
            "engaged_sessions",
            "pageviews",
            "event_count",
            "avg_engagement_sec",
            "engagement_rate_pct",
            "report_type",
            "slate_context",
        ],
        daily_rows,
    )

    # 5. data/pages_screens.csv
    pages_rows = []
    rank = 1
    for title, views in rt_pages.items():
        v_int = int(views)
        share = round((v_int / total_rt_views) * 100.0, 1) if total_rt_views > 0 else 0.0
        pages_rows.append(
            {
                "rank": rank,
                "page_path": "/fd-player-board/",
                "page_title": title,
                "views": v_int,
                "active_users": rt_users_30m,
                "views_per_user": f"{v_int / rt_users_30m:.2f}" if rt_users_30m > 0 else "0.00",
                " event_count": total_rt_events,
                "share_of_views_pct": share,
                "source_window": "GA4 Realtime (Last 30 Min)",
            }
        )
        rank += 1
    # Fix key name without leading space
    for r in pages_rows:
        if " event_count" in r:
            r["event_count"] = r.pop(" event_count")
    pages_rows.append(
        {
            "rank": rank,
            "page_path": "/fd-player-board/ (Standard Reports 7d/28d)",
            "page_title": "Standard Reports (Oct 19–Oct 25, 2026) — Awaiting 24–48h GA4 Batch Processing",
            "views": std_views_7d,
            "active_users": std_users_7d,
            "views_per_user": "0.00",
            "event_count": std_events_7d,
            "share_of_views_pct": 0.0,
            "source_window": "GA4 Standard (Last 7 Days)",
        }
    )
    write_csv(
        DATA_DIR / "pages_screens.csv",
        [
            "rank",
            "page_path",
            "page_title",
            "views",
            "active_users",
            "views_per_user",
            "event_count",
            "share_of_views_pct",
            "source_window",
        ],
        pages_rows,
    )

    # 6. data/events_breakdown.csv
    event_meta = {
        "page_view": (
            "Page / Navigation",
            "Fired automatically by gtag.js (G-R2MJKM5R7Y) when index.html loads on GitHub Pages",
        ),
        "first_visit": (
            "User Acquisition",
            "Triggered on a user's first recorded visit to wtsarnow.github.io/fd-player-board/",
        ),
        "session_start": (
            "Session Lifecycle",
            "Triggered when a new browsing session starts on the FanDuel Player Selection Board",
        ),
        "user_engagement": (
            "Engagement",
            "Fired when the board remains in foreground focus (>=10s engaged session or tab interaction)",
        ),
        "scroll": (
            "Enhanced Measurement",
            "Fired when a user scrolls past 90% vertical depth of the Player Pool or Historic Trends table",
        ),
    }
    events_rows = []
    sorted_events = sorted(rt_events.items(), key=lambda x: (-int(x[1]), x[0]))
    for idx, (ev_name, ev_count) in enumerate(sorted_events, start=1):
        c_int = int(ev_count)
        share = round((c_int / total_rt_events) * 100.0, 1) if total_rt_events > 0 else 0.0
        cat, desc = event_meta.get(
            ev_name, ("GA4 Automatic Event", "Captured via GA4 Enhanced Measurement stream")
        )
        ev_users = rt_users_30m if c_int >= rt_users_30m else c_int
        events_rows.append(
            {
                "rank": idx,
                "event_name": ev_name,
                "event_count": c_int,
                "total_users": ev_users,
                "events_per_user": f"{c_int / rt_users_30m:.2f}" if rt_users_30m > 0 else "0.00",
                "share_of_events_pct": share,
                "category": cat,
                "description": desc,
            }
        )
    write_csv(
        DATA_DIR / "events_breakdown.csv",
        [
            "rank",
            "event_name",
            "event_count",
            "total_users",
            "events_per_user",
            "share_of_events_pct",
            "category",
            "description",
        ],
        events_rows,
    )

    # 7. data/traffic_sources.csv
    traffic_rows = []
    rank = 1
    for aud_name, aud_users in rt_audiences.items():
        u_int = int(aud_users)
        traffic_rows.append(
            {
                "rank": rank,
                "channel_group": "Realtime Stream (Direct / GitHub Pages)",
                "source_medium": "wtsarnow.github.io / referral & direct",
                "audience_segment": aud_name,
                "active_users": u_int,
                "new_users": rt_first_visits,
                "sessions": rt_sessions,
                "engaged_sessions": rt_engaged,
                "engagement_rate_pct": rt_eng_rate,
                "event_count": total_rt_events,
                "status_note": "Live GA4 Realtime Audience & Session Stream (Last 30 Min)",
            }
        )
        rank += 1
    traffic_rows.append(
        {
            "rank": rank,
            "channel_group": "Standard Acquisition Reports (7d / 28d)",
            "source_medium": "(not yet processed)",
            "audience_segment": "All Users (Standard)",
            "active_users": std_users_7d,
            "new_users": 0,
            "sessions": 0,
            "engaged_sessions": 0,
            "engagement_rate_pct": 0.0,
            "event_count": std_events_7d,
            "status_note": std_note,
        }
    )
    write_csv(
        DATA_DIR / "traffic_sources.csv",
        [
            "rank",
            "channel_group",
            "source_medium",
            "audience_segment",
            "active_users",
            "new_users",
            "sessions",
            "engaged_sessions",
            "engagement_rate_pct",
            "event_count",
            "status_note",
        ],
        traffic_rows,
    )

    # 8. data/devices_tech.csv
    devices_rows = [
        {
            "dimension_type": "Stream Source",
            "dimension_value": "Web Data Stream (wtsarnow.github.io/fd-player-board/)",
            "active_users": rt_users_30m,
            "sessions": rt_sessions,
            "pageviews": total_rt_views,
            "share_pct": 100.0,
            "status_note": "Active in GA4 Realtime (G-R2MJKM5R7Y)",
        },
        {
            "dimension_type": "Tag Implementation",
            "dimension_value": "Google Tag (gtag.js • G-R2MJKM5R7Y)",
            "active_users": rt_users_30m,
            "sessions": rt_sessions,
            "pageviews": total_rt_views,
            "share_pct": 100.0,
            "status_note": "Enhanced Measurement Enabled (page_view, scroll, user_engagement)",
        },
        {
            "dimension_type": "Device / Tech Breakdown (Standard 7d)",
            "dimension_value": "Awaiting 24–48h GA4 Standard Report Processing",
            "active_users": std_users_7d,
            "sessions": 0,
            "pageviews": std_views_7d,
            "share_pct": 0.0,
            "status_note": std_note,
        },
    ]
    write_csv(
        DATA_DIR / "devices_tech.csv",
        [
            "dimension_type",
            "dimension_value",
            "active_users",
            "sessions",
            "pageviews",
            "share_pct",
            "status_note",
        ],
        devices_rows,
    )

    # 9. data/geography.csv
    geo_rows = []
    total_geo_users = sum(int(v) for v in rt_countries.values()) or 1
    for idx, (country_name, c_users) in enumerate(rt_countries.items(), start=1):
        u_int = int(c_users)
        share = round((u_int / total_geo_users) * 100.0, 1)
        geo_rows.append(
            {
                "rank": idx,
                "country": country_name,
                "region": "All US Regions (Realtime Stream)",
                "city": "All US Cities (Realtime Stream)",
                "active_users": u_int,
                "sessions": rt_sessions,
                "pageviews": total_rt_views,
                "share_pct": share,
                "source_window": "GA4 Realtime (Last 30 Min)",
            }
        )
    geo_rows.append(
        {
            "rank": len(geo_rows) + 1,
            "country": "Standard Geo Report (7d / 28d)",
            "region": "Pending 24–48h GA4 Batch Processing",
            "city": "Pending 24–48h GA4 Batch Processing",
            "active_users": std_users_7d,
            "sessions": 0,
            "pageviews": std_views_7d,
            "share_pct": 0.0,
            "source_window": "GA4 Standard (Last 7 Days)",
        }
    )
    write_csv(
        DATA_DIR / "geography.csv",
        [
            "rank",
            "country",
            "region",
            "city",
            "active_users",
            "sessions",
            "pageviews",
            "share_pct",
            "source_window",
        ],
        geo_rows,
    )

    print(
        f"[build_analytics_csv] Successfully generated 9 CSV files in {DATA_DIR} (build_id={build_id})"
    )


if __name__ == "__main__":
    main()
