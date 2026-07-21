# TENKI Server and Database Audit

Audit date: 2026-07-21 (Asia/Tokyo)

Scope: TENKI dashboard frontend, Node API, nginx, PostgreSQL, generated parquet/CSV data, raw ranking/sales/event data, model-validation assets, handoff source, and reproducibility.

## Audit status and evidence limits

The public HTTPS deployment/API, the local Git repository, and the current SSH server/PostgreSQL deployment were inspected live and read-only. This included runtime versions, filesystem sizes and counts, source/handoff folders, parquet outputs, nginx routing, listening processes, systemd service configuration/status, PostgreSQL relation sizes/statistics, exact dashboard-table counts/date ranges, and validation metrics.

Evidence labels used below:

- **Live verified:** observed from the public HTTPS/API deployment or the current SSH/PostgreSQL host on 2026-07-21.
- **Repository verified:** read from the current local Git working tree.
- **Documented/inferred:** derived from checked-in scripts or configuration rather than executed as a rebuild or restore.

PostgreSQL planner row estimates and exact `COUNT(*)` results are reported separately because statistics estimates can be slightly stale. Exact live index definitions, index usage/bloat, backup validity, and a clean-host rebuild were not tested.

No server files, services, processes, database rows, or configuration were changed. No secret values were read or recorded.

## Executive summary

- **Live verified:** `https://172.237.20.132.sslip.io/` returned HTTP 200 through nginx 1.24.0 on Ubuntu.
- **Live verified:** `https://172.237.20.132.sslip.io/health` returned `ok: true`, proving nginx could reach the Node API and the API could execute a PostgreSQL query.
- **Live verified:** the host runs Ubuntu 24.04.4, Node.js 18.19.1, npm 9.2.0, Python 3.12.3, and PostgreSQL 16.14.
- **Live verified:** the deployed database/API exposed 1,100 active genres and 1,810 active shops.
- **Live verified:** exact dashboard data ranges extend from 2018-10-01 or 2020-01-01 through 2026-05-27 or 2026-05-31, depending on the table.
- **Live verified:** PostgreSQL holds approximately 30 GB of raw ranking data, 20 GB of raw sales data, 20 GB of dashboard rank rows, and 18 GB of genre-rank daily output.
- **Live verified:** `/opt/tenki-dashboard` is 9.7 GB at the filesystem level; legacy site data is 5.8 GB and generated parquet includes a 1.3 GB rank-batch folder.
- **Live verified:** model validation exposed 98,421 holdout samples across 2,263 dates and an overall genre sales WMAPE of about 57.06%.
- **Critical gap:** only genre model metrics are stored in the visible validation metrics result. No independent shop or units WMAPE was returned by `/api/metrics/wmape`.
- **Critical bug/gap:** a date-scoped request labeled as `Shop sales model` returned the same 56.03% metric and 44,483 samples as the genre holdout query. The route relabels genre holdout rows as shop results when no shop is selected; it is not an independently validated shop model.
- **Critical reproducibility gap:** the checked-in files do not contain a complete model-training pipeline. The included Python scripts reshape already-generated CSV outputs, and the SQL validation scripts use rank/group averages. There is no checked-in XGBoost/gradient-boosted-tree training script, feature builder, hyperparameter file, serialized model, package lock for Python, or end-to-end raw-to-model command.
- **Critical operations issue:** two Node API processes/configurations coexist. nginx proxies to a manually launched process on `127.0.0.1:3100`, while enabled `tenki-dashboard-api.service` reports listening on `0.0.0.0:3000` and had restarted 568 times before its current start.
- **Handoff status:** deployed site files and `/root/src/tenki-sales-search/site` match exactly by SHA256. They may differ from local uncommitted `index.html` and `app.js` changes.

## Current architecture

```text
Browser
  -> HTTPS 443: nginx (public SSLIP host)
     -> static frontend files
     -> /api/* and /health reverse proxy
        -> manual/orphan Node API PID 909856 on 127.0.0.1:3100
           -> PostgreSQL database: tenki_dashboard
           -> legacy CSV compatibility routes under /api/data/*

Enabled systemd service (currently separate from nginx upstream)
  -> tenki-dashboard-api.service
     -> Node API reported on 0.0.0.0:3000

Raw parquet inputs and generated parquet/CSV outputs
  -> import/build scripts
  -> PostgreSQL dashboard tables/materialized views
  -> Node API JSON/CSV responses
  -> browser charts, tables, dropdowns, and validation page
```

