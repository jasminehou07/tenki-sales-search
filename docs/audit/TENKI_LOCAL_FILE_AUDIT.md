# TENKI Local File Audit

Audit snapshot: 2026-07-21 17:44 JST
Mode: read-only discovery and metadata inspection; this report is the only file created by this audit.
Scope: locally accessible TENKI, Rakuten, sales/ranking, and model-generation material on this Mac.

## Executive Summary

Four durable local roots and three temporary handoff copies contain the relevant material:

| Classification | Absolute path | Disk size | Main role |
|---|---|---:|---|
| Source repository plus model artifacts | `/Users/jasminehou/Documents/Codex/2026-06-01/after-building-a-dashbaord-that-explores` | 600 MB | `tenki-past-sales-model`; daily genre/event model, trained artifact, evidence, reports, and ignored model caches |
| Source repository plus generated exploration outputs | `/Users/jasminehou/Documents/Codex/2026-06-01/how-to-install-ductdb-on-this` | 126 MB | `tenki-dashboard`; DuckDB exploration database, dashboard summaries, Rakuten category-page caches, and reports |
| Current dashboard repository and untracked generation handoff | `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create` | 6.3 GB | Current sales-search frontend/API, model/ranking scripts, and very large generated monthly ranking CSVs |
| Critical raw source data | `/Users/jasminehou/Downloads/TENKI/data files` | 859 MB | 598 parquet files plus four summary CSVs: events, 300 sales genres, and 297 ranking genres |
| Temporary archive | `/private/tmp/tenki-sales-search-src.tgz` | 98,705 bytes | 29-entry server/source handoff archive |
| Temporary archive | `/private/tmp/tenki-dashboard-code-handoff.tgz` | 97,353 bytes | 23-entry dashboard code handoff archive |
| Temporary extracted copy | `/private/tmp/tenki-src-handoff.oX23AZ` | 476 KB | Extracted 22-file handoff tree; partly stale relative to the current dashboard worktree |

The raw parquet directory is the most important local dependency. The model repositories do not contain the raw TENKI exports. The current June 2 pipeline is the only local code observed that explicitly reads all three numbered sales/ranking batches. The earlier model and exploration roots still reference an old, now-missing layout.

No notebooks (`.ipynb`) were found in the relevant roots. No relevant local material was found elsewhere in Desktop, other Documents/Downloads locations, readable Library areas, `/Volumes`, or local `/opt`.

## Search Coverage and Limits

The inventory searched names and text-file references under `/Users`, `/Volumes`, `/private/tmp`, and `/opt`, with focused inspection of `/Users/jasminehou/Documents`, `/Users/jasminehou/Downloads`, `/Users/jasminehou/Desktop`, `/Users/jasminehou/.codex`, and the four roots above. `rg` was unavailable, so `find`, `grep`, `du`, `stat`, `wc`, `cmp`, `shasum`, DuckDB metadata queries, and Git plumbing were used.

The search intentionally pruned dependency/vendor trees, caches, Git object contents, Trash, and known credential locations. macOS-protected or otherwise unreadable paths were skipped. The scan did not contact the TENKI server and did not inspect the server paths `/root/src/model generation`, `/root/src/tenki-sales-search`, `/opt/tenki-dashboard`, or the server Postgres database; those are documented dependencies, not local findings.

## 1. Raw TENKI/Rakuten Source Data

### Root

`/Users/jasminehou/Downloads/TENKI/data files`

Classification: **source data; critical and not reproducible from the local repositories alone**.

