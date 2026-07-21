# Tenki Japan Sales Search

Dashboard for searching Tenki Japan/Rakuten sales estimates by product genre, shop, and date. The live version is hosted on the TENKI SSH server and reads data through the server API.

## Website

Open the live website at https://172.237.20.132.sslip.io/.

## Server Handoff

TENKI server source folder: `/root/src/tenki-sales-search`.

That folder contains the dashboard frontend, API code, SQL/scripts, and links to the server-side data folders needed to reproduce the dashboard outputs.

Model generation folder: `/root/src/model generation`.

That folder contains the model/data generation scripts, validation SQL, and links to the raw TENKI/Rakuten data and generated parquet outputs.

## Restart The Server

If the dashboard link loads but the data/API is down, SSH into the TENKI server and restart the Node API:

```bash
ssh root@172.237.20.132
cd /opt/tenki-dashboard/api
nohup node server.js > /opt/tenki-dashboard/dashboard-api3100.log 2>&1 &
```

Then check that it is running:

```bash
curl -k https://172.237.20.132.sslip.io/health
```

Expected result:

```json
{"ok":true}
```

The public dashboard is served through nginx at `https://172.237.20.132.sslip.io/`. The Node API runs privately on localhost port `3100`; nginx proxies `/api` and `/health` to it.

## Rerun Model/Data Generation

The dashboard reads final data from Postgres. To rebuild model outputs or validation tables, use the scripts and SQL in:

```text
/root/src/model generation
```

Typical flow on the server:

```bash
ssh root@172.237.20.132
cd "/root/src/model generation"
```

Run or edit the Python scripts in `scripts/` to rebuild dashboard chunks, then load/update Postgres with the SQL in `sql/`.

Important files:

- `scripts/build_rank_chunks.py`: rebuilds ranked item/rank estimate chunks.
- `scripts/build_shop_summary_chunks.py`: rebuilds shop summary chunks.
- `sql/schema.sql`: table structure and indexes.
- `sql/create_validation_holdout_predictions.sql`: creates the hidden 5% validation prediction table.
- `sql/per_genre_validation.sql`: recalculates genre-level WMAPE/validation metrics.

The raw source data is linked from:

- `/root/src/model generation/data-links/events`
- `/root/src/model generation/data-links/genre-ranking`
- `/root/src/model generation/data-links/genre-sales`

## Run Locally

```bash
python3 -m http.server 8766
```

Then open the local server URL shown in your terminal.

## Data

The dashboard uses the SSH server API and Postgres database for current dashboard data. Do not publish private TENKI sales data or server credentials in this repository.
