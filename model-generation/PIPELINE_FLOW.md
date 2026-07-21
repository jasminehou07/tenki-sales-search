# Recovered TENKI pipeline flow

This is the exact recovered architecture, including boundaries where manual
review or server-specific operations remain necessary.

## 1. Raw source and integrity

Inputs are `events/events.parquet`, genre ranking parquet, and genre sales
parquet. The server has consolidated `genre-ranking/` and `genre-sales/`
directories with 1,100 files each. Local source is split among unsuffixed, `2`,
and `3` directories.

Before reading rows:

1. Compare paths and SHA256 values with `../docs/manifests/`.
2. Record file counts, byte totals, duplicate filenames, schemas, and date ranges.
3. Confirm ranking and sales filenames match by genre ID.
4. Record whether the run uses consolidated or numbered folders.

Portable discovery selects one parquet per filename. The unsuffixed directory
wins duplicate-name conflicts.

## 2. Prepare actuals and reference data

For the dashboard pipeline:

1. `data-prep/build_monthly_actuals_from_parquet.py` reads sales parquet and
   aggregates `sales`, `sales_items`, and `pv` into shop/genre/day rows under
   `data/by-month/`.
2. Promotion windows are represented by `data/events.csv`; genre labels are
   represented by `data/genre_names.csv`.
3. `data-prep/build_shop_genre_mix.py` summarizes historical shop/genre mix.
4. Legacy split/all-time scripts can recreate older static CSV layouts, but the
   preferred serving path is PostgreSQL through the API.

The older DuckDB SQL files contain historical workstation paths and are retained
as legacy evidence. They are not portable entry points.

## 3. Build rank/item features

The rank pipeline joins known positive sales to rank rows, then derives:

- genre and broader genre-group identity;
- rank and rank-shape/calibration context;
- day-of-week, month, season, and calendar timing;
- event name, intensity, overlapping promotions, and before/after windows;
- historical genre/rank performance and spike behavior;
- available known rank anchors and recent identity mappings.

The generated training cache is `work/rank_training_known_sales.csv`. It is not
included in Git because it is generated and can contain company-derived rows.
Its hash and row/date coverage must be recorded for a reproducible run.

## 4. Train and validate rank/item sales

Run `core/build_rank_gbt_estimates.py` without publishing first. It performs
three deterministic random holdouts, hiding approximately 5% of known rank-sales
rows and training on the remaining 95% for each split. Preferred training uses
XGBoost; sklearn histogram gradient boosting is the documented fallback.

Review at least:

- overall WMAPE, Median APE, and percent within 25%;
- holdout sample count and target-value denominator;
- metrics by split, genre, and event;
- residual bias by rank and sales scale;
- interval coverage and width;
- rank 1-80 completeness and descending-shape diagnostics.

This random-row validation measures missing-value imputation, not future-date
forecasting. Do not describe it as a forward forecast test.

## 5. Publish and restore rank identity

Only after validation review:

1. Run the trainer with `--publish-output`; the built-in gate publishes only if
   WMAPE improves unless `--force-publish` is explicitly supplied.
2. Run `fill_rank_shops_from_ranking.py` to attach `(date, genre, rank)` item and
   shop IDs from rankings and to replace estimates with known sales where found.
3. Optionally run `fill_missing_rank_identity_from_recent.py`; mark these rows as
   continuity fallbacks, not known same-day identity.
4. Run `sanitize_rank_outputs.py` to repair invalid sales/interval/shape values
   while retaining item and shop identity.
5. Inspect `work/rank_output_sanity_report.csv` and sample known/estimated/cleaned
   rows before database loading.

## 6. Train and publish shop projections

`core/build_shop_projection_files.py` uses monthly actuals, history, seasonality,
genre/shop groups, promotion timing/intensity, and blended candidate models. The
recovered production builder writes outputs directly and has no validation-only
flag, so it must run against backed-up staging paths.

Sales are predicted directly. In the recovered production path, units are
principally derived using historical shop/genre unit-price signals rather than
being a fully independent live model. Page-view predictions are zero-filled and
must not be presented as a validated prediction.

## 7. Build API-facing prepared datasets

Use the current preparation/compatibility scripts as required for the target
schema. Important generated families include:

- monthly rank/item rows through rank 80;
- genre daily and rank summary values;
- shop daily and shop/genre daily values;
- filter options and genre labels;
- all-time compatibility summaries;
- validation metric rows and holdout predictions.

Record output hashes, row counts, distinct dimensions, min/max dates, model
version, and source run ID before loading PostgreSQL.

## 8. Load PostgreSQL

The recovered server loaders expect the schema represented by
`../docs/manifests/server_schema_20260721.sql` and prepared files under the
production server paths.

Recommended order:

1. Optionally load consolidated raw parquet with
   `server-loaders/load_raw_parquet_to_postgres.py`.
2. Apply reviewed schema/migrations separately; the schema manifest is an
   inspection snapshot, not an automatically safe migration.
3. Load options and prepared facts with
   `load_dashboard_chunks_streaming.py --skip-rank`.
4. Load the large rank family with `load_rank_chunks_batched.py`.
5. Refresh dependent materialized views if the rank loader does not do so.
6. Do not also run the memory-heavy full loader for the same model version.

Each load must use a unique `MODEL_VERSION`. Verify constraints and indexes with
the schema manifest, then compare database row counts and date/dimension coverage
to the prepared files.

## 9. Serve through the dashboard API

The browser calls the Node API over the sslip.io HTTPS origin. The API runs
parameterized PostgreSQL queries and returns JSON. nginx serves the static site
and proxies `/api/` and `/health`; the browser never connects to PostgreSQL.

Recovered deployment snapshots are in `../deploy/server/`. Runtime secrets stay
in the protected server environment and are not part of this package.

## 10. Acceptance before switching traffic

Verify:

- `/health` and representative API queries for one day, ranges, and all time;
- rank 1-80 rows, item/shop identities, known vs estimated source labels, and
  intervals containing the point estimate;
- genre and shop totals against direct SQL aggregates;
- validation metrics against the stored holdout predictions;
- dropdown count/name/sales ordering;
- dashboard behavior for single-day, range, all-genre, and all-shop selections;
- restart behavior for PostgreSQL, API service, and nginx.

Keep the previous model version and database backup until all checks pass.