| Absolute path | Files / logical bytes | Rows and coverage | Purpose |
|---|---:|---|---|
| `/Users/jasminehou/Downloads/TENKI/data files/events/events.parquet` | 1 parquet; 17,298 bytes | 1,125 rows; 20 event names; 2017-01-05 through 2026-12-30 | Rakuten event windows (`name`, `start`, `end`) |
| `/Users/jasminehou/Downloads/TENKI/data files/genre-ranking` | 98 parquet; 54,164,934 bytes | Part of 37,473,236 ranking rows | Item rank, price, shop, item, date, and genre source data |
| `/Users/jasminehou/Downloads/TENKI/data files/genre-ranking2` | 100 parquet; 55,151,835 bytes | Part of 37,473,236 ranking rows | Second non-overlapping ranking genre batch |
| `/Users/jasminehou/Downloads/TENKI/data files/genre-ranking3` | 99 parquet; 53,406,850 bytes | Part of 37,473,236 ranking rows | Third non-overlapping ranking genre batch |
| `/Users/jasminehou/Downloads/TENKI/data files/genre-sales` | 100 parquet; 235,953,858 bytes | Part of 94,512,211 sales rows | Item/shop/date sales, quantity, traffic, conversion, review, and device metrics |
| `/Users/jasminehou/Downloads/TENKI/data files/genre-sales2` | 100 parquet plus 4 CSV; 237,764,638 bytes | Part of 94,512,211 sales rows | Second non-overlapping sales genre batch plus summaries |
| `/Users/jasminehou/Downloads/TENKI/data files/genre-sales3` | 100 parquet; 262,522,442 bytes | Part of 94,512,211 sales rows | Third non-overlapping sales genre batch |

Aggregate parquet coverage:

- Ranking: 37,473,236 rows, 297 unique genre IDs, 2020-01-01 through 2026-05-27.
- Sales: 94,512,211 rows, 300 unique item-genre IDs, 2018-10-01 through 2026-05-31.
- The numbered directories are partitions, not duplicate copies: no genre filename appears in more than one ranking batch or more than one sales batch.
- Every ranking genre has a matching sales parquet. Sales genres `101384`, `101954`, and `553282` have no ranking parquet counterpart.

Generated sidecars mixed into the raw sales directory:

| Absolute path | Lines including header | Classification |
|---|---:|---|
| `/Users/jasminehou/Downloads/TENKI/data files/genre-sales2/2025-monthly_sales.csv` | 13 | Generated monthly summary |
| `/Users/jasminehou/Downloads/TENKI/data files/genre-sales2/customer_mix_monthly.csv` | 81 | Generated new/repeat-user summary |
| `/Users/jasminehou/Downloads/TENKI/data files/genre-sales2/daily_sales.csv` | 2,801 | Generated platform daily summary |
| `/Users/jasminehou/Downloads/TENKI/data files/genre-sales2/monthly_sales.csv` | 81 | Generated monthly summary |

Risk: the raw root has no manifest, checksum file, acquisition script, or repository tracking. Losing it prevents a clean rebuild from source. A manifest with genre IDs, file hashes, acquisition date, and provenance is missing.

## 2. Daily Genre/Event Model Repository

### Repository

`/Users/jasminehou/Documents/Codex/2026-06-01/after-building-a-dashbaord-that-explores`

- Git remote: `https://github.com/jasminehou07/tenki-past-sales-model.git`
- Branch/status: `main` tracking `origin/main`; clean at audit time.
- Git inventory: 29 tracked, 0 untracked, 12,238 ignored files.
- Disk use: 600 MB total; `.git` 39 MB; tracked/generated `outputs` about 20 MB; ignored `work/.venv` 452 MB; ignored `work/model_cache` 89 MB on disk.

### Important Code and Artifacts

| Absolute path | Bytes | Classification | Purpose / importance |
|---|---:|---|---|
| `/Users/jasminehou/Documents/Codex/2026-06-01/after-building-a-dashbaord-that-explores/outputs/sales_event_model.py` | 41,749 | Source, tracked | Primary training/evaluation pipeline; high reproducibility importance |
| `/Users/jasminehou/Documents/Codex/2026-06-01/after-building-a-dashbaord-that-explores/outputs/sales_event_model.joblib` | 10,226,362 | Generated model artifact, tracked | Trained model and feature list; SHA-256 `96c4e1dadb057ed16f7d4c927b56fddf76635d5ea35917baac8357eb2c47e641` |
| `/Users/jasminehou/Documents/Codex/2026-06-01/after-building-a-dashbaord-that-explores/requirements.txt` | 83 | Source, tracked | Declares pandas, pyarrow, scikit-learn, matplotlib, and joblib |
| `/Users/jasminehou/Documents/Codex/2026-06-01/after-building-a-dashbaord-that-explores/work/build_boss_report_docx.py` | 13,455 | Source, ignored with `work/` | Rebuilds the boss-facing report; should be preserved if the report remains important |
| `/Users/jasminehou/Documents/Codex/2026-06-01/after-building-a-dashbaord-that-explores/outputs/TENKI_sales_model_boss_report_google_docs.docx` | 39,930 | Generated document, tracked | Boss-facing model report |
| `/Users/jasminehou/Documents/Codex/2026-06-01/after-building-a-dashbaord-that-explores/outputs/TENKI_sales_model_boss_report_draft.md` | 5,415 | Generated/editable document, tracked | Report source/draft |

