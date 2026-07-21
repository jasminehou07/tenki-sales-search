# TENKI Code and Model Audit

**Audit date:** 2026-07-21
**Repository:** `outputs/`
**Audited commit:** `5cbf687` (`main`, also `origin/main`)
**Method:** static code, generated-artifact, configuration, and Git-history audit. This code audit did not directly query the production database, private raw rows, or live API; contemporaneous companion audit evidence and the fresh dependency probe are identified where used. No credentials or secret values are reproduced here.

## 1. Scope and Evidence Boundary

This audit covers the current working tree, including:

- Versioned frontend: `index.html`, `app.js`, `styles.css`.
- Versioned API: `api/server.js`, `api/package.json`, `api/package-lock.json`.
- Versioned database and deployment material: `backend/*.sql`, `backend/*.py`, `backend/*.sh`, `backend/env.template`.
- Versioned chunk builders: `scripts/build_rank_chunks.py`, `scripts/build_shop_summary_chunks.py`.
- Versioned documentation and configuration: `README.md`, `HANDOFF.md`, `.gitignore`, `.nojekyll`.
- The current, **untracked** `model-generation/` tree. It exists locally but is absent from `HEAD`, `git ls-files`, and all repository commits.
- Generated rank artifacts in sibling `../work/`, used only as local corroborating evidence. They are outside `outputs/` and are not in this Git repository.

When this audit began, `git status --short` showed user-owned modifications to `app.js` and `index.html`, plus untracked `model-generation/`. During final verification, concurrent work added `docs/audit/TENKI_LOCAL_FILE_AUDIT.md`, `docs/audit/TENKI_SERVER_DATABASE_AUDIT.md`, and portable path changes under `model-generation/`. This audit re-read the affected files and altered none of them. Line references refer to the final working-tree snapshot.

The Git database has only 47 commits. Commit `95e1643` (`2026-07-15`, "Clean GitHub Pages history") is a root commit with no parent. `git fsck --unreachable --no-reflogs` found no recoverable earlier commits. Therefore, Git cannot establish model provenance before 2026-07-15.

Two untracked companion reports add evidence without changing that Git boundary:

- `docs/audit/TENKI_LOCAL_FILE_AUDIT.md:35-52` records a locally available external raw root with 598 parquet files, 37,473,236 ranking rows across 297 genres, and 94,512,211 sales rows across 300 genres. It is not part of this repository and has no manifest/checksums (`:266-289`).
- `docs/audit/TENKI_SERVER_DATABASE_AUDIT.md:22-28` records a read-only live deployment check. It observed 98,421 validation samples and about 57.06% overall genre WMAPE (`:181-188`), but no independent live shop or units metric.

## 2. Executive Findings

1. **The committed repository is not a self-contained rebuild.** It contains the UI, API query layer, schema, two chunk builders, validation SQL, and deployment patch scripts. It does not contain `data/`, raw parquet, DB dumps, a pipeline orchestrator, or pinned dashboard-model Python dependencies. The four documented loaders are now present only as uncommitted recovered working-tree source.
2. **The substantive dashboard model code is currently untracked.** `model-generation/dashboard-pipeline/` mirrors the local scripts in `../work/`, but no commit contains it. Reproducing a production build from `git clone` is therefore impossible.
3. **There are three distinct modeling/validation systems, and they should not be conflated:**
   - An untracked daily genre experiment with a chronological 180-day holdout and evidence WAPE of 27.73% sales / 23.54% quantity.
   - Untracked rank and shop dashboard generators using random 5% holdouts, extensive post-processing, and missing metric outputs.
   - Versioned SQL validation that does **not** rerun either production model; it evaluates a separate mean-lookup surrogate over a 5% hash sample of `dashboard_rank_rows`.
4. **The visible 57.1%, 17.4%, and 49.7% WMAPE values have no committed generated-metric provenance.** They are hardcoded defaults. A companion live check found 57.06% in the SQL validation API, explaining the rounded 57.1%, but found no independent shop or units metric; the referenced trainer metric CSVs are absent.
5. **The “95%” bands are heuristic/empirical prediction bands, not confidence intervals on a model parameter or mean.** The UI further symmetrizes them and falls back to +/-25%. Summing row bounds is not shown to preserve 95% aggregate coverage.
6. **Rank, item, and shop identity are partially synthetic.** The rank model predicts positions without identity, a later raw-data join fills identity and exact sales, another pass carries older identities forward, and the frontend can borrow identity from nearby dates. Range and all-genre API views re-rank or attach a representative identity.
7. **Date-scoped shop validation is mislabeled.** The only holdout table is created as `Genre sales model` / `genre`, but `/api/model-validation` does not filter those columns in its date-scoped CTE and relabels rows as `Shop sales model` / `shop` (`api/server.js:669-724`). The frontend enables this for a selected shop (`app.js:1349-1352`).
8. **The frontend is a hybrid API/static client.** Some routes query Postgres, some are CSV compatibility endpoints backed by SQL, and several required startup/all-time assets are static files. With `data/` absent, the local server command can render the shell but cannot reproduce the complete application independently.

## 3. What Is Executable Now