The browser does not connect directly to PostgreSQL. The API uses parameterized SQL and returns JSON or compatibility CSV. Runtime configuration comes from `/opt/tenki-dashboard/.env`; only variable names were inventoried, never values.

## Public services and ports

| Component | Address/port | Status | Evidence |
|---|---:|---|---|
| nginx HTTPS | public TCP 443 | Healthy | Live HTTP 200; `Server: nginx/1.24.0 (Ubuntu)` |
| Dashboard | `https://172.237.20.132.sslip.io/` | Healthy | Live verified |
| API health | `/health` | Healthy | Live response included `ok: true` and a database timestamp |
| API | `/api/*` | Healthy for sampled routes | Genres, shops, summaries, and validation returned database-backed results |
| nginx HTTP/HTTPS | TCP 80 and 443 | Active | nginx config serves `/opt/tenki-dashboard/site-data` and proxies API routes |
| nginx API upstream | `127.0.0.1:3100` | Healthy but manually managed | PID 909856 listens on loopback and currently serves the live API |
| `tenki-dashboard-api.service` | reported `0.0.0.0:3000` | Enabled/active but not nginx upstream | Unit had 568 restarts before current start |
| PostgreSQL 16.14 | local database service | Active | Exact SQL counts and relation statistics queried successfully |

The confirmed systemd unit uses:

- `WorkingDirectory=/opt/tenki-dashboard/api`
- `EnvironmentFile=/opt/tenki-dashboard/.env`
- `ExecStart=node server.js`
- `Restart=always`
- `User=root`

The coexistence of ports 3000 and 3100 is the main recovery risk: restarting `tenki-dashboard-api.service` alone does not currently guarantee recovery of the nginx upstream on port 3100. Running the service as root and reporting `0.0.0.0:3000` also increases exposure compared with a dedicated unprivileged user bound to loopback.

## Server filesystem inventory

### Production paths

These paths were verified through read-only SSH:

| Path | Size | Purpose/status |
|---|---:|---|
| `/opt/tenki-dashboard` | 9.7 GB | Production application root |
| `/opt/tenki-dashboard/.env` | not recorded | Private runtime configuration; never commit or copy into this audit |
| `/opt/tenki-dashboard/api/server.js` | not recorded | Production Node/Express API |
| `/opt/tenki-dashboard/site-data` | not recorded | Static frontend and legacy generated CSV assets |
| `/opt/tenki-dashboard/site-data/data` | 5.8 GB | Legacy/compatibility CSV data served through `/api/data/*` |
| `/opt/tenki-dashboard/parquet` | not recorded | Generated dashboard parquet outputs |
| `/opt/tenki-dashboard/scripts` | not recorded | Server import/build scripts |
| `/opt/tenki-dashboard/dashboard-api3100.log` | not recorded | Expected log for the documented `nohup` API launch |
| `/root/src` | 6.8 MB | Company source-code root |
| `/root/src/tenki-sales-search` | 6.7 MB | Dashboard/API source-code handoff |
| `/root/src/model generation` | 88 KB | Small model/data-generation handoff |

### Raw source paths

| Path | Files | Size | Status |
|---|---:|---:|---|
| `/root/events` | 1 | 24 KB | Present |
| `/root/genre-ranking` | 1,100 | 456 MB | Present |
| `/root/genre-sales` | 1,100 | 585 MB | Present |
| `/root/genre-ranking2` | - | - | No longer exists |
| `/root/genre-ranking3` | - | - | No longer exists |
| `/root/genre-sales2` | - | - | No longer exists |
| `/root/genre-sales3` | - | - | No longer exists |

The raw ranking files are understood to contain Rakuten top-ranked item identities/ranks. Sales files contain known TENKI-linked item observations such as sales and units. They should not be described as complete sales data for every ranked Rakuten item.

### Generated parquet paths

