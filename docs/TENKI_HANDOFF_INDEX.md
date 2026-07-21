# TENKI recovered-project handoff index

This index connects the recovered source package, deployment snapshots, audits,
and integrity manifests. It contains no raw company rows or credentials.

## Rebuild documentation

- [`../model-generation/README.md`](../model-generation/README.md): entry point
  and distinction between the production-oriented dashboard pipeline and the
  historical daily-genre experiment.
- [`../model-generation/SOURCE_INVENTORY.md`](../model-generation/SOURCE_INVENTORY.md):
  current, operational, legacy, and experimental source classification.
- [`../model-generation/PIPELINE_FLOW.md`](../model-generation/PIPELINE_FLOW.md):
  raw data through features, training, validation, publishing, PostgreSQL, API,
  and dashboard acceptance.
- [`../model-generation/REPRODUCIBILITY_CHECKLIST.md`](../model-generation/REPRODUCIBILITY_CHECKLIST.md):
  per-run quality and recovery checklist.
- [`../model-generation/RUN_MANIFEST_TEMPLATE.yaml`](../model-generation/RUN_MANIFEST_TEMPLATE.yaml):
  credential-free run-record template.

## Pipeline source

- [`../model-generation/dashboard-pipeline/README.md`](../model-generation/dashboard-pipeline/README.md):
  rank/item and shop production-oriented pipeline.
- [`../model-generation/daily-genre-forecast/README.md`](../model-generation/daily-genre-forecast/README.md):
  separate historical genre/day experiment and its preserved evidence.
- [`../deploy/README.md`](../deploy/README.md): recovered sslip.io nginx and
  systemd deployment snapshots.

## Audit evidence

- [`audit/TENKI_LOCAL_FILE_AUDIT.md`](audit/TENKI_LOCAL_FILE_AUDIT.md): local
  repositories, raw files, generated outputs, duplicates, and gaps.
- [`audit/TENKI_CODE_MODEL_AUDIT.md`](audit/TENKI_CODE_MODEL_AUDIT.md): model,
  holdout, metric, API, and lineage analysis.
- [`audit/TENKI_SERVER_DATABASE_AUDIT.md`](audit/TENKI_SERVER_DATABASE_AUDIT.md):
  production server, PostgreSQL, API, filesystem, and operations snapshot.

## Integrity and schema manifests

- [`manifests/local_raw_data_sha256.txt`](manifests/local_raw_data_sha256.txt)
- [`manifests/server_raw_data_sha256.txt`](manifests/server_raw_data_sha256.txt)
- [`manifests/server_schema_20260721.sql`](manifests/server_schema_20260721.sql)

The checksum files identify the audited raw inputs without copying private rows.
The SQL file is a schema snapshot for comparison and reconstruction planning; it
must be reviewed before use as a migration.

## Remaining proof needed

The package has been recovered and syntax-checked, but no full retrain or clean
server rebuild was performed during packaging. Before declaring complete
reproducibility, execute the checklist in staging, record a run manifest, verify
the metrics from stored holdout predictions, load a new model version, test the
API/dashboard, and rehearse rollback.
