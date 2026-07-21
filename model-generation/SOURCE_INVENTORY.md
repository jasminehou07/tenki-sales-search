# TENKI model-generation source inventory

This inventory classifies every recovered source family. “Current” means it is
part of the recovered production-oriented workflow; it does not mean a fresh
end-to-end rebuild has been proven.

## Production-oriented dashboard pipeline

### Current model and post-processing source

| Path | Classification | Purpose |
| --- | --- | --- |
| `dashboard-pipeline/core/pipeline_paths.py` | Current portability helper | Resolves dashboard, work, raw-data, and DuckDB paths |
| `dashboard-pipeline/core/build_rank_gbt_estimates.py` | Current rank trainer | Random 5% holdouts, XGBoost/sklearn training, rank 1-80 estimation, validation reports, guarded publishing |
| `dashboard-pipeline/core/fill_rank_shops_from_ranking.py` | Current identity restoration | Adds known item/shop identity and known sales to estimated rank rows |
| `dashboard-pipeline/core/fill_missing_rank_identity_from_recent.py` | Optional continuity fallback | Fills unresolved identity from recent mappings; not proof of same-day identity |
| `dashboard-pipeline/core/sanitize_rank_outputs.py` | Current sanitation | Repairs invalid values, intervals, and rank-shape anomalies while preserving identity |
| `dashboard-pipeline/core/shop_projection_model.py` | Current shared shop library | Shop history, event, group, prediction, correction, and scoring functions |
| `dashboard-pipeline/core/build_shop_projection_files.py` | Current shop publisher | Selects/blends shop projection candidates and writes monthly outputs |
| `dashboard-pipeline/core/experiment_shop_store_gbt.py` | Diagnostic | Compares shop/store/group candidates without intended publication |

### Legacy and migration source

| Path | Classification | Reason to retain |
| --- | --- | --- |
| `dashboard-pipeline/core/build_rank_gap_estimates.py` | Legacy bootstrap | Rebuilds an initial rank interpolation set; destructive to current work outputs |
| `dashboard-pipeline/core/build_rank_curves.py` | Legacy model | Earlier median rank curves; can overwrite current metric/curve files |
| `dashboard-pipeline/core/extend_rank_predictions_to_80.py` | Legacy migration | Extends older rank-20 output with fixed decay rather than retraining |
| `dashboard-pipeline/core/train_shop_level_estimates.py` | Legacy evaluator | Superseded by the current shop builder |
| `dashboard-pipeline/archive-patches/` | Historical server patches | Records one-off API repair history; not a rebuild or deploy entry point |

### Data preparation

| Path | Classification | Purpose or caution |
| --- | --- | --- |
| `dashboard-pipeline/data-prep/prep_paths.py` | Current portability helper | Supports consolidated and numbered raw-data layouts |
| `build_monthly_actuals_from_parquet.py` | Current preparation | Aggregates raw item sales into shop/genre/day monthly actuals |
| `build_shop_genre_mix.py` | Current preparation | Builds historical shop-to-genre mix features |
| `build_filter_options.py` | Current preparation | Produces genre/shop dropdown options and labels |
| `build_rank_summary_units.py` | Current compatibility summary | Aggregates rank sales and derives units from shop-estimate unit-price signals |
| `build_all_time_files.py` | Current compatibility summary | Produces all-time/monthly static summaries from prepared CSVs |
| `build_monthly_files.py`, `split_sales_by_date.py`, `split_item_sales_by_date.py` | Legacy static-site preparation | Retained to reproduce older CSV layouts; PostgreSQL/API paths should be preferred |
| `fill_rakuten_genre_names.py`, `fill_rakuten_genre_paths_and_translations.py` | Operational enrichment | Fetches public category labels and updates PostgreSQL; requires network and DB access |
| `update_server_dropdown_csvs.py` | Operational compatibility export | Regenerates static dropdown CSVs from PostgreSQL |
| `*.sql`, `import_rank_rows_to_postgres.sh` | Legacy/server-specific operations | Preserve exact historical commands; hardcoded paths must be reviewed before use |

### Recovered PostgreSQL loaders

The four files in `dashboard-pipeline/server-loaders/` are preserved operational
snapshots. They intentionally retain `/root` and `/opt/tenki-dashboard` paths.

| Loader | Classification | Purpose |
| --- | --- | --- |
| `load_raw_parquet_to_postgres.py` | Optional raw importer | Loads consolidated raw ranking, sales, and events into PostgreSQL |
| `load_dashboard_chunks_streaming.py` | Preferred large-data publisher | Streams prepared options/facts, writes parquet mirrors, refreshes views |
| `load_rank_chunks_batched.py` | Preferred large rank publisher | Loads rank rows in bounded batches |
| `load_dashboard_chunks_to_postgres.py` | Legacy memory-heavy publisher | Loads equivalent families by concatenating full datasets in memory |

Never run two alternative full/rank loaders for the same model version in one
publication. Use the schema snapshot in `../docs/manifests/server_schema_20260721.sql`
to inspect expected objects; do not assume it is a migration script.

## Historical daily-genre forecast

| Path | Classification | Purpose |
| --- | --- | --- |
| `daily-genre-forecast/sales_event_model.py` | Preserved experiment | Genre/day sales and quantity forecasting with chronological holdout |
| `daily-genre-forecast/tests/test_folder_discovery.py` | Current test | Verifies numbered and consolidated folder discovery and duplicate protection |
| `daily-genre-forecast/data/` | Feature references | Holidays, promotion intensity, event/group lookup inputs; no private raw rows |
| `daily-genre-forecast/evidence/` | Historical evidence | Metrics and analysis from the original 100-genre run; not live-dashboard validation |

## Deployment source retained outside the model folder

- `../deploy/server/nginx-tenki-dashboard.conf`: recovered sslip.io nginx site.
- `../deploy/server/tenki-dashboard-api.service`: recovered systemd API unit.
- `../docs/audit/`: read-only audit reports for local, model, server, and database state.
- `../docs/manifests/`: raw checksum and PostgreSQL schema snapshots.

## Deliberately excluded

- Raw parquet rows and company-private exports.
- PostgreSQL data directories and database dumps.
- Generated multi-gigabyte rank/shop CSV and parquet outputs.
- Model caches, `.joblib` artifacts not already represented by non-private evidence,
  Python bytecode, logs, SSH keys, `.env` files, passwords, and API keys.
