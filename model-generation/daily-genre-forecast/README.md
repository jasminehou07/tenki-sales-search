# Daily Genre Forecast Handoff

This folder contains a reproducible historical experiment for predicting daily
Rakuten sales and quantity at the **genre x day** level. It aggregates raw
item-level parquet exports, creates calendar, promotion, ranking, and lagged
history features, trains separate pre-2024 and 2024+ gradient-boosted models,
and evaluates the final portion of the timeline.

> This historical model is **not wired into the production TENKI dashboard**.
> Its model artifact and predictions are not what the live dashboard API serves.
> Treat it as a preserved experiment and a starting point for future model work.

## Contents

- `sales_event_model.py`: dataset preparation, feature engineering, training,
  validation, analysis, and artifact export.
- `requirements.txt`: Python dependencies.
- `data/`: holiday, event-strength, and previously derived promotion-effect
  reference files used as features.
- `evidence/`: preserved metrics and analysis from the historical 100-genre run.
- `env.example`: examples for selecting the raw-data root.
- `work/model_cache/`: generated cache location; created when the script runs.
- `outputs/`: generated model, predictions, metrics, and plots; created when the
  script runs.

Generated caches and outputs should not be assumed to exist in a fresh checkout.

## Setup

Python 3.11 or newer is recommended.

