# TENKI dashboard model-generation pipeline

This directory is a recovered, portable package of the scripts used to build
rank-sales and shop projection files for the TENKI dashboard. It documents the
dependencies and the known execution relationships, but it is **not yet a
verified one-command rebuild**. The raw-data preparation and database import
steps live elsewhere in the recovered project and must be checked before a
production rerun.

Run commands from this `dashboard-pipeline` directory so imports from `core/`
resolve consistently.

## Environment

Python 3.10 or newer is recommended. Create an isolated environment and install
the recovered Python dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

`fill_rank_shops_from_ranking.py` also requires the DuckDB command-line binary.
It does not use the Python `duckdb` package.

The recovered PostgreSQL loaders use pandas, PyArrow for parquet output, and
Psycopg 3. `psycopg[binary]` is included in `requirements.txt` so a new machine
does not need a separate local `libpq` build for the basic setup.

All core scripts resolve paths through `core/pipeline_paths.py`:

| Variable | Meaning | Default |
| --- | --- | --- |
| `TENKI_DASHBOARD_ROOT` | Dashboard output root containing `data/` | The recovered `outputs/` repository root |
| `TENKI_WORK_DIR` | Mutable caches, rank rows, identity maps, and reports | A sibling `work/` directory beside the dashboard root |
| `TENKI_RAW_DATA_DIR` | Raw TENKI/Rakuten parquet directory | `<dashboard-root>/data-links` |
| `TENKI_DUCKDB_BIN` | Exact DuckDB CLI executable | First `duckdb` found on `PATH` |
| `TENKI_SERVER_DATA_DIR` | Prepared server data used by the dropdown compatibility export | `/opt/tenki-dashboard/site-data/data` |

Example server configuration:

```bash
export TENKI_DASHBOARD_ROOT=/root/src/tenki-sales-search
export TENKI_WORK_DIR=/root/src/tenki-sales-search-work
export TENKI_RAW_DATA_DIR=/root
export TENKI_DUCKDB_BIN=/usr/local/bin/duckdb
```

Use absolute paths. The scripts create some output directories, but they do not
validate that the chosen roots belong to the intended environment.

`env.example` contains credential-free local and server templates for these
four variables. It intentionally does not contain `DATABASE_URL` or any secret.

## Required inputs

The recovered scripts expect the following layout after environment variables
are resolved:

```text
$TENKI_RAW_DATA_DIR/
  genre-ranking/*.parquet
  genre-ranking2/*.parquet
  genre-ranking3/*.parquet
  genre-sales/*.parquet
  genre-sales2/*.parquet
  genre-sales3/*.parquet

$TENKI_DASHBOARD_ROOT/data/
  by-month/*.csv
  events.csv
  genre_names.csv

$TENKI_WORK_DIR/
  ranked-shops/*.csv
  rank_training_known_sales.csv        # generated cache; optional initially
```

Raw ranking parquet files must contain `date`, `shop`, `item`, `rank`, and
`genre_id`. Matching sales parquet files must contain `date`, `shop`, `item`,
and `sales`. Monthly shop/genre CSVs must contain `date`, `shop`, `genre`,
`sales`, and `units`. `events.csv` must contain `name`, `start_date`, and
`end_date`. The rank scripts currently discover only the three explicitly named
ranking and sales folders above.

`data/by-month`, `events.csv`, and `genre_names.csv` are preparation outputs,
not produced by the core scripts. Confirm or rerun the appropriate scripts in
`data-prep/` before model generation. Database loading is also a separate step.

The portable data-prep path helper discovers both consolidated server folders
and any numbered local partitions. It selects one parquet per filename and
prefers the unsuffixed folder when duplicate genre filenames exist. See
`data-prep/README.md` for the current and legacy preparation entry points.

## Safe run order

There are two independent production branches: rank/item estimates and shop
projections. Back up `$TENKI_WORK_DIR` and `$TENKI_DASHBOARD_ROOT/data` before
any publishing or post-processing command.

