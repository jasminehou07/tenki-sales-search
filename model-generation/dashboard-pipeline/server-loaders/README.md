# Recovered PostgreSQL loaders

These files are preserved copies of server-side import programs. They are not
portable model trainers and intentionally retain the audited `/root` and
`/opt/tenki-dashboard` layout.

- `load_raw_parquet_to_postgres.py`: optional consolidated raw source import.
- `load_dashboard_chunks_streaming.py`: preferred memory-bounded full prepared
  dashboard load.
- `load_rank_chunks_batched.py`: preferred companion for very large rank data.
- `load_dashboard_chunks_to_postgres.py`: legacy memory-heavy alternative.

The production server has 1,100 parquet files in each consolidated raw ranking
and sales folder. The raw loader reads those unsuffixed directories. Local
numbered partitions must be consolidated or loaded through a separately reviewed
portable copy before this server loader is used.

Requirements and safeguards:

1. Set a protected `DATABASE_URL` and a unique `MODEL_VERSION` outside Git.
2. Verify the schema and indexes before loading; the checked-in schema file is a
   snapshot for inspection, not an automatically safe migration.
3. Back up tables and prepared files.
4. Test with the loader's limit/skip options where available.
5. Do not run alternative full/rank loaders for the same model version.
6. Record commands, output hashes, row counts, and materialized-view refreshes in
   the run manifest.

See the parent README and `../../PIPELINE_FLOW.md` for the reviewed execution
order. No loader was executed while assembling this handoff.