The tracked evidence/output set also includes:

- `/Users/jasminehou/Documents/Codex/2026-06-01/after-building-a-dashbaord-that-explores/outputs/item_holdout_actuals.csv` (7,863,485 bytes).
- `/Users/jasminehou/Documents/Codex/2026-06-01/after-building-a-dashbaord-that-explores/outputs/item_options.csv` (720,951 bytes).
- `/Users/jasminehou/Documents/Codex/2026-06-01/after-building-a-dashbaord-that-explores/outputs/sales_event_predictions.csv` (1,090,418 bytes).
- `/Users/jasminehou/Documents/Codex/2026-06-01/after-building-a-dashbaord-that-explores/outputs/quantity_event_predictions.csv` (1,031,209 bytes).
- Metrics, feature importance, model-struggle, promotion-impact, and promotion-regression CSV/JSON/PNG files under `/Users/jasminehou/Documents/Codex/2026-06-01/after-building-a-dashbaord-that-explores/outputs`.

The latest documented model uses 100 genres, a final 180-day holdout beginning 2025-12-03, and data through 2026-05-31. It is a historical daily `genre_id x date` model with calendar, event, holiday, ranking, price, and lag features. It is separate from the later shop/rank projection pipeline in the June 2 project.

### Generated Model Caches

All six caches are ignored by Git, contain 242,730 rows covering 100 genres from 2018-10-01 through 2026-05-31, and have different hashes/content.

| Absolute path | Logical bytes | Status |
|---|---:|---|
| `/Users/jasminehou/Documents/Codex/2026-06-01/after-building-a-dashbaord-that-explores/work/model_cache/daily_genre_dataset.parquet` | 14,647,884 | Stale v1 cache |
| `/Users/jasminehou/Documents/Codex/2026-06-01/after-building-a-dashbaord-that-explores/work/model_cache/daily_genre_dataset_v2.parquet` | 14,747,298 | Stale v2 cache |
| `/Users/jasminehou/Documents/Codex/2026-06-01/after-building-a-dashbaord-that-explores/work/model_cache/daily_genre_dataset_v3.parquet` | 15,033,941 | Stale v3 cache |
| `/Users/jasminehou/Documents/Codex/2026-06-01/after-building-a-dashbaord-that-explores/work/model_cache/daily_genre_dataset_v4.parquet` | 15,115,220 | Stale v4 cache |
| `/Users/jasminehou/Documents/Codex/2026-06-01/after-building-a-dashbaord-that-explores/work/model_cache/daily_genre_dataset_v5.parquet` | 16,179,719 | Stale v5 cache |
| `/Users/jasminehou/Documents/Codex/2026-06-01/after-building-a-dashbaord-that-explores/work/model_cache/daily_genre_dataset_v6.parquet` | 16,830,622 | Active cache named by current code |

The five older caches are safe cleanup candidates only after retaining v6 and confirming no historical comparison need. The six caches total 92,554,684 logical bytes.

### Reproducibility Gaps

- The default source root in `sales_event_model.py` is `/Users/jasminehou/Downloads/TENKI`, and it expects `events/`, `genre-sales/`, and `genre-ranking/` directly below it. Those paths do not exist.
- Passing `/Users/jasminehou/Downloads/TENKI/data files` would repair the directory level, but the code still reads only the first unnumbered sales/ranking batches. It omits `genre-sales2`, `genre-sales3`, `genre-ranking2`, and `genre-ranking3`; the 100-genre cache confirms this limited scope.
- Cached reruns can work without rebuilding raw aggregation, but a clean `--rebuild-cache` run requires a corrected path/layout.
- `work/build_boss_report_docx.py` and all caches are ignored because the entire `work/` tree is ignored.