| Output | Files | Size | Notes |
|---|---:|---:|---|
| `dashboard_genre_daily` chunks | 92 | 34 MB | A separate consolidated genre-daily parquet file is 26 MB |
| `dashboard_genre_rank_daily` | not recorded | 74 MB | Generated genre/rank daily output |
| `dashboard_genre_rank_daily_batches` | 56 | 1.3 GB | Largest verified parquet folder |
| `dashboard_shop_daily` | 92 | 23 MB | Generated shop daily output |
| `dashboard_shop_genre_daily` | 92 | 93 MB | Generated shop/genre daily output |

### Handoff links

`/root/src/model generation` contains only:

- `README.md`;
- one environment-variable template;
- two Python chunk builders;
- four SQL files;
- two API patch tools;
- data links for `events`, `genre-ranking`, `genre-sales`, `generated-csv`, and `parquet`.

It does not contain numbered raw-data links, because those numbered source directories no longer exist. The links avoid duplicating multi-gigabyte data, but the 88 KB folder is a thin handoff rather than a self-contained model build.

### Production loader scripts

The following files exist in `/opt/tenki-dashboard/scripts`:

- `load_dashboard_chunks_streaming.py`
- `load_dashboard_chunks_to_postgres.py`
- `load_rank_chunks_batched.py`
- `load_raw_parquet_to_postgres.py`

They are production-only in the current layout: they are missing from both the Git repository and the source handoff, so a clean replacement server cannot reproduce database loading from the handoff alone.

## PostgreSQL schema inventory

PostgreSQL 16.14 is active and the principal raw, dashboard, and validation relations were queried directly. The checked-in `backend/schema.sql` documents the intended structure; live relation sizes/statistics and exact dashboard-table counts are recorded below.

### Base/reference tables

- `genres`
- `shops`
- `promotion_events`
- `event_daily_features`

### Raw imported tables

- `raw_genre_rankings`
- `raw_genre_sales`

### Dashboard/model output tables

- `dashboard_genre_daily`
- `dashboard_genre_rank_daily`
- `dashboard_rank_rows`
- `dashboard_shop_daily`
- `dashboard_shop_genre_daily`

### Validation tables

- `model_validation_metrics`
- `model_validation_holdout_predictions` (created by a separate SQL script and missing from `schema.sql`)

### Materialized views

- `mv_dashboard_all_genres_daily`
- `mv_dashboard_all_shops_daily`

### Intended indexes

The schema declares indexes for:

- raw rank lookups by date/genre/rank, genre/shop/date, and shop/date;
- raw sales lookups by date/genre, genre/date/shop, and shop/date;
- event date/genre and event time ranges;
- dashboard genre/date/rank and shop/date filters;
- `dashboard_rank_rows` by genre/date/rank, date/sales, and date/rank;
- dropdown ordering by descending sales;
- materialized-view unique keys;
- validation metric uniqueness.

The validation holdout script additionally declares indexes on validation date, genre/date, shop/date, and model/entity. This audit verified the deployed database and relations, but did not retain a full live `pg_indexes` listing or index usage/bloat report; the bullets above remain the intended index inventory from source.

### Relation sizes and PostgreSQL statistics estimates

`n_live_tup`/catalog statistics are estimates and can lag writes or `ANALYZE`. They should not be expected to match exact `COUNT(*)` values perfectly.

| Relation/audit label | Statistics row estimate | Total size |
|---|---:|---:|
| Raw rankings (`raw_rankings`; checked-in schema names this `raw_genre_rankings`) | 107,566,125 | 30 GB |
| Raw sales (`raw_sales`; checked-in schema names this `raw_genre_sales`) | 83,024,095 | 20 GB |
| `dashboard_rank_rows` | 107,700,117 | 20 GB |
| `dashboard_genre_rank_daily` | 67,420,870 | 18 GB |
| `dashboard_shop_genre_daily` | 14,986,481 | 3,869 MB |
| `dashboard_genre_daily` | 2,323,362 | 831 MB |
| `dashboard_shop_daily` | 1,152,903 | 376 MB |
| Validation actual temporary relation | 1,978,520 | 205 MB |
| `model_validation_holdout_predictions` | 98,421 | 23 MB |
| `model_validation_metrics` | 3,286 | size not recorded |

The reported raw relation labels differ from the names in the checked-in schema. Preserve the actual catalog names in the next schema export so rebuild scripts and documentation use one naming convention.

