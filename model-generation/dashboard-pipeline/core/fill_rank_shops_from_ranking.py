from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

import pandas as pd

from pipeline_paths import RAW_DATA_ROOT, WORK_ROOT, duckdb_binary

SOURCE = RAW_DATA_ROOT
RANK_DIR = WORK_ROOT / "ranked-shops"
TMP_DIR = WORK_ROOT / "rank-shop-map"
RANKING_FOLDERS = ["genre-ranking", "genre-ranking2", "genre-ranking3"]
SALES_FOLDERS = ["genre-sales", "genre-sales2", "genre-sales3"]
MAX_RANK = 80
DUCKDB = duckdb_binary()


def read_parquet_with_duckdb(path: Path, columns: list[str]) -> pd.DataFrame:
    quoted_columns = ", ".join(f'"{column}"' for column in columns)
    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        sql = (
            f"COPY (SELECT {quoted_columns} FROM read_parquet('{str(path).replace("'", "''")}')) "
            f"TO '{str(tmp_path).replace("'", "''")}' (HEADER, DELIMITER ',')"
        )
        subprocess.run([str(DUCKDB), "-c", sql], check=True, stdout=subprocess.DEVNULL)
        return pd.read_csv(tmp_path)
    finally:
        tmp_path.unlink(missing_ok=True)


def sales_path_for_genre(genre: str) -> Path | None:
    for folder in SALES_FOLDERS:
        path = SOURCE / folder / f"{genre}.parquet"
        if path.exists():
            return path
    return None


def append_month_maps(frame: pd.DataFrame) -> None:
    if frame.empty:
        return
    frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
    frame = frame.dropna(subset=["date", "genre", "rank", "shop"]).copy()
    frame["date"] = frame["date"].dt.strftime("%Y-%m-%d")
    frame["month"] = frame["date"].str.slice(0, 7)
    for month, group in frame.groupby("month", sort=False):
        target = TMP_DIR / f"{month}.csv"
        group[["date", "genre", "rank", "shop", "item", "sales", "items", "sales_known"]].to_csv(
            target,
            mode="a",
            header=not target.exists(),
            index=False,
        )


def process_rank_file(rank_path: Path) -> pd.DataFrame:
    genre = rank_path.stem
    columns = ["date", "shop", "item", "rank", "genre_id"]
    ranks = read_parquet_with_duckdb(rank_path, columns)
    ranks = ranks[ranks["rank"].between(1, MAX_RANK)].copy()
    if ranks.empty:
        return pd.DataFrame(columns=["date", "genre", "rank", "shop", "item", "sales", "items", "sales_known"])

    ranks["genre"] = ranks["genre_id"].astype(str)
    ranks["rank"] = pd.to_numeric(ranks["rank"], errors="coerce").fillna(0).astype(int)
    ranks["shop"] = ranks["shop"].astype(str)
    ranks["item"] = ranks["item"].astype(str)
    ranks["items"] = 1

    sales_path = sales_path_for_genre(genre)
    if sales_path is not None:
        sales = read_parquet_with_duckdb(sales_path, ["date", "shop", "item", "sales"])
        sales["shop"] = sales["shop"].astype(str)
        sales["item"] = sales["item"].astype(str)
        sales["sales"] = pd.to_numeric(sales["sales"], errors="coerce").fillna(0)
        ranks = ranks.merge(sales, on=["date", "shop", "item"], how="left")
        ranks["sales_known"] = ranks["sales"].notna()
        ranks["sales"] = ranks["sales"].fillna(0)
    else:
        ranks["sales"] = 0.0
        ranks["sales_known"] = False

    by_shop = (
        ranks.groupby(["date", "genre", "rank", "shop", "item"], as_index=False)
        .agg(sales=("sales", "sum"), items=("items", "sum"), sales_known=("sales_known", "any"))
        .sort_values(["date", "genre", "rank", "sales_known", "sales", "items", "shop", "item"], ascending=[True, True, True, False, False, False, True, True])
    )
    return by_shop.drop_duplicates(["date", "genre", "rank"], keep="first")


def build_shop_maps() -> None:
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    for old_file in TMP_DIR.glob("*.csv"):
        old_file.unlink()

    paths: list[Path] = []
    for folder in RANKING_FOLDERS:
        paths.extend(sorted((SOURCE / folder).glob("*.parquet")))

    for index, path in enumerate(paths, start=1):
        mapped = process_rank_file(path)
        append_month_maps(mapped)
        print(f"{index}/{len(paths)} {path.stem}: {len(mapped):,} rank-shop rows", flush=True)


def apply_shop_maps() -> None:
    for rank_path in sorted(RANK_DIR.glob("*.csv")):
        month = rank_path.stem
        map_path = TMP_DIR / f"{month}.csv"
        if not map_path.exists():
            continue

        rank_rows = pd.read_csv(
            rank_path,
            dtype={"date": "string", "genre": "string", "shop": "string", "source": "string"},
        )
        shop_map = pd.read_csv(
            map_path,
            dtype={"date": "string", "genre": "string", "shop": "string", "item": "string"},
        )
        shop_map["rank"] = pd.to_numeric(shop_map["rank"], errors="coerce").fillna(0).astype(int)
        shop_map["sales"] = pd.to_numeric(shop_map["sales"], errors="coerce").fillna(0)
        shop_map["items"] = pd.to_numeric(shop_map["items"], errors="coerce").fillna(0)
        shop_map["sales_known"] = shop_map["sales_known"].astype(str).str.lower().isin(["true", "1"])
        shop_map = (
            shop_map.sort_values(["date", "genre", "rank", "sales_known", "sales", "items", "shop", "item"], ascending=[True, True, True, False, False, False, True, True])
            .drop_duplicates(["date", "genre", "rank"], keep="first")
            [["date", "genre", "rank", "shop", "item", "sales", "sales_known"]]
            .rename(columns={"shop": "ranked_shop", "item": "ranked_item", "sales": "ranked_sales", "sales_known": "ranked_sales_known"})
        )

        rank_rows["rank"] = pd.to_numeric(rank_rows["rank"], errors="coerce").fillna(0).astype(int)
        merged = rank_rows.merge(shop_map, on=["date", "genre", "rank"], how="left")
        has_ranked_shop = merged["ranked_shop"].fillna("").ne("")
        merged.loc[has_ranked_shop, "shop"] = merged.loc[has_ranked_shop, "ranked_shop"]
        has_ranked_item = merged["ranked_item"].fillna("").ne("")
        if "item" not in merged.columns:
            merged["item"] = ""
        merged.loc[has_ranked_item, "item"] = merged.loc[has_ranked_item, "ranked_item"]
        has_known_sales = merged["ranked_sales_known"].fillna(False).astype(bool)
        merged.loc[has_known_sales, "source"] = "actual"
        merged.loc[has_known_sales, "sales"] = merged.loc[has_known_sales, "ranked_sales"].round(2)
        merged.loc[has_known_sales, "sales_low"] = merged.loc[has_known_sales, "ranked_sales"].round(2)
        merged.loc[has_known_sales, "sales_high"] = merged.loc[has_known_sales, "ranked_sales"].round(2)
        merged = merged.drop(columns=["ranked_shop", "ranked_item", "ranked_sales", "ranked_sales_known"])
        merged.to_csv(rank_path, index=False)
        print(f"updated {month}: filled {int(has_ranked_shop.sum()):,} shop labels, {int(has_known_sales.sum()):,} actual sales", flush=True)


def main() -> None:
    build_shop_maps()
    apply_shop_maps()


if __name__ == "__main__":
    main()
