# TENKI integrity manifests

- `local_raw_data_sha256.txt` records the audited local numbered raw-data files.
- `server_raw_data_sha256.txt` records the audited consolidated server files.
- `server_schema_20260721.sql` records the PostgreSQL schema observed on
  2026-07-21.

Checksums provide identity and drift detection without storing private raw rows.
Compare them before a rebuild and record differences in the run manifest. Paths
may differ between local and server layouts; compare genre filename and digest,
not only the absolute path.

The schema snapshot may include ownership, extensions, or object order tied to
the audited server. Treat it as evidence and a reconstruction reference, not an
automatically safe migration script.