### Exact dashboard counts and date ranges

| Relation | Exact `COUNT(*)` | Minimum date | Maximum date |
|---|---:|---|---|
| `dashboard_genre_daily` | 2,323,362 | 2020-01-01 | 2026-05-27 |
| `dashboard_genre_rank_daily` | 67,424,000 | 2018-10-01 | 2026-05-31 |
| `dashboard_rank_rows` | 107,705,505 | 2020-01-01 | 2026-05-27 |
| `dashboard_shop_daily` | 1,152,903 | 2018-10-01 | 2026-05-31 |
| `dashboard_shop_genre_daily` | 14,988,296 | 2018-10-01 | 2026-05-31 |

The small differences between these exact counts and the statistics estimates are normal planner-statistics drift, not evidence of missing rows.

## Live API and validation inventory

These values combine public API responses with direct read-only PostgreSQL results. Physical dashboard-table counts and ranges are in the preceding section.

| Dataset/route | Live result |
|---|---:|
| Active genres (`/api/options/genres`) | 1,100 |
| Genres with positive dropdown sales | 1,100 |
| Active shops (`/api/options/shops`) | 1,810 |
| Shops with positive dropdown sales | 1,761 |
| Genre dates (`filter_options.csv`) | 2,329 |
| Genre minimum date | 2020-01-01 |
| Genre maximum date | 2026-05-27 |
| All-genre rollup date rows | 2,329 |
| All-shop rollup date rows in 2017-01-01..2026-12-31 query | 2,800 |
| Latest validation metric rows returned | 3,286 |
| WMAPE rows | 1,096 |
| Median APE rows | 1,095 |
| Within-25% rows | 1,095 |
| Holdout samples | 98,421 |
| Holdout dates | 2,263 |
| Holdout minimum date | 2020-01-01 |
| Holdout maximum date | 2026-05-27 |

All 3,286 rows in `model_validation_metrics` are for model version `rank-validation-20260721`, model name `Genre sales model`, and entity type `genre`. No independently stored shop-model or units-model validation rows were found.

| Metric | Metric rows | Sum of `sample_size` | Interpretation |
|---|---:|---:|---|
| WMAPE | 1,096 | 196,842 | 1 overall row plus 1,095 per-genre rows; samples are intentionally counted twice when summed across both levels |
| Median APE | 1,095 | 98,421 | Per-genre rows only |
| Within 25% | 1,095 | 98,421 | Per-genre rows only |

The live overall genre sales validation result was approximately **57.06% WMAPE** on 98,421 holdout rows. A second broad date-range query returned approximately 56.03% on 44,483 samples because it covered a shorter requested period.

## API inventory

### JSON routes

- `/health`
- `/api/options/genres`
- `/api/options/shops`
- `/api/genre/summary`
- `/api/genre/trend`
- `/api/genre/ranks`
- `/api/genre/rank-rows`
- `/api/genre/rank-projection`
- `/api/shop/daily`
- `/api/shop/genre-daily`
- `/api/shop/summary`
- `/api/shop/genres`
- `/api/top-items`
- `/api/top-shops`
- `/api/events`
- `/api/metrics/wmape`
- `/api/model-validation`

### Compatibility CSV routes

The API also produces or serves CSV-shaped data under `/api/data/*`, including monthly rank summaries, trend estimates, ranked items by genre, shop summaries/estimates, item data, and all-time rollups.

The frontend is therefore still hybrid rather than fully SQL/JSON. It uses JSON for rank rows, genre trends, shop daily/genre data, top shops/items, and validation, while many filter, event, curve, monthly, and all-time resources still use `/api/data/*.csv` routes.

## Model generation and validation audit

### What is reproducible from the checked-in files

`scripts/build_rank_chunks.py`:

- reads already-generated monthly ranked-shop CSV files;
- keeps ranks 1-80 with positive sales and non-empty shop/item IDs;
- writes per-genre monthly CSV chunks;
- constructs `all`, and `all-items` outputs;
- does not train a statistical or machine-learning model.

`scripts/build_shop_summary_chunks.py`:

- reads already-generated shop-estimate CSVs;
- sums sales, units, page views, and confidence bounds by date/shop;
- writes monthly and all-time shop summaries;
- does not train a model.