### A. Rank/item estimates

1. Prepare `data/by-month`, `events.csv`, and `genre_names.csv`; verify the raw
   parquet directories and date coverage.

2. Ensure `$TENKI_WORK_DIR/ranked-shops` contains monthly rows with known sales.
   On a fresh workspace only, the recovered bootstrap is:

   ```bash
   python core/build_rank_gap_estimates.py
   ```

   This is a legacy interpolation bootstrap and **deletes every existing CSV in
   `$TENKI_WORK_DIR/ranked-shops` before rebuilding it**. Do not run it over a
   populated production work directory without a backup.

3. Validate the current rank model without publishing:

   ```bash
   python core/build_rank_gbt_estimates.py
   ```

   This is the safe default. It trains and reports validation metrics but does
   not replace website CSVs.

4. After reviewing WMAPE, Median APE, within-25% rate, genre/event breakdowns,
   and coverage, publish only when intended:

   ```bash
   python core/build_rank_gbt_estimates.py --publish-output
   ```

   Publishing occurs only when WMAPE improves over the current
   `rank_model_metrics.csv`. It replaces all monthly CSVs in
   `$TENKI_WORK_DIR/ranked-shops` from a staging directory and writes rank
   curves, event factors, and validation metrics under
   `$TENKI_DASHBOARD_ROOT/data`.

   `--force-publish` bypasses the WMAPE improvement gate and has an effect only
   with `--publish-output`:

   ```bash
   python core/build_rank_gbt_estimates.py --publish-output --force-publish
   ```

5. Restore rank identity and known sales from the ranking/sales parquet files:

   ```bash
   python core/fill_rank_shops_from_ranking.py
   ```

   This clears and rebuilds `$TENKI_WORK_DIR/rank-shop-map`, then edits every
   monthly rank CSV in place. It uses `(date, genre, rank)` to attach the ranked
   `shop` and `item`; known item sales replace model estimates and become exact
   intervals.

6. Optionally fill remaining identity gaps from the most recent three mapping
   months:

   ```bash
   python core/fill_missing_rank_identity_from_recent.py
   ```

   This edits monthly rank CSVs in place. It is a continuity fallback, not proof
   that an item held the same rank on the missing day.

7. Apply caps, descending-shape checks, and interval repairs:

   ```bash
   python core/sanitize_rank_outputs.py
   ```

   This edits all monthly rank CSVs in place and writes
   `$TENKI_WORK_DIR/rank_output_sanity_report.csv`. Identity columns are
   preserved when a sales value is adjusted.

8. Load the reviewed rank outputs into PostgreSQL using the recovered import
   process described in **PostgreSQL loader order** below. The core model
   package does not automatically publish to the API or database.

### B. Shop projections

1. Verify monthly shop/genre actuals and event coverage.

2. Optionally compare experimental store, shop-group, genre-group, and blended
   models without writing dashboard outputs:

   ```bash
   python core/experiment_shop_store_gbt.py
   ```

3. Build and publish the recovered shop sales and units projections:

   ```bash
   python core/build_shop_projection_files.py
   ```

   This command has **no validation-only or publish flag**. It writes tuning
   parameters and metrics, deletes existing monthly files in
   `data/shop-estimates-by-month` and `data/trend-estimates-by-month`, then
   writes replacement monthly and all-time outputs. Run it only after a backup
   and review the source date coverage first.

4. Load the reviewed shop outputs into PostgreSQL using the separate import
   process described below. The core builder itself writes CSV files, not
   database rows.

## PostgreSQL loader order

The four recovered files in `server-loaders/` are intentionally unchanged and
still contain server-specific `/root` and `/opt/tenki-dashboard` paths. Run them
only on a host where those paths match, or make a separately reviewed portable
copy later. All loaders require the target schema, constraints, and materialized
views to exist before they run.

Set database connection information only in the process environment:

```bash
export DATABASE_URL='<set by the protected server environment>'
export MODEL_VERSION='a-unique-model-version'
```

