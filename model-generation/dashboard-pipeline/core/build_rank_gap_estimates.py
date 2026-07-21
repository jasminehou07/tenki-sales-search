from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from pipeline_paths import RAW_DATA_ROOT, WORK_ROOT

SOURCE = RAW_DATA_ROOT
OUT = WORK_ROOT / "ranked-shops"
RANKING_FOLDERS = ["genre-ranking", "genre-ranking2", "genre-ranking3"]
SALES_FOLDERS = ["genre-sales", "genre-sales2", "genre-sales3"]
MAX_RANK = 100
DISPLAY_RANK = 20


def estimate_for_rank(records: list[dict], rank: int) -> dict | None:
    if not records:
        return None
    if len(records) == 1:
        only = records[0]
        return {
            "sales": float(only["sales"]),
            "lower_rank": int(only["rank"]),
            "upper_rank": int(only["rank"]),
            "lower_sales": float(only["sales"]),
            "upper_sales": float(only["sales"]),
        }

    left = None
    right = None
    for record in records:
        record_rank = int(record["rank"])
        if record_rank < rank:
            left = record
        elif record_rank > rank and right is None:
            right = record
            break

    if left is None:
        left, right = records[0], records[1]
    elif right is None:
        left, right = records[-2], records[-1]

    left_rank = int(left["rank"])
    right_rank = int(right["rank"])
    left_sales = float(left["sales"])
    right_sales = float(right["sales"])
    if left_rank == right_rank:
        estimate = left_sales
    else:
        ratio = (rank - left_rank) / (right_rank - left_rank)
        estimate = np.exp(np.log1p(left_sales) + ratio * (np.log1p(right_sales) - np.log1p(left_sales))) - 1

    return {
        "sales": max(0, float(estimate)),
        "lower_rank": left_rank,
        "upper_rank": right_rank,
        "lower_sales": left_sales,
        "upper_sales": right_sales,
    }


def build_rank_rows(group: pd.DataFrame) -> list[dict]:
    ranked = (
        group.groupby(["rank", "shop"], as_index=False)["sales"]
        .sum()
        .sort_values("rank")
    )
    rows: list[dict] = []
    if ranked.empty:
        return rows

    rank_sales = (
        ranked[ranked["sales"].gt(0)]
        .groupby("rank", as_index=False)["sales"]
        .sum()
        .sort_values("rank")
    )
    date = group["date"].iat[0]
    genre = str(group["genre_id"].iat[0])
    for row in ranked[ranked["rank"].le(DISPLAY_RANK)].to_dict("records"):
        sales = float(row["sales"])
        rows.append({
            "date": date,
            "genre": genre,
            "rank": int(row["rank"]),
            "shop": str(row["shop"]),
            "source": "actual",
            "sales": round(sales, 2) if sales > 0 else "",
            "lower_rank": "",
            "upper_rank": "",
            "lower_sales": "",
            "upper_sales": "",
        })

    records = rank_sales.to_dict("records")
    known_positive_ranks = {int(record["rank"]) for record in records}
    for rank in range(1, DISPLAY_RANK + 1):
        if rank in known_positive_ranks:
            continue
        estimate = estimate_for_rank(records, rank)
        if estimate is None:
            continue
        rows.append({
            "date": date,
            "genre": genre,
            "rank": rank,
            "shop": "",
            "source": "estimated",
            "sales": round(estimate["sales"], 2),
            "lower_rank": estimate["lower_rank"],
            "upper_rank": estimate["upper_rank"],
            "lower_sales": round(estimate["lower_sales"], 2),
            "upper_sales": round(estimate["upper_sales"], 2),
        })
    return rows


def sales_path_for_genre(genre: str) -> Path | None:
    for folder in SALES_FOLDERS:
        path = SOURCE / folder / f"{genre}.parquet"
        if path.exists():
            return path
    return None


def process_genre(rank_path: Path) -> pd.DataFrame:
    genre = rank_path.stem
    sales_path = sales_path_for_genre(genre)
    if sales_path is None:
        return pd.DataFrame()

    ranks = pd.read_parquet(rank_path, columns=["date", "shop", "item", "rank", "genre_id"])
    ranks = ranks[ranks["rank"].between(1, MAX_RANK)].copy()
    if ranks.empty:
        return pd.DataFrame()

    sales = pd.read_parquet(sales_path, columns=["date", "shop", "item", "sales"])
    merged = ranks.merge(sales, on=["date", "shop", "item"], how="left")
    merged["sales"] = merged["sales"].fillna(0)
    merged["genre_id"] = merged["genre_id"].astype(str)

    rank_rows = []
    for _, group in merged.groupby(["date", "genre_id"], sort=False):
        rank_rows.extend(build_rank_rows(group))
    return pd.DataFrame(rank_rows)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for old_file in OUT.glob("*.csv"):
        old_file.unlink()
    by_month: dict[str, list[pd.DataFrame]] = {}
    paths = []
    for folder in RANKING_FOLDERS:
        paths.extend(sorted((SOURCE / folder).glob("*.parquet")))
    for index, path in enumerate(paths, start=1):
        frame = process_genre(path)
        print(f"{index}/{len(paths)} {path.stem}: {len(frame):,} rank rows", flush=True)
        if frame.empty:
            continue
        frame["date"] = pd.to_datetime(frame["date"]).dt.strftime("%Y-%m-%d")
        frame["month"] = frame["date"].str.slice(0, 7)
        for month, month_frame in frame.groupby("month"):
            by_month.setdefault(month, []).append(month_frame.drop(columns=["month"]))

    for month, frames in sorted(by_month.items()):
        out = pd.concat(frames, ignore_index=True).sort_values(["date", "genre", "rank"])
        out.to_csv(OUT / f"{month}.csv", index=False)
        print(f"wrote {month}: {len(out):,} rows", flush=True)


if __name__ == "__main__":
    main()
