from __future__ import annotations

import numpy as np
import pandas as pd

from prep_paths import DASHBOARD_ROOT, WORK_ROOT

ROOT = DASHBOARD_ROOT
RANK_DIR = WORK_ROOT / "ranked-shops"
SHOP_ESTIMATE_DIR = ROOT / "data" / "shop-estimates-by-month"
OUT_DIR = ROOT / "data" / "rank-summary-by-month"
ALL_TIME_OUT = ROOT / "data" / "all-time" / "rank_summary_monthly.csv"
PREDICTED_RANK_END = 80
TAIL_START_RANK = PREDICTED_RANK_END + 1
TAIL_END_RANK = 100
TAIL_ALPHA = 1.08
MIN_UNIT_PRICE = 100
MAX_UNIT_PRICE = 1_000_000


def tail_multiplier() -> float:
    ranks = np.arange(TAIL_START_RANK, TAIL_END_RANK + 1, dtype=float)
    return float(np.sum((ranks / float(PREDICTED_RANK_END)) ** -TAIL_ALPHA))


def read_rank_month(path: Path) -> pd.DataFrame:
    frame = pd.read_csv(path, dtype={"date": "string", "genre": "string"})
    for column in ["rank", "sales", "sales_low", "sales_high"]:
        frame[column] = pd.to_numeric(frame[column], errors="coerce").fillna(0)
    return frame


def read_shop_units(path: Path) -> pd.DataFrame:
    frame = pd.read_csv(
        path,
        usecols=[
            "date",
            "genre",
            "predicted_sales",
            "predicted_sales_low",
            "predicted_sales_high",
            "predicted_units",
            "predicted_units_low",
            "predicted_units_high",
        ],
        dtype={"date": "string", "genre": "string"},
    )
    numeric = [column for column in frame.columns if column not in {"date", "genre"}]
    for column in numeric:
        frame[column] = pd.to_numeric(frame[column], errors="coerce").fillna(0)
    return frame


def unit_signal(shop_units: pd.DataFrame) -> pd.DataFrame:
    if shop_units.empty:
        return pd.DataFrame(columns=["date", "genre", "unit_price", "unit_price_low", "unit_price_high"])

    by_genre = (
        shop_units.groupby(["date", "genre"], as_index=False)[[
            "predicted_sales",
            "predicted_sales_low",
            "predicted_sales_high",
            "predicted_units",
            "predicted_units_low",
            "predicted_units_high",
        ]]
        .sum()
    )
    by_all = (
        shop_units.groupby("date", as_index=False)[[
            "predicted_sales",
            "predicted_sales_low",
            "predicted_sales_high",
            "predicted_units",
            "predicted_units_low",
            "predicted_units_high",
        ]]
        .sum()
    )
    by_all["genre"] = "all"
    signal = pd.concat([by_all, by_genre], ignore_index=True)

    signal["unit_price"] = (
        signal["predicted_sales"] / signal["predicted_units"].replace(0, np.nan)
    ).clip(MIN_UNIT_PRICE, MAX_UNIT_PRICE)
    signal["unit_price_low"] = (
        signal["predicted_sales_low"] / signal["predicted_units_low"].replace(0, np.nan)
    ).clip(MIN_UNIT_PRICE, MAX_UNIT_PRICE)
    signal["unit_price_high"] = (
        signal["predicted_sales_high"] / signal["predicted_units_high"].replace(0, np.nan)
    ).clip(MIN_UNIT_PRICE, MAX_UNIT_PRICE)

    global_price = (
        signal["predicted_sales"].sum() / signal["predicted_units"].sum()
        if signal["predicted_units"].sum() > 0
        else 3000.0
    )
    global_price = float(np.clip(global_price, MIN_UNIT_PRICE, MAX_UNIT_PRICE))
    for column in ["unit_price", "unit_price_low", "unit_price_high"]:
        signal[column] = signal[column].fillna(global_price)

    return signal[["date", "genre", "unit_price", "unit_price_low", "unit_price_high"]]