The value above is a format example, not a credential. Prefer a protected
service environment file in production and do not commit the real URL.

### Stage 1: optional raw source import

Run this before data preparation/model generation only when PostgreSQL needs a
fresh copy of the raw sources:

```bash
python server-loaders/load_raw_parquet_to_postgres.py --limit 2
python server-loaders/load_raw_parquet_to_postgres.py
```

The first command is a small connectivity/schema test. The full command reads
`/root/genre-ranking/*.parquet`, `/root/genre-sales/*.parquet`, and
`/root/events/events.parquet`; it loads `raw_genre_rankings`,
`raw_genre_sales`, and `promotion_events`. Rankings and sales use
`ON CONFLICT DO NOTHING`, while promotion events are deleted and reloaded. The
loader currently reads only the unsuffixed raw folders, so confirm that they
already contain the complete source set before using it. `--skip-rankings` and
`--skip-sales` can isolate either large branch.

### Stage 2: generate and review model outputs

Run the rank and/or shop model sequence above. The recovered dashboard loaders
expect prepared site files under `/opt/tenki-dashboard/site-data/data`, including
filter options, monthly summaries, rank files organized by genre, and monthly
shop estimates. Producing those layouts from core outputs is a data-preparation
step and must finish before Stage 3.

### Stage 3: publish dashboard tables

For the preferred memory-bounded full load, use the streaming loader:

```bash
python server-loaders/load_dashboard_chunks_streaming.py
```

It loads options, genre daily, rank daily, shop daily, and shop/genre daily;
writes partitioned parquet mirrors under `/opt/tenki-dashboard/parquet`; and
refreshes the two dashboard materialized views. It truncates `genres` and
`shops`, and deletes rows for the selected `MODEL_VERSION` before reloading each
fact table.

If rank data is too large for the normal rank stage, skip rank in the full load
and then use the batched rank loader:

```bash
python server-loaders/load_dashboard_chunks_streaming.py --skip-rank
RANK_BATCH_SIZE=500 python server-loaders/load_rank_chunks_batched.py
```

`load_rank_chunks_batched.py` is rank-only. It deletes existing
`dashboard_genre_rank_daily` rows for `MODEL_VERSION`, loads files in bounded
batches, and writes batch parquet mirrors. After it finishes, refresh any
materialized view that depends on rank data if the database schema defines one;
the rank-only script does not refresh views itself.

`load_dashboard_chunks_streaming.py --only-rank` is another rank-only option,
but do not combine multiple rank loaders for the same model version in one run.

The older alternative is:

```bash
python server-loaders/load_dashboard_chunks_to_postgres.py
```

It loads the same dashboard families but concatenates whole datasets in memory
and writes one parquet file per family. Treat it as **legacy for large data** and
use it instead of, not after, the streaming full loader. It also truncates
options, deletes/reloads the selected model version, and refreshes materialized
views.

After any publish, verify table row counts, min/max dates, distinct genres and
shops, the active `MODEL_VERSION`, materialized-view refresh times, and API
responses before directing dashboard traffic to the new version.

## Holdout and model behavior

### Rank model

`build_rank_gbt_estimates.py` trains on known positive rank-sales rows for ranks
1-20 and predicts ranks 1-80. For validation it independently hides a random 5%
of known rows three times, using deterministic seeds, trains on the remaining
95%, and aggregates the scored holdouts. It writes/report WMAPE, Median APE,
the percentage within 25%, and breakdowns by validation split, genre, and event.
This is a random-row holdout, not a future-date test, so nearby dates from the
same genre can exist in both train and test sets.

The preferred rank regressor is `xgboost.XGBRegressor`. If XGBoost cannot be
imported, the script preserves behavior by falling back to scikit-learn's
`HistGradientBoostingRegressor`. The selected implementation is recorded in the
metrics `model` field. Installing `requirements.txt` installs XGBoost; if the
target machine cannot install it, omit that package and expect the fallback
path and different validation results.

The rank model learns genre/group, rank, calendar, event intensity, event-window,
overlap, spike, history, and calibration features. It creates 95% low/high
bands from holdout residual factors, then applies a descending rank shape.

### Shop model

`shop_projection_model.py` supplies shared history, seasonality, event,
genre-tuning, correction, prediction, and scoring functions. The production
shop builder randomly hides 5% of shop/genre/day rows using seed `20260615`.
It compares lag/event baselines, trained factor correction, direct store GBT,
shop-group correction, shop+genre-group correction, optional activity gating,
and blends; the lowest holdout WMAPE candidate is used for inference.

Sales and units are separate targets in the experimental comparison. The
current production builder predicts sales directly, then derives units from
actual shop/genre average unit prices using its own random 5% validation. It
does not currently train or publish page-view predictions; page-view columns in
the projection output are zero-filled.

## Script reference and exact I/O

| Script | Status and role | Required inputs | Outputs and mutations |
| --- | --- | --- | --- |
| `pipeline_paths.py` | Current library; resolves portable paths | The four optional environment variables | No files; imported by the other scripts |
| `build_rank_gbt_estimates.py` | Current rank trainer/publisher | `work/ranked-shops/*.csv`, `data/events.csv`, `data/genre_names.csv`, `data/by-month/*.csv`; optionally reuses `work/rank_training_known_sales.csv` | A validation-only run may create the training cache but does not replace rank outputs. A guarded publish replaces `work/ranked-shops/*.csv` and writes rank curves, event factors, and four metric CSVs under `data/` |
| `fill_rank_shops_from_ranking.py` | Current rank identity post-processor | Raw `genre-ranking{,2,3}` and matching `genre-sales{,2,3}` parquet, plus `work/ranked-shops/*.csv`; DuckDB CLI | Clears/rebuilds `work/rank-shop-map/*.csv`; edits rank CSVs in place with shop, item, and known sales |
| `fill_missing_rank_identity_from_recent.py` | Optional continuity fallback | `work/ranked-shops/*.csv` and `work/rank-shop-map/*.csv` | Edits shop/item fields in rank CSVs in place using up to three recent map months |
| `sanitize_rank_outputs.py` | Current rank sanitation post-processor | `work/ranked-shops/*.csv` and `work/rank_training_known_sales.csv` | Edits rank CSV sales/source/interval fields in place and writes `work/rank_output_sanity_report.csv` |
| `build_shop_projection_files.py` | Current shop trainer/publisher | `data/by-month/*.csv`, `data/events.csv`, and `data/genre_names.csv` | Writes sales/units tuning and metric CSVs; clears/replaces `data/shop-estimates-by-month/*.csv` and `data/trend-estimates-by-month/*.csv`; writes two compact `data/all-time/*.csv` files |
| `shop_projection_model.py` | Current shared model library | Data frames and paths supplied by callers | No direct command or standalone file output |
| `experiment_shop_store_gbt.py` | Diagnostic comparison | `data/by-month/*.csv`, `data/events.csv`, and `data/genre_names.csv` | Prints sales and units holdout metrics; no intended file output |
| `build_rank_gap_estimates.py` | Legacy bootstrap interpolation | Raw `genre-ranking{,2,3}` and matching `genre-sales{,2,3}` parquet | Deletes and rebuilds `work/ranked-shops/*.csv`, only through display rank 20 |
| `build_rank_curves.py` | Legacy median rank model | `data/ranked-shops/*.csv` and `data/events.csv` | Overwrites `data/rank_curves.csv`, `data/rank_event_factors.csv`, and `data/rank_model_metrics.csv`; do not run after a current GBT publish |
| `extend_rank_predictions_to_80.py` | Legacy migration for old rank-20 output | `work/ranked-shops/*.csv` with rank 20 anchors and interval columns | Rewrites each monthly rank CSV in place through rank 80 using fixed power decay |
| `train_shop_level_estimates.py` | Legacy shop evaluator | `data/by-month/*.csv` and `data/events.csv` | Overwrites `data/rakuten_shop_estimates.csv`; superseded by the current shop builder |