`backend/create_validation_holdout_predictions.sql` and `backend/per_genre_validation.sql`:

- deterministically hide about 5% of known rank-sales rows using a hash modulo 20;
- train on the remaining approximately 95%;
- predict hidden sales from genre-rank averages, genre-group/rank averages, global-rank averages, and fallbacks;
- split genres into high-data, medium-data, and small/niche groups;
- compute WMAPE, Median APE, and percentage within 25%;
- do not use XGBoost, gradient-boosted trees, KNN, lagged history, promotion intensity, seasonal features, or serialized model artifacts.

### What is not reproducible from the checked-in files

- the code that generated the principal `estimated_sales_yen` and confidence intervals in dashboard daily/rank tables;
- the code that generated shop-level predictions and confidence intervals;
- the units-sold model training pipeline;
- XGBoost/gradient-boosted-tree feature engineering, fitting, tuning, and inference;
- outlier detection/replacement logic used before final rank estimates;
- event/promotion feature generation from raw event files;
- genre hierarchy/name mapping generation;
- the production parquet-to-PostgreSQL loader scripts, which exist under `/opt/tenki-dashboard/scripts` but are absent from Git and `/root/src`;
- exact model versions, random seeds, hyperparameters, dependency versions, and training environment;
- model artifact files, feature schemas, and a manifest tying each database row to a model build;
- a single tested command that rebuilds final database tables from raw inputs.

### Path problems in the current generation scripts

The checked-in rank script expects its input at a relative `../work/ranked-shops` location, not the documented `data-links` path. The shop summary script expects `data/shop-estimates-by-month`. Unless the server handoff adds matching directories/symlinks, the documented rerun steps are incomplete.

### Verified server Python environment

The system Python is 3.12.3. Of the queried model/data dependencies, only `pandas` 2.1.4 was reported. The system Python did not report installed packages for:

- `pyarrow`;
- `scikit-learn`;
- `xgboost`;
- `duckdb`;
- `psycopg`.

This does not rule out a separate virtual environment, container, alternate interpreter, or Node-side database loading, but none is documented in the 88 KB model-generation handoff. A reproducible build must identify the exact interpreter/environment and include a locked dependency file.

## Configuration and security observations

- The API uses Helmet, compression, a 1 MB JSON body limit, parameterized SQL, and a PostgreSQL connection pool capped at 10 clients.
- The live nginx upstream is a Node process bound to `127.0.0.1:3100`, which is appropriate behind nginx. The separate systemd-managed process reports `0.0.0.0:3000` and should be reconciled.
- The browser receives only API responses and does not receive database credentials.
- The runtime `.env` is outside Git. Only these variable names were inventoried: `API_DATABASE_URL`, `CORS_ORIGIN`, `DATABASE_URL`, `MODEL_VERSION`, `PORT`, and `SITE_ROOT`. Values were not read or recorded.
- **Mismatch:** `server.js` reads `API_DATABASE_URL`, while `backend/env.template` documents `DATABASE_URL`. A fresh deployment following the template can fail until these names are made consistent.
- **Mismatch:** the template uses `MODEL_VERSION=production-current`, while `server.js` falls back to `github-pages-current` if the variable is absent. The actual model version values in PostgreSQL must match the runtime setting or queries can return no rows.
- The default CORS origin in code points to the old GitHub Pages origin, while the template points to SSLIP. The deployed `.env` likely supplies the working origin, but this should be explicit in a non-secret configuration checklist.
- No API authentication is visible for dashboard read routes. This may be intentional for a public dashboard, but it means anyone who can reach the URL can query the exposed aggregate endpoints.
- `tenki-dashboard-api.service` runs as root. It should use a dedicated service account with only the filesystem and database permissions required by the API.
- Raw private TENKI data must remain outside the public site root and Git repository.

## Deployment drift and local-repository discrepancies

At audit time:

- local Git HEAD was `5cbf687` (`Document server restart and model rerun steps`);
- local `index.html` and `app.js` were modified but uncommitted;
- deployed `index.html` referenced `app.js?v=20260721-sslip-return`;
- deployed frontend files and `/root/src/tenki-sales-search/site` matched each other exactly by SHA256;
- deployed `index.html` and `app.js` checksums differed from the local uncommitted working tree;
- deployed and local `styles.css` checksums matched exactly;
- the Git repository tracks no `data/` files because `data/` is ignored;
- all four PostgreSQL loader scripts named by `HANDOFF.md` exist in `/opt/tenki-dashboard/scripts`, but none exists in Git or the `/root/src` source handoff;
- `README.md` says the model-generation folder has everything needed to rerun outputs, but the checked-in files do not provide an end-to-end model build;
- `/root/src/model generation` is only 88 KB and contains a thin set of two chunk builders, four SQL files, two API patch tools, documentation/config template, and data links;
- `backend/create_server_handoff.sh` still builds `/opt/tenki-dashboard-handoff`, while current documentation says the company handoff is `/root/src/tenki-sales-search` and `/root/src/model generation`;
- the main raw folders each contain 1,100 files, but the former numbered ranking/sales directories no longer exist and should be removed from stale documentation/scripts;
- the API supports many legacy CSV routes, so removing generated CSV assets before migrating every frontend dependency would break the dashboard.

## Service status and recovery commands

The service/process checks were read-only; no restart command was executed.

### Current split-brain API state

`tenki-dashboard-api.service` is enabled and configured correctly in form, but it is not the process nginx currently uses:

- systemd service: reported on `0.0.0.0:3000`, `Restart=always`, 568 prior restarts;
- nginx upstream: `127.0.0.1:3100`;
- active port-3100 process: orphan/manual Node PID 909856.

Do not treat `systemctl restart tenki-dashboard-api` as a complete recovery procedure until the service and nginx use the same loopback port. Do not launch another `nohup node server.js` without first checking listeners, because that is how duplicate API configurations arise.

### Read-only diagnosis

```bash
systemctl status tenki-dashboard-api --no-pager
journalctl -u tenki-dashboard-api --no-pager -n 100
ss -lntp | grep -E ':(3000|3100)\b'
curl -k https://172.237.20.132.sslip.io/health
```

### Intended recovery after configuration is reconciled

Choose one canonical loopback port (the current nginx config expects 3100), update the service and nginx together, validate the configuration, and then manage only the systemd process:

```bash
systemctl daemon-reload
systemctl restart tenki-dashboard-api
systemctl status tenki-dashboard-api --no-pager
curl -k https://172.237.20.132.sslip.io/health
```

Before adopting this as the official procedure, verify that the unit logs show the same address/port nginx proxies to. The unit should also be changed from root to a dedicated unprivileged user.

### nginx checks

```bash
nginx -t
systemctl status nginx --no-pager
systemctl reload nginx
```

Only reload after `nginx -t` succeeds. The active routing behavior is verified, but the exact nginx site-configuration filename was not retained in this audit.

### PostgreSQL checks

```bash
systemctl status postgresql --no-pager
sudo -u postgres psql -d tenki_dashboard -c 'SELECT now();'
```

## Backup commands inferred from the architecture

Use a private backup directory outside the nginx site root. These are examples and were not run.

```bash
sudo -u postgres pg_dump --format=custom --file=/secure/backup/tenki_dashboard.dump tenki_dashboard
tar -C /root/src -czf /secure/backup/tenki-source.tgz tenki-sales-search 'model generation'
tar -C /opt -czf /secure/backup/tenki-runtime-code.tgz tenki-dashboard/api tenki-dashboard/site-data tenki-dashboard/scripts
```

Large raw/parquet folders should use filesystem snapshots, object storage, or incremental backup tooling rather than repeatedly creating full tar archives. A restore test is required before calling any backup strategy complete.

## Rebuild commands inferred from checked-in files

These are incomplete until the input paths, production loader scripts, and Python environment are copied into source control and documented.

```bash
cd '/root/src/model generation'
python3 scripts/build_rank_chunks.py
python3 scripts/build_shop_summary_chunks.py
sudo -u postgres psql -d tenki_dashboard -v ON_ERROR_STOP=1 -f sql/create_validation_holdout_predictions.sql
sudo -u postgres psql -d tenki_dashboard -v ON_ERROR_STOP=1 -f sql/per_genre_validation.sql
```

