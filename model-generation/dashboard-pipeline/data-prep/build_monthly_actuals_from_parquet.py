from __future__ import annotations

import pandas as pd

from prep_paths import DASHBOARD_ROOT, discover_partitioned_parquet

ROOT = DASHBOARD_ROOT
BY_MONTH_OUT = ROOT / "data" / "by-month"


def read_sales_file(path) -> pd.DataFrame:
    frame = pd.read_parquet(
        path,
        columns=["date", "shop", "item", "item_genre", "sales", "sales_items", "pv"],
    )
    frame = frame.rename(
        columns={
            "item_genre": "genre",
            "sales_items": "units",
            "pv": "page_views",
        }
    )
    frame["date"] = pd.to_datetime(frame["date"], errors="coerce").dt.strftime("%Y-%m-%d")
    frame["shop"] = frame["shop"].astype(str)
    frame["genre"] = frame["genre"].astype(str)
    frame["item"] = frame["item"].astype(str)
    for column in ["sales", "units", "page_views"]:
        frame[column] = pd.to_numeric(frame[column], errors="coerce").fillna(0)
    return frame.dropna(subset=["date", "genre", "shop"])


def main() -> None:
    by_month: dict[str, list[pd.DataFrame]] = {}
    paths = discover_partitioned_parquet("genre-sales")

    for index, path in enumerate(paths, start=1):
        frame = read_sales_file(path)
        if frame.empty:
            print(f"{index}/{len(paths)} {path.stem}: empty", flush=True)
            continue
        frame["month"] = frame["date"].str.slice(0, 7)
        daily = (
            frame.groupby(["date", "shop", "genre"], as_index=False)[["sales", "units", "page_views"]]
            .sum()
        )
        for month, month_frame in daily.assign(month=daily["date"].str.slice(0, 7)).groupby("month"):
            by_month.setdefault(month, []).append(month_frame.drop(columns=["month"]))
        print(f"{index}/{len(paths)} {path.stem}: {len(daily):,} daily rows", flush=True)

    BY_MONTH_OUT.mkdir(parents=True, exist_ok=True)
    for path in BY_MONTH_OUT.glob("*.csv"):
        path.unlink()

    for month, frames in sorted(by_month.items()):
        out = (
            pd.concat(frames, ignore_index=True)
            .groupby(["date", "shop", "genre"], as_index=False)[["sales", "units", "page_views"]]
            .sum()
            .sort_values(["date", "genre", "shop"])
        )
        out.to_csv(BY_MONTH_OUT / f"{month}.csv", index=False)
        print(f"wrote daily {month}: {len(out):,} rows", flush=True)


if __name__ == "__main__":
    main()