Recovered server loaders:

| Loader | Status and role | Required inputs | Outputs and mutations |
| --- | --- | --- | --- |
| `load_raw_parquet_to_postgres.py` | Optional pre-model raw importer | Fixed `/root/genre-ranking`, `/root/genre-sales`, `/root/events/events.parquet`; PostgreSQL raw tables | Replaces promotion events; inserts ranking/sales rows with conflict skipping |
| `load_dashboard_chunks_streaming.py` | Preferred full dashboard publisher | Fixed `/opt/tenki-dashboard/site-data/data` prepared CSV tree; dashboard schema and views | Reloads options and selected-version fact rows, writes partitioned parquet mirrors, refreshes views |
| `load_rank_chunks_batched.py` | Preferred companion for very large rank data | Fixed ranked-by-genre CSV tree; `DATABASE_URL`, optional `MODEL_VERSION` and `RANK_BATCH_SIZE` | Replaces selected-version rank rows and writes batched parquet mirrors; does not refresh views |
| `load_dashboard_chunks_to_postgres.py` | Legacy memory-heavy full publisher | Same prepared site tree and database objects as the streaming loader | Reloads the same table families, writes monolithic parquet mirrors, refreshes views |

## Output inventory

Current rank outputs:

```text
$TENKI_WORK_DIR/ranked-shops/YYYY-MM.csv
$TENKI_WORK_DIR/rank_training_known_sales.csv
$TENKI_WORK_DIR/rank-shop-map/YYYY-MM.csv
$TENKI_WORK_DIR/rank_output_sanity_report.csv
$TENKI_DASHBOARD_ROOT/data/rank_curves.csv
$TENKI_DASHBOARD_ROOT/data/rank_event_factors.csv
$TENKI_DASHBOARD_ROOT/data/rank_model_metrics.csv
$TENKI_DASHBOARD_ROOT/data/rank_model_metrics_by_split.csv
$TENKI_DASHBOARD_ROOT/data/rank_model_metrics_by_genre.csv
$TENKI_DASHBOARD_ROOT/data/rank_model_metrics_by_event.csv
```

Current shop outputs:

```text
$TENKI_DASHBOARD_ROOT/data/shop-estimates-by-month/YYYY-MM.csv
$TENKI_DASHBOARD_ROOT/data/trend-estimates-by-month/YYYY-MM.csv
$TENKI_DASHBOARD_ROOT/data/all-time/shop_estimates_monthly.csv
$TENKI_DASHBOARD_ROOT/data/all-time/trend_estimates_monthly.csv
$TENKI_DASHBOARD_ROOT/data/shop_projection_genre_params.csv
$TENKI_DASHBOARD_ROOT/data/shop_projection_metrics.csv
$TENKI_DASHBOARD_ROOT/data/shop_projection_units_params.csv
$TENKI_DASHBOARD_ROOT/data/shop_projection_units_metrics.csv
```

The source still prints page-view parameter/metric destinations, but the
current `build_projection()` path does not call a page-view trainer. Do not
treat old page-view files as newly regenerated evidence.

## Reproduction checklist

Before calling a rebuild reproducible, record the source snapshot and verify:

- raw parquet folder counts, schemas, checksums, and date coverage;
- `events.csv`, `genre_names.csv`, and monthly actuals provenance;
- Python, XGBoost, scikit-learn, pandas, NumPy, PyArrow, and DuckDB versions;
- environment-variable values and available disk/RAM;
- validation metrics before publishing;
- row counts and date/genre/shop coverage after each stage;
- PostgreSQL import commands, table counts, indexes, and API responses.

Use `../RUN_MANIFEST_TEMPLATE.yaml` and `../REPRODUCIBILITY_CHECKLIST.md` to
capture those items. A clean-machine, end-to-end reproduction still needs to be
tested before the package can be promised as a single command.