## 3. Exploration Dashboard Repository

### Repository

`/Users/jasminehou/Documents/Codex/2026-06-01/how-to-install-ductdb-on-this`

- Git remote: `https://github.com/jasminehou07/tenki-dashboard.git`
- Branch/status: `main` tracking `origin/main`; 19 tracked, 14 untracked, and 136 ignored files.
- Untracked work: `/Users/jasminehou/Documents/Codex/2026-06-01/how-to-install-ductdb-on-this/scripts/build_tenki_report.py`, `/Users/jasminehou/Documents/Codex/2026-06-01/how-to-install-ductdb-on-this/reports/tenki_marketplace_trend_report.docx`, and 12 PNG dashboard captures under `/Users/jasminehou/Documents/Codex/2026-06-01/how-to-install-ductdb-on-this/reports/assets`.

### Database and Dashboard Outputs

| Absolute path | Size/count | Classification | Purpose / issue |
|---|---:|---|---|
| `/Users/jasminehou/Documents/Codex/2026-06-01/how-to-install-ductdb-on-this/tenki.duckdb` | 1,060,864 bytes | Generated local database, ignored | Contains three small materialized summary tables and four views |
| `/Users/jasminehou/Documents/Codex/2026-06-01/how-to-install-ductdb-on-this/tenki_dashboard/data` | 16 tracked CSVs; 16,905 total lines including headers; 988 KB on disk | Generated dashboard summaries, tracked | Event, monthly/category, platform, pre-event, and ranking analyses |
| `/Users/jasminehou/Documents/Codex/2026-06-01/how-to-install-ductdb-on-this/tenki_dashboard/index.html` | 57,378 bytes | Source/presentation, tracked | Standalone exploration dashboard |
| `/Users/jasminehou/Documents/Codex/2026-06-01/how-to-install-ductdb-on-this/reports/tenki_marketplace_trend_report.docx` | 524,086 bytes | Generated report, untracked | Marketplace trend handoff/report |

DuckDB materialized tables contain `dataset_summary` (2 rows), `top_genres_by_rank` (98 rows), and `top_item_genres_by_sales` (100 rows). Its `events`, `genre_ranking`, `genre_sales`, and `daily_sales` views reference these missing paths:

- `/Users/jasminehou/Downloads/TENKI/events/events.parquet`
- `/Users/jasminehou/Downloads/TENKI/genre-ranking/*.parquet`
- `/Users/jasminehou/Downloads/TENKI/genre-sales/*.parquet`

Therefore the materialized summaries remain readable, but view-backed queries are not reproducible without recreating the old layout or rewriting the views. The database also represents only the first 98 ranking/100 sales genre files, not all later batches.

### Rakuten HTML Source Caches

| Absolute path | Count / disk size | Classification |
|---|---:|---|
| `/Users/jasminehou/Documents/Codex/2026-06-01/how-to-install-ductdb-on-this/ranking_category_pages` | 97 HTML files; 86 MB | Cached external Rakuten pages; ignored |
| `/Users/jasminehou/Documents/Codex/2026-06-01/how-to-install-ductdb-on-this/tmp_rakuten_categories` | 35 HTML files; 32 MB | Temporary cached external Rakuten pages; ignored |
| `/Users/jasminehou/Documents/Codex/2026-06-01/how-to-install-ductdb-on-this/rakuten_category.html` | 158,882 bytes | Cached category page; ignored |
| `/Users/jasminehou/Documents/Codex/2026-06-01/how-to-install-ductdb-on-this/category_101384.html` | 706,325 bytes | Cached category page; ignored |
| `/Users/jasminehou/Documents/Codex/2026-06-01/how-to-install-ductdb-on-this/ranking_genre_ids.txt` | 686 bytes | Derived genre-ID list; ignored |

The two page-cache directories share 34 basenames, but none of those 34 file pairs is byte-identical. They are likely fetches from different moments or page variants and should be treated as stale source snapshots, not redundant exact copies.

### Historical Deletion

Git history shows no deleted or renamed model code. One generated analysis was deleted in commit `ae30239` (`Simplify monthly category selector`):

