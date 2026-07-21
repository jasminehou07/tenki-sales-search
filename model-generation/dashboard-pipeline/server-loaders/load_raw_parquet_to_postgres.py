from __future__ import annotations

import argparse
import io
import os
from pathlib import Path

import pandas as pd
import psycopg

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres@/tenki_dashboard?host=/var/run/postgresql",
)
ROOT = Path("/root")
RANKING_DIR = ROOT / "genre-ranking"
SALES_DIR = ROOT / "genre-sales"
EVENTS_FILE = ROOT / "events" / "events.parquet"


def copy_dataframe(cur, table: str, columns: list[str], df: pd.DataFrame) -> None:
    if df.empty:
        return
    buf = io.StringIO()
    df.to_csv(buf, index=False, header=False, na_rep="")
    buf.seek(0)
    with cur.copy(
        f"COPY {table} ({', '.join(columns)}) FROM STDIN WITH (FORMAT CSV, NULL '')"
    ) as copy:
        copy.write(buf.getvalue())


def load_events(conn) -> int:
    if not EVENTS_FILE.exists():
        return 0
    df = pd.read_parquet(EVENTS_FILE)
    out = pd.DataFrame(
        {
            "event_name": df["name"].astype(str),
            "start_at": pd.to_datetime(df["start"]),
            "end_at": pd.to_datetime(df["end"]),
            "intensity": 1.0,
        }
    )
    bad = out[out["end_at"] < out["start_at"]]
    if not bad.empty:
        print(f"skipping invalid event ranges: {len(bad):,}", flush=True)
    out = out[out["end_at"] >= out["start_at"]].copy()
    with conn.cursor() as cur:
        cur.execute("DELETE FROM promotion_events")
        copy_dataframe(cur, "promotion_events", list(out.columns), out)
    conn.commit()
    return len(out)


def load_rankings(conn, limit: int | None = None) -> int:
    files = sorted(RANKING_DIR.glob("*.parquet"))
    if limit:
        files = files[:limit]
    total = 0
    columns = ["date", "shop_id", "item_id", "rank", "price_yen", "genre_id", "source_file"]
    with conn.cursor() as cur:
        cur.execute("DROP TABLE IF EXISTS tmp_raw_genre_rankings")
        cur.execute("CREATE TEMP TABLE tmp_raw_genre_rankings (LIKE raw_genre_rankings INCLUDING DEFAULTS) ON COMMIT PRESERVE ROWS")
    conn.commit()
    for i, path in enumerate(files, start=1):
        df = pd.read_parquet(path, columns=["date", "shop", "item", "rank", "price", "genre_id"])
        out = pd.DataFrame(
            {
                "date": pd.to_datetime(df["date"]).dt.date,
                "shop_id": df["shop"].astype("int64"),
                "item_id": df["item"].astype("int64"),
                "rank": df["rank"].astype("int64"),
                "price_yen": df["price"].astype("int64"),
                "genre_id": df["genre_id"].astype("int64"),
                "source_file": path.name,
            }
        )
        with conn.cursor() as cur:
            cur.execute("TRUNCATE tmp_raw_genre_rankings")
            copy_dataframe(cur, "tmp_raw_genre_rankings", columns, out)
            cur.execute(
                """
                INSERT INTO raw_genre_rankings (date, shop_id, item_id, rank, price_yen, genre_id, source_file)
                SELECT date, shop_id, item_id, rank, price_yen, genre_id, source_file
                FROM tmp_raw_genre_rankings
                ON CONFLICT DO NOTHING
                """
            )
        conn.commit()
        total += len(out)
        if i % 50 == 0 or i == len(files):
            print(f"rankings {i}/{len(files)} files, {total:,} rows read", flush=True)
    return total


def load_sales(conn, limit: int | None = None) -> int:
    files = sorted(SALES_DIR.glob("*.parquet"))
    if limit:
        files = files[:limit]
    total = 0
    parquet_cols = [
        "shop", "item", "date", "shop_genre", "item_genre", "sales", "sales_items",
        "pv", "uv", "cvr", "acc", "sales_number",
    ]
    columns = [
        "shop_id", "item_id", "date", "shop_genre", "item_genre", "sales_yen",
        "units_sold", "page_views", "unique_visitors", "conversion_rate", "access_count",
        "order_count", "source_file",
    ]
    with conn.cursor() as cur:
        cur.execute("DROP TABLE IF EXISTS tmp_raw_genre_sales")
        cur.execute("CREATE TEMP TABLE tmp_raw_genre_sales (LIKE raw_genre_sales INCLUDING DEFAULTS) ON COMMIT PRESERVE ROWS")
    conn.commit()
    for i, path in enumerate(files, start=1):
        df = pd.read_parquet(path, columns=parquet_cols)
        out = pd.DataFrame(
            {
                "shop_id": df["shop"].astype("int64"),
                "item_id": df["item"].astype("int64"),
                "date": pd.to_datetime(df["date"]).dt.date,
                "shop_genre": df["shop_genre"].astype("int64"),
                "item_genre": df["item_genre"].astype("int64"),
                "sales_yen": df["sales"].fillna(0).astype("int64"),
                "units_sold": df["sales_items"].fillna(0).astype("int64"),
                "page_views": df["pv"].fillna(0).astype("int64"),
                "unique_visitors": df["uv"].fillna(0).astype("int64"),
                "conversion_rate": df["cvr"],
                "access_count": df["acc"].fillna(0).astype("int64"),
                "order_count": df["sales_number"].fillna(0).astype("int64"),
                "source_file": path.name,
            }
        )
        with conn.cursor() as cur:
            cur.execute("TRUNCATE tmp_raw_genre_sales")
            copy_dataframe(cur, "tmp_raw_genre_sales", columns, out)
            cur.execute(
                """
                INSERT INTO raw_genre_sales (
                    shop_id, item_id, date, shop_genre, item_genre, sales_yen, units_sold,
                    page_views, unique_visitors, conversion_rate, access_count, order_count, source_file
                )
                SELECT shop_id, item_id, date, shop_genre, item_genre, sales_yen, units_sold,
                       page_views, unique_visitors, conversion_rate, access_count, order_count, source_file
                FROM tmp_raw_genre_sales
                ON CONFLICT DO NOTHING
                """
            )
        conn.commit()
        total += len(out)
        if i % 50 == 0 or i == len(files):
            print(f"sales {i}/{len(files)} files, {total:,} rows read", flush=True)
    return total


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="load only N files from each folder for testing")
    parser.add_argument("--skip-rankings", action="store_true")
    parser.add_argument("--skip-sales", action="store_true")
    args = parser.parse_args()

    with psycopg.connect(DATABASE_URL, autocommit=False) as conn:
        events = load_events(conn)
        print(f"events loaded: {events:,}", flush=True)
        if not args.skip_rankings:
            rankings = load_rankings(conn, args.limit)
            print(f"ranking rows read: {rankings:,}", flush=True)
        if not args.skip_sales:
            sales = load_sales(conn, args.limit)
            print(f"sales rows read: {sales:,}", flush=True)


if __name__ == "__main__":
    main()