| Component | Current status | What is required |
|---|---|---|
| Static frontend shell | Executable with Python's HTTP server | Browser network access to the configured production API and its static CSV assets |
| Complete local frontend | Not self-contained | Missing `data/`; no checked-in local API-base configuration; production URL is the default |
| Node API | Source is plausibly runnable, but not in this audit environment | Node 18+, `npm ci`, Postgres, `API_DATABASE_URL`, matching `MODEL_VERSION`, production/static data paths |
| Database schema | Partially executable, not idempotent | PostgreSQL privileges to create a DB/extensions, pre-existing `tenki_api` role, later data load and rollup refresh |
| Validation SQL | Executable only after rank rows and genres are populated | PostgreSQL/`psql`; `create_validation_holdout_predictions.sql` must run before date-scoped API queries |
| Checked-in chunk builders | Syntax-valid, data-dependent | pandas and generated `data/`/`../work/ranked-shops` inputs |
| Dashboard rank/shop trainers | Present only as untracked local files | pandas, numpy, scikit-learn, optional xgboost, parquet/DuckDB tooling, external raw files, generated CSV inputs, environment/path configuration |
| Daily genre forecast experiment | Locally runnable in principle | Its requirements, raw TENKI folders, event parquet, output/cache directories; it is not wired into the dashboard |
| Deployment/patch scripts | Production-specific, not normal local entry points | `/opt/tenki-dashboard`, `/etc/nginx`, root/Postgres privileges, server-only files |
| Automated tests | Not executable because none exist | `api/package.json:6-8` defines only a deliberately failing placeholder test |

The audit host had Python 3.13.5, but no `node`, `npm`, or `psql` on `PATH`. `api/node_modules/` and `data/` were absent.

## 4. Reconstructed Dashboard Data Lineage