- Historical path: `/Users/jasminehou/Documents/Codex/2026-06-01/how-to-install-ductdb-on-this/tenki_dashboard/data/seasonality_by_group.csv`
- Historical size: 14,041 bytes; 157 lines including header.
- Classification: deleted generated dashboard summary, not missing model source.

## 4. Current Sales Search and Model-Generation Work

### Workspace Root

`/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create`

This directory is not itself a Git repository. It contains:

- `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/outputs`: Git repository and dashboard handoff.
- `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/work`: untracked-by-any-parent local scripts and generated data, 6.2 GB.
- `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/.codex_pydeps`: generated Python dependency bundle, 197 MB.

### Dashboard Repository

`/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/outputs`

- Git remote: `https://github.com/jasminehou07/tenki-sales-search.git`
- Branch: `main` tracking `origin/main`.
- Snapshot status: 22 tracked files; tracked modifications in `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/outputs/app.js` and `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/outputs/index.html`.
- A concurrently created, untracked model handoff appeared during this audit at `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/outputs/model-generation`. At 17:41 JST it contained 53 files (440,031 logical bytes; about 544 KB on disk) and 5 ignored copied data files.
- Final repository status at 17:44 JST was 22 tracked files, 2 tracked modifications, 51 standard untracked files, and 5 ignored files. The untracked count includes this report and two audit documents created concurrently by other work: `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/outputs/docs/audit/TENKI_CODE_MODEL_AUDIT.md` (38,291 bytes) and `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/outputs/docs/audit/TENKI_SERVER_DATABASE_AUDIT.md` (22,608 bytes). This audit did not modify either file.
- The repository has no local `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/outputs/data` directory. Current runtime data is documented as server/Postgres-backed.

Tracked source includes the frontend, Node API, schema/validation SQL, API handoff helpers, and chunk builders. Key roots are:

- `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/outputs/api`
- `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/outputs/backend`
- `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/outputs/scripts`

Documented server-only dependencies include `/root/src/model generation`, `/root/src/tenki-sales-search`, `/opt/tenki-dashboard`, `/opt/tenki-dashboard/parquet`, `/root/events`, all `/root/genre-ranking*` and `/root/genre-sales*` batches, and the `tenki_dashboard` Postgres database. None was present locally under those absolute server paths.

### Newly Consolidated `model-generation` Tree

`/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/outputs/model-generation`

Classification: **untracked source/evidence consolidation in progress**.

- `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/outputs/model-generation/daily-genre-forecast` contains 13 exact copies from the earlier daily model repository: model code, requirements, six evidence files, and five small calendar/promotion inputs. It omits the 10.2 MB joblib model, prediction CSVs, item outputs, image, report, and all six parquet caches.
- `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/outputs/model-generation/dashboard-pipeline` contains 39 exact copies of scripts from `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/work`, organized into `core`, `data-prep`, and `archive-patches`.
- `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/outputs/model-generation/dashboard-pipeline/core/pipeline_paths.py` is a new 956-byte portability helper with environment-variable support. No copied script imports it yet, so the copied scripts still retain their original hard-coded absolute paths.
- The repository `.gitignore` contains `data/`, which also ignores the five files below nested `model-generation/daily-genre-forecast/data`. They will not appear in ordinary untracked status or be committed without an explicit ignore exception.

This tree is valuable as a handoff direction but is not yet a self-contained rebuild package: it lacks raw data links/manifests, generated dashboard data, a dashboard-pipeline requirements file, an execution order/orchestrator, and working integration of `pipeline_paths.py`.

### Local Work Scripts

`/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/work`

Top-level inventory: 32 Python files, 6 SQL files, 1 shell script, and 7 CSVs. The scripts fall into these reproducibility groups:

- Raw-to-monthly preparation: `build_monthly_actuals_from_parquet.py`, `build_tenki_data.sql`, `build_tenki_item_data.sql`, split/monthly/all-time builders, and genre/filter preparation.
- Ranking reconstruction/modeling: `build_rank_gap_estimates.py`, `build_rank_gbt_estimates.py`, `build_rank_curves.py`, `fill_rank_shops_from_ranking.py`, prediction extension, sanitization, and audits.
- Shop projection: `shop_projection_model.py`, `train_shop_level_estimates.py`, `experiment_shop_store_gbt.py`, `build_shop_projection_files.py`, and summary builders.
- Server migration/patching: Postgres import, schema repairs, dropdown updates, genre translations, and ten archived API patch scripts.