```bash
cd outputs/model-generation/daily-genre-forecast
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

The script resolves bundled feature files relative to this README, so it can be
launched from another working directory. The raw-data root is selected in this
order:

1. An explicit `--data-dir` command-line value.
2. `TENKI_RAW_DATA_DIR` when it is set before the script starts.
3. The local relative folder `data-links/` beside the script.

`--cache-dir`, `--output-dir`, `--holiday-file`,
`--promotion-effect-dir`, and `--event-strength-file` remain available as CLI
overrides.

## Raw-data layouts

The raw root must contain `events/events.parquet` and the sales/ranking folders.
The loader discovers the unsuffixed folder plus every directly adjacent numeric
batch (`2`, `3`, `4`, and so on).

### Local numbered layout

The current local source has this shape:

```text
/path/to/TENKI/data files/
  events/events.parquet
  genre-sales/*.parquet
  genre-sales2/*.parquet
  genre-sales3/*.parquet
  genre-ranking/*.parquet
  genre-ranking2/*.parquet
  genre-ranking3/*.parquet
```

Run it explicitly:

```bash
cd outputs/model-generation/daily-genre-forecast
.venv/bin/python sales_event_model.py \
  --data-dir "/path/to/TENKI/data files" \
  --rebuild-cache
```

Or use the environment variable:

```bash
cd outputs/model-generation/daily-genre-forecast
TENKI_RAW_DATA_DIR="/path/to/TENKI/data files" \
  .venv/bin/python sales_event_model.py --rebuild-cache
```

To use the default relative path, create `data-links/` and place symlinks named
`events`, `genre-sales`, `genre-sales2`, and so on inside it. Raw data should not
be copied into Git.

### Server consolidated layout

The server can consolidate all genres into the unsuffixed folders:

```text
/root/
  events/events.parquet
  genre-sales/*.parquet       # all available genres, including all 1,100 if present
  genre-ranking/*.parquet     # all available genres, including all 1,100 if present
```

From the handoff location, run:

```bash
cd "/root/src/model generation/daily-genre-forecast"
TENKI_RAW_DATA_DIR=/root \
  .venv/bin/python sales_event_model.py --rebuild-cache
```

The same command also works if numbered folders still exist beside the
unsuffixed folders.

### Duplicate protection

Each parquet filename represents one genre. Discovery reads each physical file
once and selects only one file for a repeated filename across matching folders.
The unsuffixed folder has first priority, followed by `2`, `3`, and later
batches. This prevents a consolidated copy and an older numbered copy from
doubling the genre's totals. If two files share a name but contain different
versions, place only the intended version in the raw root or pass a clean root
with `--data-dir`.

## Input schemas

### Sales parquet

Required columns:

| Column | Use |
| --- | --- |
| `date` | Daily time key |
| `item_genre` | Genre identifier; renamed to `genre_id` |
| `shop`, `item` | Counts of active shops and items |
| `sales` | Target: daily sales in JPY |
| `sales_items` | Target: daily quantity sold |
| `pv`, `uv` | Aggregated traffic context; excluded from model features |
| `sales_number` | Aggregated orders; excluded from model features |
| `reviews_posted`, `reviews_total` | Aggregated context; excluded from model features |

Rows are summed or counted into one row per genre and day.

### Ranking parquet

Required columns: `date`, `genre_id`, `shop`, `item`, `rank`, and `price`.
They produce ranked-item/shop counts, best/mean rank, and price summaries per
genre and day.

### Events and bundled reference data

- `events/events.parquet`: `name`, `start`, and `end` promotion windows.
- `data/japan_holidays.csv`: Japanese holiday dates.
- `data/rakuten_event_strength.csv`: promotion multipliers, caps, entry rules,
  and event scope.
- `data/promotion_effects/*.csv`: historical promotion-lift and genre-group
  lookup features derived before this handoff.

## Features and model

The script builds:

- genre identity and ranking group;
- day-of-week, day-of-month, week, month, quarter, year, weekend, and
  month-boundary features;
- cyclic weekly and monthly seasonality;
- active promotion flags, event counts, days to/from events, pre/post-event
  windows, overlapping-event strength, point multipliers, point caps, and
  shop-around intensity;
- Japanese holiday flags and pre/post-holiday windows;
- promotion/holiday overlap and historical group-specific lift features;
- same-day ranking coverage and price summaries;
- sales and quantity lags at 1, 7, 14, and 28 days;
- trailing 7-day and 28-day sales and quantity means, shifted by one day.

Sales and quantity use separate `HistGradientBoostingRegressor` pipelines. Both
fit `log1p(target)` with absolute-error loss and transform predictions back to
the original scale. Separate models are trained for dates before 2024 and dates
from 2024 onward. Genre and ranking group are one-hot encoded.

Promotion names are retained only when their training-period absolute
correlation with log sales or log quantity meets the configured threshold and
has enough active rows. Change this with
`--promotion-correlation-threshold`.

## Holdout and metrics

This script does **not** use the dashboard's random 95%/5% rank-value holdout.
It performs a chronological holdout: by default, the final 180 calendar days are
test data (`--test-days 180`), while earlier rows are training data. WAPE is
calculated as:

```text
sum(abs(actual - prediction)) / sum(abs(actual))
```

The JSON key is named `wape`; it is the same weighted absolute percentage error
commonly labeled WMAPE on the dashboard.

### Preserved evidence scope

The checked-in evidence records the historical run that read only the original
unsuffixed folders:

| Target | WAPE / WMAPE | Test rows | Genres | Test period |
| --- | ---: | ---: | ---: | --- |
| Daily genre sales | 27.73% | 17,897 | 100 | 2025-12-03 to 2026-05-31 |
| Daily genre quantity | 23.54% | 17,897 | 100 | 2025-12-03 to 2026-05-31 |

Sources: `evidence/sales_event_metrics.json` and
`evidence/quantity_event_metrics.json`.

These numbers are evidence for that exact 100-genre historical experiment only.
They are **not** validation for the newly discovered numbered batches, the
1,100-genre consolidated server corpus, the rank-imputation model, shop-level
predictions, or the production dashboard. Re-running with more genres will
produce different metrics and may be better or worse.

## Outputs

By default, generated files are written to `outputs/` beside the script:

- `sales_event_model.joblib`: early/late sales and quantity pipelines, feature
  list, and regime cutoff.
- `sales_event_predictions.csv` and `quantity_event_predictions.csv`: holdout
  actuals, predictions, and absolute errors.
- `sales_event_metrics.json` and `quantity_event_metrics.json`: aggregate model
  metrics and run coverage.
- `model_struggles.csv`: WAPE and bias by genre and ranking group.
- `promotion_impact.csv`: performance during named promotions.
- `promotion_regression_effects.csv`: event correlations, estimated lifts, and
  feature-retention decisions.
- `sales_event_feature_importance.csv` and `.png`: permutation importance.
- `work/model_cache/daily_genre_dataset_v6.parquet`: prepared dataset cache.

Use a new output directory when comparing runs so historical evidence is not
overwritten:

```bash
.venv/bin/python sales_event_model.py \
  --data-dir "/path/to/raw-root" \
  --cache-dir "/path/to/run/cache" \
  --output-dir "/path/to/run/results" \
  --rebuild-cache
```

## Reproduction cautions

- Rebuild the cache whenever raw files, feature CSVs, or feature code change.
- Record the Git commit, exact command, Python/package versions, raw-file hashes,
  cache hash, date coverage, genre count, and output hashes for a defensible run.
- Same-day ranking counts, ranks, and prices are valid only if rankings are
  available at prediction time. Otherwise they leak information from the day
  being predicted and must be lagged or removed.
- `active_items` and `active_shops` are derived from same-day sales records and
  can leak target-day activity. For a true future forecast, replace them with
  lagged values or known-in-advance catalog data.
- Promotion-lift reference CSVs must be generated from training dates only. If
  they include holdout dates, validation is optimistic.
- Scheduled future promotions and holidays are acceptable known-ahead inputs,
  but post-event features must never use outcomes from the future.
- The model does not create prediction intervals or calibrate 95% confidence
  intervals.
- Missing genres, schema drift, cancellations, returns, and changed Rakuten
  ranking behavior can materially affect accuracy.
- The early/late regime split does not replace rolling backtests. Before
  production use, validate several time windows and report performance by genre,
  promotion, sales scale, and data-coverage group.

## Safe verification without training

Syntax check:

```bash
python -m py_compile sales_event_model.py
```

Folder discovery can be tested independently by importing
`discover_data_directories` and `discover_parquet_files` against a temporary
folder. This does not read parquet contents or fit a model.
