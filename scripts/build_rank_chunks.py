from __future__ import annotations

from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "work" / "ranked-shops"
OUT = ROOT / "data" / "ranked-shops-by-genre"
RANK_DISPLAY_LIMIT = 80


def build_all_item_rows(frame: pd.DataFrame) -> pd.DataFrame:
    rows = []
    source = frame.copy()
    source["sales"] = pd.to_numeric(source["sales"], errors="coerce").fillna(0)
    source["rank"] = pd.to_numeric(source["rank"], errors="coerce")
    source = source[(source["rank"].notna()) & (source["rank"] >= 1) & (source["rank"] <= RANK_DISPLAY_LIMIT)]
    source = source[source["sales"] > 0]
    source = source[source["shop"].fillna("").ne("") & source["item"].fillna("").ne("")]
    for _, group in source.groupby("date", sort=True):
        top = (
            group.sort_values(["sales", "rank", "genre", "shop", "item"], ascending=[False, True, True, True, True])
            .head(RANK_DISPLAY_LIMIT)
            .copy()
        )
        top["rank"] = range(1, len(top) + 1)
        rows.append(top)
    if not rows:
        return frame.head(0).copy()
    return pd.concat(rows, ignore_index=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    months = sorted(SOURCE.glob("*.csv"))
    for index, path in enumerate(months, start=1):
        frame = pd.read_csv(path, dtype={"date": "string", "genre": "string", "shop": "string", "item": "string", "source": "string"})
        if "item" not in frame.columns:
            frame["item"] = ""

        for genre, group in frame.groupby("genre", sort=True):
            target_dir = OUT / str(genre)
            target_dir.mkdir(parents=True, exist_ok=True)
            group.to_csv(target_dir / path.name, index=False)

        all_rows = (
            frame.groupby(["date", "rank"], as_index=False)[["sales", "sales_low", "sales_high"]]
            .sum()
            .sort_values(["date", "rank"])
        )
        all_rows["genre"] = "all"
        all_rows["shop"] = ""
        all_rows["item"] = ""
        all_rows["source"] = "estimated"
        all_rows["lower_rank"] = ""
        all_rows["upper_rank"] = ""
        all_rows["lower_sales"] = ""
        all_rows["upper_sales"] = ""
        all_rows = all_rows[[
            "date",
            "genre",
            "rank",
            "shop",
            "item",
            "source",
            "sales",
            "sales_low",
            "sales_high",
            "lower_rank",
            "upper_rank",
            "lower_sales",
            "upper_sales",
        ]]
        target_dir = OUT / "all"
        target_dir.mkdir(parents=True, exist_ok=True)
        all_rows.to_csv(target_dir / path.name, index=False)

        all_item_rows = build_all_item_rows(frame)
        target_dir = OUT / "all-items"
        target_dir.mkdir(parents=True, exist_ok=True)
        all_item_rows.to_csv(target_dir / path.name, index=False)
        print(f"{index}/{len(months)} {path.name}")


if __name__ == "__main__":
    main()