Important caveat: `build_monthly_actuals_from_parquet.py`, `build_rank_gap_estimates.py`, and `fill_rank_shops_from_ranking.py` explicitly enumerate all three raw batches and are the best local starting points. In contrast, `build_tenki_data.sql` and `build_tenki_item_data.sql` read only `genre-sales/*.parquet`, so those SQL outputs are limited to the first 100 genres unless updated.

### Large Generated Outputs

| Absolute path | Size / rows | Classification | Reproducibility importance |
|---|---:|---|---|
| `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/work/ranked-shops` | 92 monthly CSVs; 4,686,119,534 bytes; 67,200,000 data rows; 2018-10 through 2026-05 | Generated rank/sales estimates | High operational value; reproducible from raw data plus model scripts, but expensive |
| `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/work/rank-shop-map` | 77 monthly CSVs; 1,771,964,837 bytes; 37,404,619 data rows; 2020-01 through 2026-05 | Generated raw-rank/shop mapping | Intermediate cache; reproducible from raw ranking/sales parquet |
| `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/work/item_sales_daily.csv` | 110,820,434 bytes; 2,782,650 data rows | Generated item daily sales | Intermediate for item/date outputs; current SQL source covers only first sales batch |
| `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/work/rank_training_known_sales.csv` | 10,808,394 bytes; 377,805 data rows | Generated training cache | Important to exactly reproduce current rank-model training |
| `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/work/ranking_price_sample_2026_05.csv` | 24,933,029 bytes; 583,786 data rows | Generated audit sample | Month-specific diagnostic; lower long-term importance |
| `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/work/ranking_order_audit_anomalies.csv` | 55,626 bytes; 525 data rows | Generated QA | Ranking anomaly evidence |
| `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/work/ranking_order_audit_summary.csv` | 55,804 bytes; 297 data rows | Generated QA | One summary row per ranking genre |
| `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/work/rank_output_sanity_report.csv` | 2,828 bytes; 92 data rows | Generated QA | One row per generated month |

The 92 monthly `ranked-shops` files form a complete month sequence from 2018-10 through 2026-05. The 77 `rank-shop-map` files form a complete sequence from 2020-01 through 2026-05.

No Git history in the current dashboard repository contains deleted or renamed model files.

## 5. Duplicate and Stale Copies

### Exact duplicates

- The following three files are byte-identical between the exploration repo and daily model repo: `event_impact_by_group.csv`, `event_impact_summary.csv`, and `ranking_group_lookup.csv` under `/Users/jasminehou/Documents/Codex/2026-06-01/how-to-install-ductdb-on-this/tenki_dashboard/data` and `/Users/jasminehou/Documents/Codex/2026-06-01/after-building-a-dashbaord-that-explores/data/promotion_effects`.
- All 39 copied dashboard-pipeline files in `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/outputs/model-generation/dashboard-pipeline` that have counterparts in `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/work` were byte-identical at inspection time.
- All 13 daily-genre forecast files in `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/outputs/model-generation/daily-genre-forecast` were byte-identical to their source/evidence counterparts in the earlier model repository.
- In `/private/tmp/tenki-src-handoff.oX23AZ`, the schema/validation SQL, two chunk builders, and preview PNG are byte-identical to current repository files.

### Stale or divergent copies

- `/private/tmp/tenki-src-handoff.oX23AZ/site/index.html`, `site/app.js`, `site/styles.css`, and `api/server.js` differ from the current files in `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/outputs`; the temp tree is stale for those components.
- `/private/tmp/tenki-sales-search-src.tgz` and `/private/tmp/tenki-dashboard-code-handoff.tgz` are temporary code-only handoffs created on 2026-07-21. They contain templates but no raw data or model artifact. Temporary storage should not be treated as a durable backup.
- The daily model's five pre-v6 parquet caches are stale generations with the same row/date/genre dimensions but different content.
- The two Rakuten HTML cache directories have overlapping genres but no exact overlapping file content.

