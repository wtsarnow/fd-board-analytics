# FanDuel Player Board • Google Analytics (GA4) Telemetry Dashboard

Standalone, 100% CSV-driven Google Analytics 4 (`G-R2MJKM5R7Y`) dashboard monitoring [`https://wtsarnow.github.io/fd-player-board/`](https://wtsarnow.github.io/fd-player-board/).

## Architecture & Conventions
- **Separate Repository & URL**: Hosted independently from `fd-player-board` so the player board repository and URL remain untouched.
- **Zero Hardcoded Data in Code**: `index.html`, `app.js`, and `styles.css` contain zero hardcoded analytics numbers, dates, or table rows. Every metric is loaded at runtime via `fetch('data/*.csv', { cache: 'no-store' })` keyed by `data/meta.csv`'s `build_id`.
- **CSV-Only Data Publishes**: Running `python3 tools/build_analytics_csv.py` reads `/workspace/ga4_extracted_data.json` and regenerates all 9 CSV files in `data/*.csv`:
  1. `data/meta.csv`
  2. `data/kpi_summary.csv`
  3. `data/realtime_snapshot.csv`
  4. `data/daily_traffic.csv`
  5. `data/pages_screens.csv`
  6. `data/events_breakdown.csv`
  7. `data/traffic_sources.csv`
  8. `data/devices_tech.csv`
  9. `data/geography.csv`