def summarize_rank_sales(rank_rows: pd.DataFrame) -> pd.DataFrame:
    visible = (
        rank_rows.groupby(["date", "genre"], as_index=False)[["sales", "sales_low", "sales_high"]]
        .sum()
    )
    tail_anchor = (
        rank_rows[rank_rows["rank"].eq(PREDICTED_RANK_END)]
        .groupby(["date", "genre"], as_index=False)[["sales", "sales_low", "sales_high"]]
        .median()
    )
    multiplier = tail_multiplier()
    tail_anchor[["sales", "sales_low", "sales_high"]] *= multiplier
    summary = visible.merge(tail_anchor, on=["date", "genre"], how="left", suffixes=("_visible", "_tail"))
    for column in ["sales", "sales_low", "sales_high"]:
        summary[column] = summary[f"{column}_visible"] + summary[f"{column}_tail"].fillna(0)
    summary = summary[["date", "genre", "sales", "sales_low", "sales_high"]]

    all_rows = (
        summary.groupby("date", as_index=False)[["sales", "sales_low", "sales_high"]]
        .sum()
    )
    all_rows["genre"] = "all"
    return pd.concat([all_rows, summary], ignore_index=True)


def apply_unit_model(summary: pd.DataFrame, signal: pd.DataFrame) -> pd.DataFrame:
    out = summary.merge(signal, on=["date", "genre"], how="left")

    genre_price = signal.groupby("genre")["unit_price"].median()
    global_price = float(signal["unit_price"].median()) if not signal.empty else 3000.0
    out["unit_price"] = out["unit_price"].fillna(out["genre"].map(genre_price)).fillna(global_price)
    out["unit_price_low"] = out["unit_price_low"].fillna(out["unit_price"])
    out["unit_price_high"] = out["unit_price_high"].fillna(out["unit_price"])

    out["units"] = (out["sales"] / out["unit_price"]).round().clip(lower=0).astype("int64")
    out["units_low"] = (out["sales_low"] / out["unit_price_low"]).round().clip(lower=0).astype("int64")
    out["units_high"] = (out["sales_high"] / out["unit_price_high"]).round().clip(lower=0).astype("int64")
    out["units_low"] = out[["units_low", "units"]].min(axis=1)
    out["units_high"] = out[["units_high", "units"]].max(axis=1)

    return out.rename(columns={"unit_price": "avg_price"})[[
        "date",
        "genre",
        "sales",
        "sales_low",
        "sales_high",
        "units",
        "units_low",
        "units_high",
        "avg_price",
    ]]


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    monthly_outputs = []
    for rank_path in sorted(RANK_DIR.glob("*.csv")):
        month = rank_path.stem
        shop_path = SHOP_ESTIMATE_DIR / f"{month}.csv"
        if not shop_path.exists():
            continue
        rank_rows = read_rank_month(rank_path)
        shop_units = read_shop_units(shop_path)
        summary = apply_unit_model(summarize_rank_sales(rank_rows), unit_signal(shop_units))
        summary.to_csv(OUT_DIR / f"{month}.csv", index=False)
        monthly = summary.copy()
        monthly["date"] = month + "-01"
        grouped = monthly.groupby(["date", "genre"], as_index=False)[[
            "sales",
            "sales_low",
            "sales_high",
            "units",
            "units_low",
            "units_high",
        ]].sum()
        grouped["avg_price"] = (
            grouped["sales"] / grouped["units"].replace(0, np.nan)
        ).fillna(0)
        monthly_outputs.append(grouped)

    if monthly_outputs:
        all_time = pd.concat(monthly_outputs, ignore_index=True)
        ALL_TIME_OUT.parent.mkdir(parents=True, exist_ok=True)
        all_time.to_csv(ALL_TIME_OUT, index=False)

    print(f"wrote {len(monthly_outputs)} monthly rank summary files")
    print(f"unit source: trained predicted_units from {SHOP_ESTIMATE_DIR}")


if __name__ == "__main__":
    main()