### Not duplicates

- `genre-ranking`, `genre-ranking2`, and `genre-ranking3` are disjoint genre partitions.
- `genre-sales`, `genre-sales2`, and `genre-sales3` are disjoint genre partitions.
- The daily genre/event model and the June 2 rank/shop projection code solve different modeling problems and should not be collapsed as duplicate models.

## 6. Missing Dependencies and Rebuild Risks

1. **Old local raw-data layout is missing.** Both the daily model default and DuckDB views refer to `/Users/jasminehou/Downloads/TENKI/events`, `/Users/jasminehou/Downloads/TENKI/genre-ranking`, and `/Users/jasminehou/Downloads/TENKI/genre-sales`; only `/Users/jasminehou/Downloads/TENKI/data files/...` exists.
2. **First-batch-only code remains.** The earlier model and two June 2 SQL scripts omit numbered batch directories, limiting clean rebuilds to roughly one third of current genres.
3. **Current generated dashboard data is absent locally.** `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/outputs/data` is missing. The handoff says the authoritative generated CSV/parquet data and Postgres tables are on the TENKI server.
4. **Server state is not locally captured.** Production behavior depends on server paths, symlinks, Postgres data, nginx, and Node process configuration. Local files alone cannot reproduce the deployed application state.
5. **The untracked handoff is incomplete and not portable yet.** `pipeline_paths.py` is unused; copied scripts retain hard-coded paths; no root README/execution DAG or dashboard-pipeline dependency lock was present at the snapshot time.
6. **Ignored files are easy to omit from backups.** The active daily cache, report builder, copied model inputs under nested `data/`, DuckDB database, HTML caches, and raw parquet are ignored or outside Git.
7. **No raw-data manifest exists.** There are no local checksums, source URLs/API query records, licenses/usage constraints, or acquisition logs for the 598 parquet files.
8. **Model artifact provenance is incomplete.** Metrics and source exist, but there is no immutable run manifest tying `sales_event_model.joblib` to exact raw-file hashes, cache hash, package versions, command line, and Git commit.

## 7. Secret Redaction and Sensitive Material

**SECRET REDACTION SECTION**

- No secret values were copied into this audit.
- Known credential stores and histories, including `/Users/jasminehou/.ssh`, `/Users/jasminehou/.git-credentials`, shell histories, browser/application stores, and real `.env` files outside the relevant roots, were deliberately not read.
- Git remotes were inspected with any possible URL userinfo redacted before display. The three relevant remotes resolved to ordinary public GitHub HTTPS URLs with no displayed embedded credential.
- No real `.env`, private-key, credential, token, or secret-named file was found in the relevant roots or listed handoff archives.
- `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/outputs/backend/env.template` and `/private/tmp/tenki-src-handoff.oX23AZ/config/env.template` contain configuration placeholders, including `DATABASE_URL` and `API_KEY`; values are intentionally omitted here.
- Credential-related marker words also occur in handoff/schema scripts as environment-variable names or redaction logic. Their values were not printed or recorded.
- Raw TENKI sales and behavior data is commercially sensitive even when it contains no obvious credential. Only schemas, aggregates, counts, dates, hashes, and paths were inspected; raw records were not copied into this report.

## 8. Recommended Preservation Order

1. Preserve `/Users/jasminehou/Downloads/TENKI/data files` with a checksum manifest and provenance record.
2. Preserve and commit an intentional version of `/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/outputs/model-generation` after fixing ignore rules, wiring portable paths, and documenting execution order.
3. Preserve `/Users/jasminehou/Documents/Codex/2026-06-01/after-building-a-dashbaord-that-explores/outputs/sales_event_model.joblib`, active v6 cache, model source, requirements, metrics, and a run manifest together.
4. Preserve the June 2 `work` scripts and `rank_training_known_sales.csv`; decide whether the 6.46 GB of generated monthly rank/map CSVs should be backed up or regenerated.
5. Export or document the server Postgres schema/data, production environment-variable names, symlink layout, and rebuild commands without secret values.
6. Treat `/private/tmp` archives and extracted trees as disposable after a durable, verified handoff exists.