After loading new model outputs, the intended rollups are:

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_all_genres_daily;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_all_shops_daily;
ANALYZE;
```

Do not run the current validation scripts casually in production: they drop/recreate validation tables and temporary objects and delete/reinsert metrics for a model version.

The production loader scripts are available at `/opt/tenki-dashboard/scripts`, but their exact invocation/arguments were not executed in this read-only audit. Run their built-in help or inspect them, then document the ordered load commands before rebuilding production.

## Reproducibility gaps to close, in priority order

1. Reconcile the two Node processes: make nginx and `tenki-dashboard-api.service` use one loopback port, remove the manual/orphan launch path, and confirm reboot recovery.
2. Run the API as a dedicated unprivileged user rather than root; confirm port 3000 is not unintentionally externally reachable.
3. Add a dedicated read-only SSH/database audit account so future audits do not require root credentials.
4. Check the four production PostgreSQL loader scripts into Git and `/root/src`, then document their ordered invocation.
5. Check in the actual sales, rank, shop, and units model training/inference code. If XGBoost is the intended model, include feature builders, hyperparameters, seeds, split logic, serialization, and inference.
6. Add a Python project/dependency lock. The current system Python only reported pandas 2.1.4 among queried model dependencies.
7. Add a machine-readable build manifest containing model version, source-data hashes/date ranges, code commit, dependency lock, feature schema version, training timestamp, and output row counts.
8. Make model outputs immutable by version; do not use ambiguous defaults such as `github-pages-current`.
9. Store and validate independent genre, shop, and units holdouts. Do not relabel genre holdout results as shop results.
10. Define confidence-interval construction and calibrate/test interval coverage separately from point-estimate WMAPE.
11. Add data-quality reports for duplicate keys, missing item/shop IDs, rank monotonicity, zero/negative sales, cancellation outliers, and date gaps.
12. Add a one-command idempotent rebuild that performs extraction, feature generation, training, validation, output generation, database loading, materialized-view refresh, and smoke tests.
13. Add database migrations rather than relying on one monolithic `schema.sql`; include `model_validation_holdout_predictions` in the managed schema.
14. Complete the frontend migration from the 5.8 GB compatibility CSV dataset to JSON/PostgreSQL routes before deleting generated CSV assets.
15. Automate backups and periodically test a restore onto a clean host.

## Repeatable read-only database audit queries

Run these only through a read-only PostgreSQL role or an explicitly approved administrative session. They intentionally contain no credentials.

```sql
SELECT version();
SELECT current_database(), current_user;

SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, tablename;

SELECT schemaname, matviewname, ispopulated
FROM pg_matviews
ORDER BY schemaname, matviewname;

SELECT relname,
       pg_size_pretty(pg_total_relation_size(oid)) AS total_size,
       n_live_tup
FROM pg_class
LEFT JOIN pg_stat_user_tables ON relid = oid
WHERE relkind IN ('r', 'm')
  AND relnamespace = 'public'::regnamespace
ORDER BY pg_total_relation_size(oid) DESC;

SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

SELECT 'dashboard_genre_daily' AS object, COUNT(*) AS rows, MIN(date), MAX(date) FROM dashboard_genre_daily
UNION ALL
SELECT 'dashboard_genre_rank_daily', COUNT(*), MIN(date), MAX(date) FROM dashboard_genre_rank_daily
UNION ALL
SELECT 'dashboard_rank_rows', COUNT(*), MIN(date), MAX(date) FROM dashboard_rank_rows
UNION ALL
SELECT 'dashboard_shop_daily', COUNT(*), MIN(date), MAX(date) FROM dashboard_shop_daily
UNION ALL
SELECT 'dashboard_shop_genre_daily', COUNT(*), MIN(date), MAX(date) FROM dashboard_shop_genre_daily;

SELECT model_version, model_name, entity_type, metric_name,
       COUNT(*) AS metric_rows, SUM(sample_size) AS samples,
       MIN(evaluated_at), MAX(evaluated_at)
FROM model_validation_metrics
GROUP BY model_version, model_name, entity_type, metric_name
ORDER BY model_version, model_name, entity_type, metric_name;
```

The principal server inventory is now recorded. Future repeat audits should additionally retain a sanitized live index definition/usage report, exact parquet schemas and row counts, API/server-source checksums, backup timestamps, and restore-test results. Secret-bearing files must always be summarized by variable name only, never printed.
