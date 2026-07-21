from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from pipeline_paths import WORK_ROOT

RANK_DIR = WORK_ROOT / "ranked-shops"
TRAINING_SOURCE = WORK_ROOT / "rank_training_known_sales.csv"
REPORT_OUT = WORK_ROOT / "rank_output_sanity_report.csv"
MAX_RANK = 80


def smooth_descending(values: np.ndarray) -> np.ndarray:
    cleaned = np.nan_to_num(np.asarray(values, dtype=float), nan=0.0, posinf=0.0, neginf=0.0)
    cleaned = cleaned.clip(min=0)
    if len(cleaned) < 2 or cleaned.max() <= 0:
        return cleaned

    original_total = float(cleaned.sum())
    for index in range(1, len(cleaned)):
        if cleaned[index] <= 0 or cleaned[index] >= cleaned[index - 1] * 0.985:
            cleaned[index] = cleaned[index - 1] * 0.965

    for index in range(1, len(cleaned)):
        rank = index + 1
        min_ratio = 0.62 if rank <= 5 else 0.72 if rank <= 20 else 0.82
        floor = cleaned[index - 1] * min_ratio
        if 0 < cleaned[index] < floor:
            cleaned[index] = floor

    # Keep the total directionally similar, then cap again later. This removes
    # jagged holes without letting one odd rank value dominate the whole curve.
    if original_total > 0 and cleaned.sum() > 0:
        cleaned *= original_total / float(cleaned.sum())
    return cleaned


