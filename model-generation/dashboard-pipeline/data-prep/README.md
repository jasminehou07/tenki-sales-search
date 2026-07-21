# Dashboard data-preparation source

Run Python commands from this directory. `prep_paths.py` resolves:

- `TENKI_DASHBOARD_ROOT` for prepared dashboard data;
- `TENKI_WORK_DIR` for large mutable intermediates;
- `TENKI_RAW_DATA_DIR` for raw events/ranking/sales folders.

The raw discovery helper supports both `genre-sales/` alone and numbered layouts
such as `genre-sales/`, `genre-sales2/`, and `genre-sales3/`. Duplicate filenames
are read once, preferring the unsuffixed folder.

## Current preparation scripts

| Script | Purpose | Main output |
| --- | --- | --- |
| `build_monthly_actuals_from_parquet.py` | Aggregate sales parquet to shop/genre/day | `data/by-month/YYYY-MM.csv` |
| `build_shop_genre_mix.py` | Historical shop/genre mix and unit-rate features | `data/shop_genre_mix.csv` |
| `build_filter_options.py` | Dropdown labels and totals | `data/filter_options.csv`, `data/genre_names.csv` |
| `build_rank_summary_units.py` | Rank-total compatibility rows and derived unit estimates | `data/rank-summary-by-month/`, all-time summary |
| `build_all_time_files.py` | Static all-time/monthly compatibility summaries | `data/all-time/` |

These scripts write generated company-derived data and may replace files. Point
`TENKI_DASHBOARD_ROOT` and `TENKI_WORK_DIR` at staging paths for rehearsal.

## Operational database/label utilities

- `fill_rakuten_genre_names.py` fetches public Rakuten category names and updates
  PostgreSQL through local `psql`.
- `fill_rakuten_genre_paths_and_translations.py` fetches paths, uses an external
  translation endpoint, and updates PostgreSQL.
- `update_server_dropdown_csvs.py` exports current PostgreSQL labels/options to
  the static compatibility files. Override its server path with
  `TENKI_SERVER_DATA_DIR`.

These require network/database access and are not model-training steps. Review
API terms, translations, and database backups before running them.

## Legacy compatibility source

- `split_sales_by_date.py`, `split_item_sales_by_date.py`, and
  `build_monthly_files.py` reproduce the older daily/monthly static CSV layout.
- `build_tenki_data.sql` and `build_tenki_item_data.sql` preserve old DuckDB
  commands with workstation-specific paths. Treat them as historical evidence;
  parameterize a reviewed copy before use.
- `import_rank_rows_to_postgres.sh` and the other SQL files are server-specific
  operational history, not a portable one-command pipeline.

Prefer the PostgreSQL/API serving path for the live dashboard. Static CSV
generation remains useful for audits, comparisons, and rollback evidence.
