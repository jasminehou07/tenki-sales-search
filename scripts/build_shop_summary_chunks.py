from __future__ import annotations

from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "shop-estimates-by-month"
OUT = ROOT / "data" / "shop-summary-by-month"
ALL_TIME_OUT = ROOT / "data" / "all-time" / "shop_summary_monthly.csv"

SUM_COLUMNS = [
    "predicted_sales",
    "predicted_sales_low",
    "predicted_sales_high",
    "predicted_units",
    "predicted_units_low",
    "predicted_units_high",
    "predicted_page_views",
    "predicted_page_views_low",
    "predicted_page_views_high",
]


def summarize_month(path: Path) -> pd.DataFrame:
    frame = pd.read_csv(path, dtype={"date": "string", "shop": "string"})
    for column in SUM_COLUMNS:
        frame[column] = pd.to_numeric(frame.get(column, 0), errors="coerce").fillna(0)
    summary = frame.groupby(["date", "shop"], as_index=False)[SUM_COLUMNS].sum()
    summary.insert(2, "genre", "all")
    return summary


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    monthly_frames = []
    for index, path in enumerate(sorted(SOURCE.glob("*.csv")), start=1):
        summary = summarize_month(path)
        summary.to_csv(OUT / path.name, index=False)
        monthly = summary.copy()
        monthly["date"] = monthly["date"].str.slice(0, 7) + "-01"
        monthly_frames.append(
            monthly.groupby(["date", "shop", "genre"], as_index=False)[SUM_COLUMNS].sum()
        )
        print(f"{index}: wrote {path.name} ({len(summary):,} rows)")

    all_time = pd.concat(monthly_frames, ignore_index=True)
    all_time = all_time.groupby(["date", "shop", "genre"], as_index=False)[SUM_COLUMNS].sum()
    ALL_TIME_OUT.parent.mkdir(parents=True, exist_ok=True)
    all_time.to_csv(ALL_TIME_OUT, index=False)
    print(f"wrote {ALL_TIME_OUT} ({len(all_time):,} rows)")


if __name__ == "__main__":
    main()