def build_caps(training: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    training = training.copy()
    training["genre"] = training["genre"].astype(str)
    training["rank"] = pd.to_numeric(training["rank"], errors="coerce").astype("Int64")
    training["sales"] = pd.to_numeric(training["sales"], errors="coerce")
    training = training[training["rank"].between(1, MAX_RANK) & training["sales"].gt(0)].copy()

    genre_rank = (
        training.groupby(["genre", "rank"])["sales"]
        .agg(rows="count", median="median", p95=lambda s: s.quantile(0.95), p99=lambda s: s.quantile(0.99), max="max")
        .reset_index()
    )
    genre_rank["cap"] = np.where(
        genre_rank["rows"].ge(5),
        np.maximum(genre_rank["p99"] * 1.5, genre_rank["median"] * 4.0),
        np.nan,
    )

    genre = (
        training.groupby("genre")["sales"]
        .agg(rows="count", median="median", p95=lambda s: s.quantile(0.95), p99=lambda s: s.quantile(0.99), max="max")
        .reset_index()
    )
    genre["genre_cap"] = np.where(
        genre["rows"].ge(20),
        np.maximum(genre["p99"] * 1.8, genre["median"] * 6.0),
        np.nan,
    )

    rank = (
        training.groupby("rank")["sales"]
        .agg(rows="count", median="median", p95=lambda s: s.quantile(0.95), p99=lambda s: s.quantile(0.99), max="max")
        .reset_index()
    )
    rank["rank_cap"] = np.maximum(rank["p99"] * 1.5, rank["median"] * 8.0)
    return genre_rank[["genre", "rank", "cap", "rows"]], genre[["genre", "genre_cap"]], rank[["rank", "rank_cap"]]


def apply_caps(frame: pd.DataFrame, genre_rank_caps: pd.DataFrame, genre_caps: pd.DataFrame, rank_caps: pd.DataFrame) -> pd.DataFrame:
    out = frame.merge(genre_rank_caps, on=["genre", "rank"], how="left")
    out = out.merge(genre_caps, on="genre", how="left")
    out = out.merge(rank_caps, on="rank", how="left")
    out["history_cap"] = out[["cap", "genre_cap", "rank_cap"]].min(axis=1, skipna=True)
    out["history_cap"] = out["history_cap"].fillna(out["rank_cap"])
    capped = out["history_cap"].notna() & out["sales"].gt(out["history_cap"])
    out.loc[capped, "sales"] = out.loc[capped, "history_cap"]
    out.loc[capped, "source"] = "estimated"
    out["cap_adjusted"] = capped
    return out.drop(columns=["cap", "rows", "genre_cap", "rank_cap", "history_cap"])


def clean_group(group: pd.DataFrame) -> pd.DataFrame:
    group = group.sort_values("rank").copy()
    original = group["sales"].to_numpy(dtype=float)
    cleaned = smooth_descending(original)
    cleaned = np.minimum(cleaned, group["sales"].to_numpy(dtype=float))
    cleaned = smooth_descending(cleaned)

    changed = np.abs(cleaned - original) > np.maximum(original * 0.02, 1.0)
    group["sales"] = np.round(cleaned, 2)
    group.loc[changed, "source"] = "estimated"
    group["shape_adjusted"] = changed
    return group


def sanitize_file(path: Path, genre_rank_caps: pd.DataFrame, genre_caps: pd.DataFrame, rank_caps: pd.DataFrame) -> dict:
    frame = pd.read_csv(path, dtype={"date": "string", "genre": "string", "shop": "string", "item": "string", "source": "string"})
    if "item" not in frame.columns:
        frame["item"] = ""
    frame["rank"] = pd.to_numeric(frame["rank"], errors="coerce").astype("Int64")
    frame["sales"] = pd.to_numeric(frame["sales"], errors="coerce").fillna(0.0)
    frame["sales_low"] = pd.to_numeric(frame["sales_low"], errors="coerce")
    frame["sales_high"] = pd.to_numeric(frame["sales_high"], errors="coerce")

    before_zero = int(frame["sales"].le(0).sum())
    before_order = 0
    for _, group in frame.sort_values(["date", "genre", "rank"]).groupby(["date", "genre"], sort=False):
        values = group["sales"].to_numpy(dtype=float)
        before_order += int(np.sum(values[1:] > values[:-1] + 0.01))

    frame = apply_caps(frame, genre_rank_caps, genre_caps, rank_caps)
    cleaned_groups = []
    for _, group in frame.sort_values(["date", "genre", "rank"]).groupby(["date", "genre"], sort=False):
        cleaned_groups.append(clean_group(group))
    frame = pd.concat(cleaned_groups, ignore_index=True)

    # Rebuild intervals around adjusted estimates. Actual rows that survived
    # unchanged remain exact; adjusted rows use the previous row-specific band.
    estimate_mask = frame["source"].ne("actual")
    low_ratio = (frame["sales_low"] / frame["sales"].replace(0, np.nan)).replace([np.inf, -np.inf], np.nan).fillna(0.72)
    high_ratio = (frame["sales_high"] / frame["sales"].replace(0, np.nan)).replace([np.inf, -np.inf], np.nan).fillna(1.35)
    low_ratio = low_ratio.clip(0.45, 1.0)
    high_ratio = high_ratio.clip(1.0, 2.5)
    frame.loc[estimate_mask, "sales_low"] = (frame.loc[estimate_mask, "sales"] * low_ratio.loc[estimate_mask]).round(2)
    frame.loc[estimate_mask, "sales_high"] = (frame.loc[estimate_mask, "sales"] * high_ratio.loc[estimate_mask]).round(2)
    frame.loc[~estimate_mask, "sales_low"] = frame.loc[~estimate_mask, "sales"]
    frame.loc[~estimate_mask, "sales_high"] = frame.loc[~estimate_mask, "sales"]

    for column in ["lower_rank", "upper_rank", "lower_sales", "upper_sales"]:
        if column not in frame.columns:
            frame[column] = ""

    adjusted = int(frame["shape_adjusted"].sum() + frame["cap_adjusted"].sum())
    frame = frame.drop(columns=["shape_adjusted", "cap_adjusted"])
    frame = frame[[
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
        "item",
    ]]
    frame.to_csv(path, index=False)
    return {
        "month": path.stem,
        "rows": len(frame),
        "zero_or_negative_before": before_zero,
        "rank_order_breaks_before": before_order,
        "adjusted_rows": adjusted,
    }


def main() -> None:
    training = pd.read_csv(TRAINING_SOURCE, dtype={"genre": "string"})
    genre_rank_caps, genre_caps, rank_caps = build_caps(training)
    reports = []
    for path in sorted(RANK_DIR.glob("*.csv")):
        report = sanitize_file(path, genre_rank_caps, genre_caps, rank_caps)
        reports.append(report)
        print(
            f"{report['month']}: adjusted {report['adjusted_rows']:,} rows, "
            f"fixed {report['rank_order_breaks_before']:,} rank-order breaks",
            flush=True,
        )
    pd.DataFrame(reports).to_csv(REPORT_OUT, index=False)
    print(f"wrote {REPORT_OUT}")


if __name__ == "__main__":
    main()