```text
raw TENKI genre-sales parquet + genre-ranking parquet + events parquet
    |
    +--> monthly actual shop/genre CSVs
    |      `model-generation/dashboard-pipeline/data-prep/build_monthly_actuals_from_parquet.py`
    |      |
    |      +--> shop sales model + unit-price model
    |      |      `core/build_shop_projection_files.py`
    |      |      --> shop-estimates, trend-estimates, params, metrics, all-time files
    |      |
    |      +--> rank-summary unit-price signal
    |             `data-prep/build_rank_summary_units.py`
    |
    +--> known ranked-item sales training cache
    |      `core/build_rank_gbt_estimates.py`
    |      --> rank 1..80 predictions, rank curves, event factors, holdout metrics
    |             |
    |             +--> exact date/genre/rank item/shop join and observed-sales overwrite
    |             |      `core/fill_rank_shops_from_ranking.py`
    |             +--> prior identity carry-forward
    |             |      `core/fill_missing_rank_identity_from_recent.py`
    |             +--> historical caps and descending-curve sanitation
    |                    `core/sanitize_rank_outputs.py`
    |                    --> `../work/ranked-shops/*.csv`
    |                           |
    |                           +--> genre/all/all-items chunks
    |                                  `scripts/build_rank_chunks.py`
    |
    +--> filter, name, event, shop-mix, monthly, and all-time CSV assets
           `model-generation/dashboard-pipeline/data-prep/*`

generated chunks/parquet --(recovered, uncommitted loaders)--> PostgreSQL schema
    --> validation lookup SQL --> validation tables
    --> Express JSON/CSV routes and static CSV compatibility routes
    --> browser fetch/aggregate/clean/render logic
```

There is no Makefile, workflow, manifest, or single command defining this order. The order above is reconstructed from read/write paths and imports, not from an authoritative orchestrator.

### Raw preparation

- `data-prep/build_tenki_data.sql:1-65` is DuckDB SQL that aggregates item-level sales to date/shop/genre, creates dropdown totals, and exports events. Its input and output paths are absolute developer-machine paths.
- `data-prep/build_tenki_item_data.sql:1-14` exports positive item-level sales to sibling `work/item_sales_daily.csv`.
- `data-prep/build_monthly_actuals_from_parquet.py:8-66` reads raw parquet from an absolute Downloads path and creates `outputs/data/by-month/*.csv`.
- `data-prep/build_filter_options.py:214-268`, `build_shop_genre_mix.py:14-51`, `build_monthly_files.py`, and `build_all_time_files.py` derive browser CSVs. None of their expected `outputs/data/` products is present.
- `data-prep/fill_rakuten_genre_names.py` and `fill_rakuten_genre_paths_and_translations.py` query Postgres and external pages/services; they are operational enrichment tools, not pure local transforms.

### Database loading

`HANDOFF.md:37-46` names four loaders that were absent from Git/source history but were freshly recovered into untracked `model-generation/dashboard-pipeline/server-loaders/` during this audit. They close part of the source gap but still need commit review, dependency installation, database integration tests, and a staged production dry run.

- `load_dashboard_chunks_streaming.py:35-218` reads filter/shop options and monthly rank/shop summaries, writes parquet mirrors, loads the four versioned dashboard tables incrementally with psycopg COPY, and refreshes both materialized views. It commits the delete before file batches and commits each file, so failure leaves a partial model version. `TRUNCATE genres, shops` (`:54-58`) is also FK-sensitive under the checked schema.
- `load_dashboard_chunks_to_postgres.py:60-206` performs the same broad load but concatenates each entire dataset in memory before COPY. It is less suitable for the observed multi-million-row rank volume and has the same fixed paths and options truncation.
- `load_rank_chunks_batched.py:10-84` batches 500 CSV files by default and loads only `dashboard_genre_rank_daily`. Its `*/*.csv` glob includes `all` and `all-items`; unlike `data-prep/import_rank_rows_to_postgres.sh:33-37`, it does not exclude those synthetic directories. Numeric coercion can turn genre `all` into zero, while all-items can duplicate genre/date/rank keys across batches. This must be fixed/tested before use.
- `load_raw_parquet_to_postgres.py:11-175` imports events, raw rankings, and raw sales through temporary tables and `ON CONFLICT DO NOTHING`. It is hardcoded to `/root/events`, `/root/genre-ranking`, and `/root/genre-sales`, so it omits `genre-ranking2/3` and `genre-sales2/3`.

All four import pandas and psycopg; parquet reads/writes additionally require PyArrow or another pandas parquet engine. Paths are fixed to `/opt/tenki-dashboard` or `/root`, and none uses `pipeline_paths.py`. A fresh live-server probe reported only pandas 2.1.4 among the queried model dependencies; psycopg, PyArrow, NumPy, scikit-learn, and XGBoost were not reported as available. Syntax checks passed locally, but no loader was executed against a database.

The untracked `data-prep/import_rank_rows_to_postgres.sh:4-60` remains the only concrete loader for the unversioned `dashboard_rank_rows` table. It drops/recreates that table, explicitly excludes `all`/`all-items`, imports with `\copy`, and adds indexes. It is destructive, assumes server paths and `sudo -u postgres`, and does not use an atomic table swap.

## 5. Model Reconstruction

### 5.1 Daily genre forecast experiment

This is a separate, untracked package at `model-generation/daily-genre-forecast/`; no runtime file references it.

**Algorithm and features**

- Aggregates item parquet to genre/day sales, quantity, traffic/review totals, active shops, and active items (`sales_event_model.py:301-335`).
- Aggregates same-day ranking data to ranked item/shop counts, rank statistics, and price statistics (`:338-356`). This makes the artifact closer to a nowcast unless same-day rankings are known at prediction time.
- Adds calendar cycles, Japanese holidays, event timing, upcoming-event/holiday features, point multipliers/caps, promotion lift lookups, and 1/7/14/28-day lags plus 7/28-day rolling means (`:74-298`, `:359-435`).
- Uses separate pre-2024 and 2024+ `HistGradientBoostingRegressor` pipelines, one-hot categories, absolute-error loss, and log1p targets (`:652-682`, `:787-850`).

**Holdout and outputs**

- Uses the last 180 days as a chronological test set (`:63-65`, `:787-790`), with test start 2025-12-03 and end 2026-05-31 in the supplied evidence.
- Event feature selection is based only on late training rows (`:807-817`). Lag features are shifted, which is appropriate for a chronological split.
- Promotion-effect lookup CSVs are precomputed inputs, but no generator/provenance for them is included. Because their time window is unknown, leakage through those aggregate lift values cannot be ruled out.
- The script writes predictions, JSON metrics, feature importance, analysis CSVs, and a Joblib bundle (`:852-956`). Only selected evidence files are included; predictions, model bundle, and cache are absent. The script reads only `genre-sales/` and `genre-ranking/` (`sales_event_model.py:404-406`), omitting the numbered second and third batches. The supplied 100-genre evidence therefore covers only a subset of the locally inventoried 300 sales and 297 ranking genres (`TENKI_LOCAL_FILE_AUDIT.md:97-117`).
- `evidence/sales_event_metrics.json` reports WAPE `0.277259...` (27.73%) and `quantity_event_metrics.json` reports `0.235392...` (23.54%), over 17,897 test rows and 100 genres. These are evidence for this experiment only.

### 5.2 Rank sales model used to build dashboard rank files

The most current local implementation is `model-generation/dashboard-pipeline/core/build_rank_gbt_estimates.py`. It was recovered from `../work/` and then changed locally to use the untracked portable path module `core/pipeline_paths.py:10-31`; it remains absent from Git history.

**Training population and holdout**

- Trains on positive known ranked sales, ranks 1-20; a cache may be reused without noticing upstream changes (`build_rank_gbt_estimates.py:228-252`). The local cache has 377,805 rows, 294 genres, dates 2020-01-01 through 2026-05-27, and 20 ranks.
- Uses three seeded random row-level 5% holdout runs (`:48-52`, `:1327-1374`). It is neither chronological nor grouped by date/genre/item, so near-identical date/genre/rank context can appear in both train and holdout.
- WMAPE is `sum(abs(actual-predicted))/sum(abs(actual))`; the script stores it as a fraction rather than a percent (`:1189-1204`).

**Algorithm and features**

- Predicts log sales with XGBoost when importable; otherwise it silently changes algorithm to scikit-learn `HistGradientBoostingRegressor` (`:715-729`, `:827-840`, `:940-954`). Environment choice therefore changes model behavior.
- Trains global, genre, and hand-built genre-group models, with minimum-row/rank thresholds and fallbacks (`:968-1038`, `:1146-1186`).
- Features include genre/group codes, rank and rank transforms, calendar fields, event labels/windows/intensity, seasonal group flags, historical genre/rank statistics, event residual factors, and support/confidence fields (`:630-703`).
- Fits multiplicative calibration factors using a sample from the same fitted training data (`:1032-1143`), which is in-sample calibration.
- Weights high-sales rows, events, and top ranks more strongly. It applies rank-shape curves, forced descending ratios, lower-drop floors, and total rescaling (`:1286-1324`, `:1460-1469`).

**Prediction output**

- Builds a cross-product of every date, every genre, and ranks 1-80 (`:1453-1457`, `:1540-1556`). This can synthesize date/genre combinations absent in the raw observations.
- Initially writes blank shop/item identity and `source=estimated` (`:1562-1584`). No serialized model is written; the product is CSV.
- Publishing occurs only with `--publish-output` and only when WMAPE improves over an existing metrics CSV, unless `--force-publish` is used (`:1607-1672`). The referenced rank metric CSVs are absent, so the current 57.1% cannot be verified against this trainer.

### 5.3 Shop sales and units model

`core/build_shop_projection_files.py` and `core/shop_projection_model.py` build the dashboard's shop/genre estimates.

**Features and candidate models**

- Inputs are daily shop/genre actuals. Features include lagged/rolling sales, positive-sales rates, recent maxima/volatility, calendar fields, event flags/intensity, genre seasonality, fallback shop/genre means, hand-built genre groups, shop/group totals, trend and history-strength features (`shop_projection_model.py:47-272`; `build_shop_projection_files.py:53-102`).
- The baseline tunes lag-profile, seasonal weight, and scale by genre (`shop_projection_model.py:369-440`). Additional candidates include factor correction, direct HistGradientBoosting store regression, grouped and shop+genre correction models, and a sales-activity classifier.
- Candidate models and pairwise blend weights are selected by minimum WAPE on the same hidden sample used for reporting (`build_shop_projection_files.py:699-722`, `:725-831`). Thus the reported hidden score is also a model-selection score, not an untouched final test.

**Holdout and leakage risk**

- A seeded random row-level 5% split is used (`shop_projection_model.py:9-17`, `:361-366`; `build_shop_projection_files.py:733-737`). `VALID_START` and `HOLDOUT_START` remain in constants, but the current builder passes the random train/validation frames directly.
- History features are created on the full data **before** the random split (`build_shop_projection_files.py:733-735`). A hidden row's actual value can therefore affect lag/rolling features of later rows. This is leakage across the split.
- WAPE uses the standard weighted formula and is stored as a fraction (`shop_projection_model.py:472-485`). Referenced shop sales metrics/parameter CSVs are absent.

**Units and page views**

- The current build does not train the older page-view projection path; it hardcodes all predicted page-view fields to zero (`build_shop_projection_files.py:1023-1038`). The API compatibility routes also return zero page views for modeled data (`api/server.js:918-943`, `:981-1021`).
- Units are derived from a random-5% validated shop/genre average unit-price hierarchy, then sales divided by price, with fallbacks (`build_shop_projection_files.py:938-1020`). This is not an independent units GBT in the current build.

### 5.4 SQL validation actually used by the verification UI

`backend/create_validation_holdout_predictions.sql` and `backend/per_genre_validation.sql` implement a fourth algorithm: average lookups over rank observations.

- Candidate actuals are rows in `dashboard_rank_rows` with source `actual`, `known_tenki`, or `hybrid`, positive sales, and rank 1-80 (`create_validation_holdout_predictions.sql:9-24`).
- Holdout membership is `MOD(ABS(HASHTEXT(row identity)),20)=0`, nominally deterministic 5% (`:18`, `:26-31`). It is not temporal, grouped, or stratified; PostgreSQL hash implementation/version becomes part of reproducibility.
- Genre tiers are based on remaining training row counts: >=1000, >=100, or smaller (`:32-45`). Predictions are fallbacks among genre-rank mean, scaled group-rank mean, genre mean, group-rank mean, global-rank mean, and global mean (`:46-115`).
- This SQL does **not** call the rank GBT or shop model. Calling its WMAPE “model validation” evaluates a surrogate lookup model on post-processed rank data.
- `per_genre_validation.sql:129-238` writes per-genre WMAPE, median APE, within-25%, and all-genre WMAPE under hardcoded model version `rank-validation-20260721`.
- Sanitized actual rows changed to `estimated` are excluded from this validation, so the evaluated actual population is selected after outlier/shape processing.

## 6. WMAPE Provenance

| Value | Where displayed or stored | Actual provenance |
|---|---|---|
| 57.1% | `index.html:143`, `:164`, `:334`; frontend default `app.js:1046-1074` | Manual fallback introduced in commit `1323b34`; changed from 28.7%. The companion live audit observed 57.06% from the SQL holdout API, so the rounded value is operationally corroborated, but still not a committed trainer metric. |
| 17.4% | `index.html:149`, `:339`; frontend default | Hardcoded since verification UI commit `05a31b2`. No current units metrics CSV is present. |
| 49.7% | `index.html:344`; frontend default | Hardcoded since `05a31b2`. No current shop metrics CSV is present. |
| 27.73% sales | `daily-genre-forecast/evidence/sales_event_metrics.json` | Chronological daily genre experiment; not connected to dashboard runtime. |
| 23.54% quantity | `daily-genre-forecast/evidence/quantity_event_metrics.json` | Same separate experiment; not the UI's 17.4%. |
| Dynamic values | `model_validation_metrics` / holdout table through `/api/model-validation` | SQL mean-lookup validation, subject to DB contents and filtering issues described below. |

The frontend fetches `/api/model-validation` and silently retains defaults on failure (`app.js:1409-1490`, `:1669-1681`). For daily charts, dates without a holdout row are filled with the saved aggregate WMAPE and labeled `saved WMAPE` (`:1481-1489`). The chart clamps its Y domain to 0-100 (`:1502-1508`), so WMAPE above 100% is visually clipped.

`/api/metrics/wmape` orders only by `evaluated_at DESC` and limits to one row (`api/server.js:630-655`). Without a genre/shop filter it does not explicitly prefer the all-entity row, so it can select a per-entity metric if that row is newest.

**Critical shop bug:** date-scoped `/api/model-validation` filters the holdout table only by date and optional genre/shop (`api/server.js:669-705`), not its stored `model_name` or `entity_type`. It then emits request-selected labels (`:707-724`). Since `create_validation_holdout_predictions.sql:70-78` stores every row as `Genre sales model` / `genre`, a selected-shop response is a shop-filtered slice of genre-rank lookup predictions relabeled as a shop-model evaluation.

## 7. Intervals and Outlier Cleaning

### Rank intervals

- The rank GBT computes `(actual+1)/(prediction+1)` on holdout rows and takes 2.5%/97.5% quantiles, per genre only with at least 20 rows and otherwise globally (`build_rank_gbt_estimates.py:1207-1218`). Factors are applied multiplicatively (`:1557-1561`).
- These are empirical residual-ratio prediction bands. They are not confidence intervals for a mean or coefficient, and the repo has no coverage/calibration report.

### Shop intervals

- Shop validation predictions are first summed by genre. A single ratio per genre is computed; global 2.5%/97.5% quantiles across those genre totals are blended 65/35 with each genre's own ratio (`build_shop_projection_files.py:166-193`). This is not a row-level 95% interval and uses the same tuning holdout.

### Cleaning and display transformation

- `core/sanitize_rank_outputs.py:41-89` builds caps from historical genre-rank, genre, and rank medians/p95/p99, caps outliers, and changes capped rows to `estimated`.
- It forces descending shapes and lower-drop floors, rescales totals, marks >2%/1-yen changes as estimated, and rebuilds bands with clipped ratios (`:16-38`, `:92-137`).
- Local generated evidence covers 92 monthly files (2018-10 through 2026-05), 67,200,000 rows. `../work/rank_output_sanity_report.csv` records 10,926 nonpositive values, 873,011 order breaks before sanitation, and 23,386,689 adjustment events. “Adjusted” sums cap and shape flags and may double-count a row.
- The browser applies another curve cleaner (`app.js:3681-3764`): it replaces actuals over six times a rank curve, fills missing/nonpositive rows, forces descending maxima and floors, and may reclassify displayed actuals as estimated. This is presentation-time mutation and is not reflected in database validation.
- `centeredSalesInterval` symmetrizes asymmetric bands around the estimate and defaults to +/-25% (`app.js:4193-4205`). Aggregations sum lower and upper bounds without a stated dependence assumption.

Accordingly, UI labels such as “95% estimate interval” should be read as heuristic empirical bands after multiple transformations, not statistically demonstrated 95% confidence intervals.

## 8. Rank, Item, and Shop Semantics

1. **Raw rank:** original Rakuten position from genre-ranking parquet.
2. **Modeled rank:** a date/genre position 1-80 with predicted sales. The model is position-based and initially has no shop/item identity.
3. **Exact identity/actual overwrite:** `fill_rank_shops_from_ranking.py:60-92` picks one raw item per date/genre/rank, favoring known sales, higher sales/items, then deterministic IDs. Exact known sales overwrite model sales and set `source=actual` (`:110-150`).
4. **Carried identity:** `fill_missing_rank_identity_from_recent.py:30-84` uses up to the current and previous two map months, then an as-of backward merge by genre/rank. A displayed identity can therefore be from an earlier date while sales remain modeled.
5. **Frontend identity:** `app.js:2505-2572` can fill missing labels from a nearby +/-3-day row and marks the tooltip as nearest-date identity.
6. **All-genre position totals:** `scripts/build_rank_chunks.py:48-78` sums the same numerical rank across genres and erases identity. “Rank 1” in that file means the sum of every genre's rank 1, not a marketplace-wide item.
7. **All-items view:** `scripts/build_rank_chunks.py:14-32` takes identity-bearing rows and re-ranks the top 80 by sales for each date. This display rank is newly computed.
8. **Rank summary total:** `data-prep/build_rank_summary_units.py:106-128` sums ranks 1-80, then extrapolates ranks 81-100 from rank 80 with a power-law exponent of 1.08. The top-card genre total therefore includes an unshown synthetic tail.

API semantics vary by mode:

- `/api/genre/rank-rows?aggregate=1&genreId=all` samples at most 5,000-200,000 high-sales candidates, aggregates by actual item/shop/genre, then computes a new display rank (`api/server.js:162-213`). It is not guaranteed to consider all rows for long ranges.
- The same route for one genre sums sales by original rank across the range, then attaches the identity from the highest-sales row for that rank (`:216-257`). That identity is representative, not the owner of all summed sales.
- Daily all-genre mode re-ranks rows across genres by sales (`:260-290`); daily single-genre mode preserves original rank (`:293-312`).
- `/api/top-items` aggregates rank-row sales and hardcodes units to zero (`:507-556`). `/api/data/top-items.csv` instead aggregates raw item sales and sorts by units then sales (`:1061-1095`). These are not equivalent fallbacks.
- `/api/top-shops` sums rank-row sales and names `COUNT(*)` as `known_rows` without filtering to known sources (`:559-613`).

## 9. Frontend Fetch Path

`app.js:1-29` defaults `DATA_BASE_URL` to the production `/api/data` URL and derives the JSON API base only when the value ends exactly in `/api/data`. `window.TENKI_DATA_BASE_URL` can override it, but `index.html` does not provide local configuration. `index.html:7-10` redirects `file:` and GitHub Pages to production.

Startup uses one `Promise.all` (`app.js:5008-5099`) for:

- `filter_options.csv` and `shop_options.csv` through SQL-backed compatibility endpoints.
- Required static `genre_names.csv`, `shop_genre_mix.csv`, `events.csv`, `rank_curves.csv`, and `rank_event_factors.csv`.

Any network rejection disables initialization. Startup reads `response.text()` without checking `response.ok`, so a 404 HTML body can be treated as CSV. The custom CSV parser (`app.js:205-234`) handles quote escaping but splits physical lines first, so embedded newlines in quoted cells are unsupported. There is no runtime schema validation.

Current interactive paths are:

- **Genre mode:** JSON `/api/genre/rank-rows` for rank rows; monthly `rank-summary-by-month` CSV for summary/trend/cards; JSON `/api/top-shops` (`app.js:2464-2582`, `:2985-3039`). The defined JSON genre-trend loader is not called.
- **Shop mode:** JSON `/api/shop/genre-daily` for daily/aggregate shop-genre values and JSON `/api/top-items`, with CSV/raw fallbacks (`:2397-2427`, `:2912-2977`).
- **All time:** a mixture of static files and SQL-backed CSV routes under `/api/data/all-time/` (`:3050-3100`). `summary.csv`, `monthly.csv`, and `items.csv` have no SQL route and must exist as static generated assets.
- **Verification:** JSON `/api/model-validation` (`:1409-1490`, `:1669-1681`).

`/api/events`, `/api/genre/summary`, `/api/genre/ranks`, `/api/genre/rank-projection`, `/api/shop/summary`, `/api/shop/genres`, and `/api/metrics/wmape` exist, but current browser code does not use them for the main rendered paths. The endpoint list in `HANDOFF.md:72-87` therefore overstates direct frontend use.

## 10. API, Configuration, and Schema Audit

### API configuration

- `api/server.js:1` loads only `/opt/tenki-dashboard/.env`; it does not load a local `api/.env` by default.
- The pool reads `API_DATABASE_URL` (`:17-21`), while `backend/env.template:1` documents `DATABASE_URL`. Following the template literally leaves the API pool unconfigured.
- `backend/env.template:2` includes an `API_KEY` placeholder, but `server.js` never implements API-key authentication. The API is public read-only behind CORS; CORS also permits no-origin and `null` origins (`server.js:23-30`).
- `latestModelVersion()` never queries a table; it returns `MODEL_VERSION` or literal `github-pages-current` (`:56-58`). If loaded rows use a different version, version-filtered endpoints silently return empty sets.
- Static roots are hardcoded to `/opt/tenki-dashboard/site-data`; listen address is `127.0.0.1` port 3100 (`:14-15`, `:1186-1201`). This matches nginx deployment, not a portable local setup.
- Dates are regex-checked but not calendar-validated; order is not validated. SQL is parameterized, which limits injection risk (`:33-53`).

### Package metadata

- `api/package.json:5` points `main` to nonexistent `index.js`.
- There is no `start` script and no real test script (`:6-8`). Normal operation requires `node server.js`.
- Dependencies are Express 5, `pg`, Helmet, CORS, compression, and dotenv (`:12-18`), locked with package-lock v3. No Node engine is declared, although locked transitive packages require a modern Node runtime.

### Schema

- `backend/schema.sql:10-63` defines raw ranking/sales and promotion tables.
- `:65-163` defines genre, rank, shop, and shop-genre model outputs with model versions and 95%-named bound columns.
- `dashboard_rank_rows` (`:110-127`) has no primary/unique key, `model_version`, source constraint, or creation timestamp. Duplicate loads and provenance cannot be resolved at query time.
- `model_validation_metrics` is defined at `:165-178`, but `model_validation_holdout_predictions` is absent from the base schema and created only by the destructive validation SQL.
- Materialized all-genre/all-shop rollups are defined at `:274-305` and need explicit refresh after loads (`backend/dashboard_queries.sql:245-247`).
- The script starts with `CREATE DATABASE`/`\connect`, assumes permission to create `pg_trgm`, and grants to a role it does not create (`schema.sql:1-8`, `:307-314`). It is a bootstrap script, not idempotent migration history.

### Compatibility and completeness risks

- `/api/data/items-by-month/:month.csv` globally limits the month to 50,000 grouped items (`api/server.js:1042-1058`), so raw item fallback can be incomplete for a selected filter.
- Ranked CSV compatibility serves a static file first; when absent, SQL fallback supports only numeric genres, not `all`/`all-items` (`:946-979`).
- Several JSON routes use `dashboard_rank_rows`, which has no model-version filter, while summary routes use versioned tables. A request can combine rows from different load generations.

## 11. Git History and Claim Provenance

Key observable milestones:

- `95e1643` (2026-07-15): history-cleaning root commit adds the static dashboard, schema/query examples, and two chunk builders.
- `05a31b2` (2026-07-16): adds model verification UI with 28.7%, 17.4%, and 49.7% hardcoded.
- `7913ac6` (2026-07-21): adds per-genre SQL validation and the first API patcher.
- `f172c16` (2026-07-21): adds deterministic holdout table SQL and date-scoped API patcher.
- `6232623`/`38e737e` (2026-07-21): add server handoff docs and server data symlink claims.
- `1323b34` (2026-07-21): adds the current API/package files and manually changes total-sales WMAPE from 28.7% to 57.1%.
- `5cbf687` (2026-07-21): documents restart and model rerun steps.

No commit adds the model-generation trainers, recovered loaders, generated model metrics, raw data, or a reproducible environment. The current `model-generation/` package, its README/requirements, path helper, and server loaders all remain uncommitted working-tree evidence. The README claim that `/root/src/model generation` contains model/data scripts may be true on the server, but it is production-only evidence, not reconstructable from committed Git.

`backend/add_model_validation_endpoint.py`, `update_model_validation_endpoint.py`, `serve_dashboard_site.py`, and archived `model-generation/.../archive-patches/*` are one-off text mutation scripts. Their changes are already represented in current `api/server.js`; they should be treated as deployment history, not rerun as pipeline steps.

## 12. Dependencies and Intended Commands

### Auditable inventory commands

```bash
cd outputs
git status --short --branch
git log --reverse --date=short --pretty=format:'%h %ad %s'
git log --all --name-status -- .
git ls-tree -r --name-only HEAD
git fsck --unreachable --no-reflogs
find . -path './.git' -prune -o -type f -print | sort
```

### Frontend shell

```bash
cd outputs
python3 -m http.server 8766
```

This serves the shell only. Complete rendering still depends on production API/static data unless `window.TENKI_DATA_BASE_URL` is injected before `app.js` and a compatible local server/data tree exists.

### API, intended rather than verified here

```bash
cd outputs/api
npm ci
API_DATABASE_URL='${POSTGRES_CONNECTION_STRING}' \
MODEL_VERSION='${LOADED_MODEL_VERSION}' \
SITE_ROOT='/absolute/path/to/site-data' \
node server.js
```

Do not place real credentials in Git or command history. The API needs Node 18+ in practice and network access for first dependency installation.

### Database, intended order

```bash
psql -v ON_ERROR_STOP=1 -f backend/schema.sql
# Run and validate the recovered uncommitted loaders here; see loader risks above.
psql -v ON_ERROR_STOP=1 -d tenki_dashboard -f backend/create_validation_holdout_predictions.sql
psql -v ON_ERROR_STOP=1 -d tenki_dashboard -f backend/per_genre_validation.sql
```

`backend/dashboard_queries.sql` contains Node-style `$1...$n` parameterized examples and concurrent refresh statements, not a directly runnable migration; execute only adapted statements with bound values. The recovered loaders supply candidate commands, but their uncommitted status, path assumptions, dependency gaps, and unresolved load-safety issues prevent this sequence from being a verified rebuild.

### Daily genre experiment

```bash
cd outputs/model-generation/daily-genre-forecast
python3 -m pip install -r requirements.txt
python3 sales_event_model.py \
  --data-dir '/path/to/TENKI' \
  --cache-dir '/path/to/cache' \
  --output-dir '/path/to/model-output' \
  --holiday-file data/japan_holidays.csv \
  --promotion-effect-dir data/promotion_effects \
  --event-strength-file data/rakuten_event_strength.csv
```

Requirements specify lower bounds, not exact pins: pandas >=3.0.3, pyarrow >=24.0.0, scikit-learn >=1.8.0, matplotlib >=3.10.9, and joblib >=1.5.3 (`requirements.txt:1-5`).

### Reconstructed dashboard model order

```bash
python3 model-generation/dashboard-pipeline/data-prep/build_monthly_actuals_from_parquet.py
python3 model-generation/dashboard-pipeline/core/build_shop_projection_files.py
python3 model-generation/dashboard-pipeline/core/build_rank_gbt_estimates.py --publish-output
python3 model-generation/dashboard-pipeline/core/fill_rank_shops_from_ranking.py
python3 model-generation/dashboard-pipeline/core/fill_missing_rank_identity_from_recent.py
python3 model-generation/dashboard-pipeline/core/sanitize_rank_outputs.py
python3 scripts/build_rank_chunks.py
python3 model-generation/dashboard-pipeline/data-prep/build_rank_summary_units.py
python3 scripts/build_shop_summary_chunks.py
```

This order is inferred. The core scripts now accept `TENKI_DASHBOARD_ROOT`, `TENKI_WORK_DIR`, `TENKI_RAW_DATA_DIR`, and `TENKI_DUCKDB_BIN` through `core/pipeline_paths.py:14-31`; many data-prep scripts still contain absolute paths. The sequence still fails without generated inputs, and the recovered load steps are not yet validated. The newly recovered untracked `model-generation/dashboard-pipeline/requirements.txt:1-7` declares lower bounds for NumPy, pandas, PyArrow, scikit-learn, and XGBoost, but does not pin exact versions and omits loader dependency psycopg. DuckDB CLI is also required for identity filling.

## 13. Reproducibility Blockers and Known Gaps

### Critical

- `data/` is ignored and absent. Raw parquet is available only in an external local Downloads tree and on documented server paths, not in Git; the production DB has no export or migration-backed snapshot in this repository.
- Dashboard model code is untracked. A clean checkout omits it entirely.
- The four general database loaders documented in `HANDOFF.md` are recovered only as uncommitted server source. They have not been integration-tested and contain first-batch-only, synthetic-rank-glob, FK-truncation, memory, and partial-commit risks.
- No pipeline orchestrator, manifest, immutable data snapshot IDs/checksums, model registry, or migration history exists.
- Model/version coupling is broken for `dashboard_rank_rows`, and API default version is a configuration literal.
- Date-scoped shop verification reports a relabeled genre-rank surrogate metric.

### High

- Dashboard dependencies now have an uncommitted lower-bound requirements file, but exact versions are not pinned, psycopg/DuckDB CLI are omitted, and optional XGBoost availability changes the rank algorithm. The live system probe reported only pandas 2.1.4 among queried model dependencies.
- The newly added untracked `core/pipeline_paths.py` makes principal core scripts configurable, but most data-prep, daily-model, deployment, and SQL scripts still target one developer machine or `/opt`/`/root`; path case also varies (`TENKI` vs `tenki`).
- Cached rank training and daily-genre datasets can outlive upstream source changes unless manually rebuilt.
- Rank/shop metric and parameter outputs are absent, so visible WMAPE cannot be recreated or checked.
- Shop holdout leaks history across the random split and is reused for tuning/model/blend selection.
- SQL validation measures a lookup surrogate over post-sanitized rank rows, not the production models.
- The base schema omits the holdout table required by date-scoped verification.

### Medium

- No automated unit, integration, API contract, SQL migration, browser, data-quality, interval-coverage, or reproducibility tests exist.
- The frontend silently falls back to hardcoded metrics and some alternate data sources, obscuring failures.
- Static and SQL routes implement different item/rank semantics and truncation limits.
- Page-view model fields are currently zeros despite older model/file naming suggesting modeled page views.
- `.gitignore` contains only `data/`; it does not protect `.env`, virtual environments, `node_modules`, caches, logs, model binaries, or the untracked model-generation tree.
- `HANDOFF.md` and `README.md` describe server assets that cannot be verified from this checkout.

## 14. Validation Performed for This Audit

- Enumerated tracked and working-tree files and inspected all runtime, SQL, script, configuration, package, schema, validation, documentation, and model-generation sources.
- Read all 47 commits, file-change history, root commit metadata, and unreachable-object report.
- Compared recovered dashboard core scripts with sibling `../work/`, then rechecked them after concurrent edits introduced environment-configurable paths; modeling logic remained the audited implementation while file hashes changed.
- Parsed every Python file with Python's compiler without importing project modules or writing bytecode.
- Ran shell syntax checks on versioned/untracked shell scripts.
- Counted and inspected only aggregate/header information from generated rank artifacts; no private item/shop identifiers are reproduced.
- Did not run Node syntax/tests because Node is unavailable; did not execute SQL because `psql` is unavailable; did not train models because generated intermediates and a pinned dashboard environment are absent; recovered loaders were syntax-checked but not run. External raw parquet was inventoried by the companion local audit, not copied or exposed here.

## 15. Bottom Line

The current TENKI dashboard is an operationally evolved hybrid, not a reproducible model repository. The UI and API can plausibly serve an already-populated production installation, but the source tree cannot independently regenerate that installation. The strongest code-backed production model candidates are the untracked rank GBT/fallback pipeline and shop ensemble/unit-price pipeline, followed by identity assignment and aggressive sanitation. The verification page, however, primarily exposes a separate SQL lookup validation plus hardcoded fallback values. Until model code, dependencies, loaders, immutable data references, model versions, metric artifacts, and interval/holdout tests are committed together, claims about current algorithms, WMAPE, and 95% coverage remain only partially auditable.
