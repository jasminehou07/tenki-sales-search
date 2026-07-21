from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from pipeline_paths import WORK_ROOT

RANK_DIR = WORK_ROOT / "ranked-shops"
MAX_RANK = 80
ANCHOR_RANK = 20
TAIL_ALPHA = 1.08
COLUMNS = [
    "date",
    "genre",
    "rank",
    "shop",
    "source",
    "sales",
    "sales_low",
    "sales_high",
    "lower_rank",
    "upper_rank",
    "lower_sales",
    "upper_sales",
]


def extend_month(frame: pd.DataFrame) -> pd.DataFrame:
    frame = frame.copy()
    for column in ["rank", "sales", "sales_low", "sales_high"]:
        frame[column] = pd.to_numeric(frame[column], errors="coerce").fillna(0)
    frame["rank"] = frame["rank"].astype(int)
    frame = frame[frame["rank"].between(1, MAX_RANK)].copy()

    keys = frame[["date", "genre"]].drop_duplicates()
    ranks = pd.DataFrame({"rank": np.arange(1, MAX_RANK + 1, dtype=int)})
    grid = keys.merge(ranks, how="cross")
    out = grid.merge(frame, on=["date", "genre", "rank"], how="left", suffixes=("", "_existing"))

    anchor = frame[frame["rank"].eq(ANCHOR_RANK)][["date", "genre", "sales", "sales_low", "sales_high"]].rename(
        columns={
            "sales": "anchor_sales",
            "sales_low": "anchor_sales_low",
            "sales_high": "anchor_sales_high",
        }
    )
    out = out.merge(anchor, on=["date", "genre"], how="left")
    decay = (out["rank"].astype(float) / ANCHOR_RANK) ** -TAIL_ALPHA
    missing = out["sales"].isna()
    out.loc[missing, "sales"] = out.loc[missing, "anchor_sales"].fillna(0) * decay.loc[missing]
    out.loc[missing, "sales_low"] = out.loc[missing, "anchor_sales_low"].fillna(0) * decay.loc[missing]
    out.loc[missing, "sales_high"] = out.loc[missing, "anchor_sales_high"].fillna(0) * decay.loc[missing]

    out["shop"] = out["shop"].fillna("")
    out["source"] = out["source"].fillna("estimated")
    for column in ["lower_rank", "upper_rank", "lower_sales", "upper_sales"]:
        out[column] = out[column].fillna("")
    for column in ["sales", "sales_low", "sales_high"]:
        out[column] = pd.to_numeric(out[column], errors="coerce").fillna(0).round(2)

    return out[COLUMNS].sort_values(["date", "genre", "rank"])


def main() -> None:
    months = sorted(RANK_DIR.glob("*.csv"))
    for index, path in enumerate(months, start=1):
        frame = pd.read_csv(
            path,
            dtype={"date": "string", "genre": "string", "shop": "string", "source": "string"},
        )
        frame["rank"] = pd.to_numeric(frame["rank"], errors="coerce").fillna(0).astype(int)
        expected_rows = len(frame[["date", "genre"]].drop_duplicates()) * MAX_RANK
        if int(frame["rank"].max()) >= MAX_RANK and len(frame) == expected_rows:
            print(f"{index}/{len(months)} {path.name}: already rank {MAX_RANK}, rows {len(frame):,}")
            continue
        extended = extend_month(frame)
        extended.to_csv(path, index=False)
        print(f"{index}/{len(months)} {path.name}: max rank {int(extended['rank'].max())}, rows {len(extended):,}")


if __name__ == "__main__":
    main()
