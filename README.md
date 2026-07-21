# Tenki Japan Sales Search

Dashboard for searching Tenki Japan/Rakuten sales estimates by product genre, shop, and date. The live version is hosted on the TENKI SSH server and reads data through the server API.

## Website

Open the live website at https://172.237.20.132.sslip.io/.

## Run Locally

```bash
python3 -m http.server 8766
```

Then open the local server URL shown in your terminal.

## Data

The dashboard uses the SSH server API and Postgres database for current dashboard data. Do not publish private TENKI sales data or server credentials in this repository.
