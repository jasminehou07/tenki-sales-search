# TENKI Dashboard Handoff

This folder is the handoff point for the Rakuten/TENKI sales dashboard. It is meant to let TENKI continue running, editing, and rebuilding the project after the internship.

## Live URLs

- Dashboard: https://172.237.20.132.sslip.io/
- API health check: https://172.237.20.132.sslip.io/health
- API base: https://172.237.20.132.sslip.io/api

## Main Server Paths

- Production app root: `/opt/tenki-dashboard`
- Company source handoff folder: `/root/src/tenki-sales-search`
- Served frontend files: `/opt/tenki-dashboard/site-data`
- Node dashboard/API server: `/opt/tenki-dashboard/api/server.js`
- Postgres database: `tenki_dashboard`
- Dashboard parquet outputs: `/opt/tenki-dashboard/parquet`
- Data-loading scripts: `/opt/tenki-dashboard/scripts`

## Handoff Folder Layout

The server handoff folder is organized like this:

```text
/root/src/tenki-sales-search/
  README.md
  site/
    index.html
    app.js
    styles.css
    scripts/
  api/
    package.json
    package-lock.json
    server.js
  scripts/
    load_dashboard_chunks_streaming.py
    load_dashboard_chunks_to_postgres.py
    load_rank_chunks_batched.py
    load_raw_parquet_to_postgres.py
  sql/
    schema.sql
    dashboard_queries.sql
    create_validation_holdout_predictions.sql
    per_genre_validation.sql
  config/
    env.template
  data-links/
    parquet -> /opt/tenki-dashboard/parquet
    generated-csv -> /opt/tenki-dashboard/site-data/data
    events -> /root/events
    genre-ranking -> /root/genre-ranking
    genre-sales -> /root/genre-sales
```

The handoff folder intentionally links to the existing large parquet data instead of duplicating it. This keeps the server from storing the same multi-GB data twice.

## What Each Part Does

- `site/`: the browser dashboard UI. This is what users see.
- `api/`: the Node/Express API that the dashboard calls. It queries Postgres and returns JSON/CSV responses.
- `scripts/`: Python import/build scripts used to load parquet outputs into Postgres.
- `sql/`: database schema, indexes, and useful dashboard queries.
- `config/env.template`: shows the environment variables needed to run the API. The real `.env` stays in the production app folder and should not be committed publicly.
- `data-links/parquet`: points to the generated parquet output files on the server.
- `data-links/generated-csv`: points to the older generated CSV chunks used by compatibility API routes.
- `data-links/events`: points to the source event/promotion files.
- `data-links/genre-ranking`: points to the source top-ranking item files.
- `data-links/genre-sales`: points to the source sales files.

## API Endpoints Used By The Dashboard

- `/api/options/genres`
- `/api/options/shops`
- `/api/genre/summary`
- `/api/genre/rank-rows`
- `/api/genre/rank-projection`
- `/api/shop/summary`
- `/api/shop/genres`
- `/api/top-items`
- `/api/top-shops`
- `/api/events`
- `/api/metrics/wmape`
- `/api/model-validation`

The older `/api/data/*.csv` endpoints are compatibility endpoints for parts of the frontend that still expect CSV-shaped data.

## Running The API

From the server:

```bash
cd /root/src/tenki-sales-search/api
npm install
node server.js
```

In production, this Node process runs the API on localhost port `3100`, and nginx serves the public SSLIP dashboard plus proxies `/api` and `/health` to Node.

## Database

The dashboard data is stored in Postgres in the `tenki_dashboard` database. Important tables include:

- `genres`
- `shops`
- `dashboard_genre_daily`
- `dashboard_genre_rank_daily`
- `dashboard_rank_rows`
- `dashboard_shop_daily`
- `dashboard_shop_genre_daily`
- `model_validation_metrics`
- `model_validation_holdout_predictions`
- `raw_genre_rankings`
- `raw_genre_sales`

The dashboard should call the API, not connect directly to Postgres from the browser.

## Updating The Website

After editing frontend files, copy them into:

```text
/opt/tenki-dashboard/site-data/
```

If editing API code, update:

```text
/opt/tenki-dashboard/api/server.js
```

Then restart the API process if needed.

## Notes

- Keep private TENKI data and secrets off GitHub.
- The public GitHub Pages URL points users to the server dashboard.
- The server source handoff lives in `/root/src/tenki-sales-search` so TENKI can keep or rebuild the project after the internship.
- The production app still runs from `/opt/tenki-dashboard`; `/root/src/tenki-sales-search` is the reproducible source handoff folder.
- The server is the current source of truth for Postgres-backed dashboard behavior.
