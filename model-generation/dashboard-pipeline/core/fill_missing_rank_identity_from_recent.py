from __future__ import annotations

from pathlib import Path

import pandas as pd

from pipeline_paths import WORK_ROOT

RANK_DIR = WORK_ROOT / "ranked-shops"
MAP_DIR = WORK_ROOT / "rank-shop-map"


def nonempty(value: object) -> bool:
    return pd.notna(value) and str(value).strip() not in {"", "nan", "<NA>"}


def fill_month(month: str) -> tuple[int, int]:
    rank_path = RANK_DIR / f"{month}.csv"
    if not rank_path.exists():
        return 0, 0

    rank_rows = pd.read_csv(
        rank_path,
        dtype={"date": "string", "genre": "string", "rank": "Int64", "shop": "string", "item": "string"},
    )
    if "item" not in rank_rows.columns:
        rank_rows["item"] = ""
    rank_rows["rank"] = pd.to_numeric(rank_rows["rank"], errors="coerce").fillna(0).astype(int)

    previous_months = sorted(path.stem for path in MAP_DIR.glob("*.csv") if path.stem <= month)[-3:]
    map_frames = []
    for map_month in previous_months:
        map_path = MAP_DIR / f"{map_month}.csv"
        if map_path.exists():
            frame = pd.read_csv(
                map_path,
                dtype={"date": "string", "genre": "string", "rank": "Int64", "shop": "string", "item": "string"},
                usecols=["date", "genre", "rank", "shop", "item", "sales", "sales_known"],
            )
            map_frames.append(frame)
    if not map_frames:
        return 0, 0

    rank_map = pd.concat(map_frames, ignore_index=True)
    rank_map["rank"] = pd.to_numeric(rank_map["rank"], errors="coerce").fillna(0).astype(int)
    rank_map = rank_map[rank_map["shop"].map(nonempty) | rank_map["item"].map(nonempty)].copy()
    if rank_map.empty:
        return 0, 0
    rank_map["date_dt"] = pd.to_datetime(rank_map["date"])
    rank_map["sales"] = pd.to_numeric(rank_map["sales"], errors="coerce").fillna(0)
    rank_map["sales_known_bool"] = rank_map["sales_known"].astype(str).str.lower().isin(["true", "1"])
    rank_map = (
        rank_map.sort_values(["genre", "rank", "date_dt", "sales_known_bool", "sales"], ascending=[True, True, True, False, False])
        .drop_duplicates(["genre", "rank", "date_dt"], keep="first")
    )

    rank_rows["date_dt"] = pd.to_datetime(rank_rows["date"])
    filled_shop = 0
    filled_item = 0

    for (genre, rank), group_index in rank_rows.groupby(["genre", "rank"], sort=False).groups.items():
        identity_rows = rank_map[(rank_map["genre"].eq(genre)) & (rank_map["rank"].eq(rank))]
        if identity_rows.empty:
            continue
        target = rank_rows.loc[list(group_index), ["date_dt", "shop", "item"]].copy()
        target["row_index"] = target.index
        merged = pd.merge_asof(
            target.sort_values("date_dt"),
            identity_rows[["date_dt", "shop", "item"]].sort_values("date_dt"),
            on="date_dt",
            direction="backward",
            suffixes=("", "_fill"),
        )
        missing_shop = ~merged["shop"].map(nonempty) & merged["shop_fill"].map(nonempty)
        missing_item = ~merged["item"].map(nonempty) & merged["item_fill"].map(nonempty)
        if missing_shop.any():
            rank_rows.loc[merged.loc[missing_shop, "row_index"], "shop"] = merged.loc[missing_shop, "shop_fill"].to_numpy()
            filled_shop += int(missing_shop.sum())
        if missing_item.any():
            rank_rows.loc[merged.loc[missing_item, "row_index"], "item"] = merged.loc[missing_item, "item_fill"].to_numpy()
            filled_item += int(missing_item.sum())

    rank_rows = rank_rows.drop(columns=["date_dt"])
    rank_rows.to_csv(rank_path, index=False)
    return filled_shop, filled_item


def main() -> None:
    total_shop = 0
    total_item = 0
    for path in sorted(RANK_DIR.glob("*.csv")):
        shop_count, item_count = fill_month(path.stem)
        if shop_count or item_count:
            print(f"{path.name}: filled {shop_count:,} shop IDs and {item_count:,} item IDs")
        total_shop += shop_count
        total_item += item_count
    print(f"total: filled {total_shop:,} shop IDs and {total_item:,} item IDs")


if __name__ == "__main__":
    main()
