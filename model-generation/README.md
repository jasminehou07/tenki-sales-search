# TENKI model-generation handoff

This directory preserves the recovered source needed to understand and rebuild
the models and prepared datasets associated with the TENKI Rakuten dashboard.
It contains source code, configuration templates, evidence from prior runs, and
operational documentation. It intentionally excludes credentials, private raw
rows, generated multi-gigabyte outputs, and database files.

The package has two separate modeling tracks:

1. [`dashboard-pipeline/`](dashboard-pipeline/README.md) is the production-oriented
   rank/item and shop projection pipeline used to prepare dashboard data.
2. [`daily-genre-forecast/`](daily-genre-forecast/README.md) is a preserved
   historical experiment for genre-by-day forecasting. It is not the model
   currently served by the production dashboard.

Do not combine validation metrics from these tracks. They use different targets,
features, holdouts, and output schemas.

## Start here

1. Read [`SOURCE_INVENTORY.md`](SOURCE_INVENTORY.md) to identify current,
   operational, legacy, and experimental source.
2. Read [`PIPELINE_FLOW.md`](PIPELINE_FLOW.md) for the exact recovered flow from
   parquet files through PostgreSQL and the API.
3. Complete [`REPRODUCIBILITY_CHECKLIST.md`](REPRODUCIBILITY_CHECKLIST.md) before
   treating a run as reproducible.
4. Copy [`RUN_MANIFEST_TEMPLATE.yaml`](RUN_MANIFEST_TEMPLATE.yaml) into a new,
   non-secret run directory and fill it in while running the pipeline.
5. Compare raw inputs against the existing checksum inventories in
   [`../docs/manifests/`](../docs/manifests/).

## Source-data layouts

The production server has consolidated inputs:

```text
/root/
  events/events.parquet
  genre-ranking/    # 1,100 parquet files at the audit snapshot
  genre-sales/      # 1,100 parquet files at the audit snapshot
```

The local workstation uses numbered partitions:

```text
RAW_ROOT/
  events/events.parquet
  genre-ranking/
  genre-ranking2/
  genre-ranking3/
  genre-sales/
  genre-sales2/
  genre-sales3/
```

Portable scripts discover either layout. When the same parquet filename occurs
in more than one matching directory, the unsuffixed directory is preferred,
then lower-numbered partitions. This prevents a consolidated server copy and an
older local partition from being counted twice.

Raw data is company data and is not included here. The checksum manifests record
file identity without exposing private rows:

- `../docs/manifests/local_raw_data_sha256.txt`
- `../docs/manifests/server_raw_data_sha256.txt`

## Environment variables

The production-oriented Python scripts use these credential-free paths:

| Variable | Purpose |
| --- | --- |
| `TENKI_DASHBOARD_ROOT` | Dashboard repository or prepared site-data root |
| `TENKI_WORK_DIR` | Large mutable intermediate files and model caches |
| `TENKI_RAW_DATA_DIR` | Root containing events and ranking/sales folders |
| `TENKI_DUCKDB_BIN` | DuckDB CLI executable used by identity restoration |
| `TENKI_SERVER_DATA_DIR` | Optional server prepared-data root for dropdown refresh |

Database credentials belong only in the protected server environment. Never add
the real `.env`, `DATABASE_URL`, SSH password, Rakuten API keys, or raw data to
this package or a run manifest.

## What is and is not guaranteed

The recovered Python and shell source is syntax-checked, and the folder discovery
logic has unit tests. A full clean-machine rebuild has not yet been executed from
this package. The production model loaders remain operational snapshots with
server-specific paths because changing them without a database rehearsal would
create a different deployment artifact.

Before replacing production data, run validation-only steps, compare metrics and
coverage, back up the database and prepared outputs, use a new model version, and
verify API responses. The audit reports in `../docs/audit/` explain the remaining
provenance and validation gaps.
