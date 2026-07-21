# Reproducibility checklist

Complete this checklist for each model/data publication. Store the completed copy
with the run manifest and non-secret logs.

## Source snapshot

- [ ] Git commit and dirty-tree status recorded.
- [ ] Exact trainer, data-prep, loader, schema, service, and nginx files archived.
- [ ] Current audit reports reviewed for known gaps.
- [ ] Legacy/experimental scripts excluded from the production run unless named.

## Raw inputs

- [ ] Raw root and layout recorded: consolidated or numbered partitions.
- [ ] Ranking and sales file counts recorded; expected server snapshot is 1,100 each.
- [ ] Ranking/sales genre IDs matched and exceptions documented.
- [ ] Local/server SHA256 manifests compared or regenerated.
- [ ] Raw schemas, row counts, date ranges, and byte totals recorded.
- [ ] Duplicate filenames resolved and selected source paths recorded.
- [ ] Events file checksum, schema, and date coverage recorded.

## Environment

- [ ] OS, CPU, RAM, free disk, Python, Node, PostgreSQL, and DuckDB versions recorded.
- [ ] Python package lock/freeze saved without credentials.
- [ ] `TENKI_DASHBOARD_ROOT`, `TENKI_WORK_DIR`, `TENKI_RAW_DATA_DIR`, and
      `TENKI_DUCKDB_BIN` recorded as paths only.
- [ ] Database host/name and model version recorded without passwords.
- [ ] Secrets loaded from protected environment, not source or logs.

## Prepared features

- [ ] Monthly actuals rebuilt or their source hash verified.
- [ ] Event and genre-label provenance recorded.
- [ ] Rank training cache hash, row count, genres, and dates recorded.
- [ ] No holdout rows used to derive history or promotion reference features.
- [ ] Same-day features reviewed for leakage relative to the intended prediction use.

## Rank/item model

- [ ] Validation-only run completed before publication.
- [ ] Three random 5% holdout seeds and sample counts recorded.
- [ ] Overall and genre/event/split WMAPE, Median APE, and within-25% recorded.
- [ ] Bias by rank and target scale reviewed.
- [ ] Interval coverage and median width measured.
- [ ] Rank 1-80 coverage, monotonicity, zero values, and duplicates reviewed.
- [ ] Known sales and identity restoration sampled against source parquet.
- [ ] Sanitation report reviewed; cleaned rows retain item/shop identity.

## Shop model

- [ ] Sales and units validation provenance recorded separately.
- [ ] Shop, genre, and shop/genre-group coverage reviewed.
- [ ] Promotion and history features verified for the selected date range.
- [ ] Blending candidate scores and chosen candidate recorded.
- [ ] Derived-unit assumptions and unit-price bounds recorded.
- [ ] Page-view fields confirmed absent or clearly zero/unavailable.

## Publication and PostgreSQL

- [ ] Existing prepared outputs and database backed up.
- [ ] New unique model version selected.
- [ ] Output file hashes and coverage recorded before loading.
- [ ] Only one full/rank loader strategy used.
- [ ] Database tables, constraints, and required indexes verified.
- [ ] Loaded row counts and distinct genre/shop/date coverage match prepared data.
- [ ] Materialized views refreshed and refresh time recorded.
- [ ] Stored validation metrics reproduce from holdout rows with SQL.

## Dashboard acceptance

- [ ] Health endpoint returns successfully through sslip.io HTTPS.
- [ ] Single-day, range, and all-time API responses checked.
- [ ] Genre and shop filters checked, including all selections.
- [ ] Sales by item/rank returns rank 1-80 and correct item/shop identity.
- [ ] Totals, intervals, top shops/items, units, and validation displays checked.
- [ ] Browser cache-busting/version is updated for changed static assets.
- [ ] PostgreSQL, API service, and nginx restart procedure tested.
- [ ] Previous model version retained until sign-off.

## Sign-off

- Run ID:
- Reviewer:
- Review date:
- Approved model version:
- Known limitations accepted:
- Rollback location/version:
