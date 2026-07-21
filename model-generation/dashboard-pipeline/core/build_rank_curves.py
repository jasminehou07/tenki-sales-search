from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from pipeline_paths import DASHBOARD_ROOT

SOURCE = DASHBOARD_ROOT / "data" / "ranked-shops"
EVENTS_FILE = DASHBOARD_ROOT / "data" / "events.csv"
CURVE_OUT = DASHBOARD_ROOT / "data" / "rank_curves.csv"
EVENT_FACTOR_OUT = DASHBOARD_ROOT / "data" / "rank_event_factors.csv"
METRICS_OUT = DASHBOARD_ROOT / "data" / "rank_model_metrics.csv"
DISPLAY_RANK = 20
HOLDOUT_RATE = 0.05
SEED = 20260609
GLOBAL_GENRE = "__global__"
MIN_EVENT_ROWS = 5
MIN_GLOBAL_EVENT_ROWS = 20
MIN_FACTOR = 0.65
MAX_FACTOR = 2.4


def load_known_sales() -> pd.DataFrame:
    frames = []
    for path in sorted(SOURCE.glob("*.csv")):
        frame = pd.read_csv(path, usecols=["date", "genre", "rank", "source", "sales"])
        frame = frame[(frame["source"] == "actual") & frame["rank"].between(1, DISPLAY_RANK)]
        frame["sales"] = pd.to_numeric(frame["sales"], errors="coerce")
        frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
        frame = frame[frame["sales"].gt(0)]
        if not frame.empty:
            frames.append(frame[["date", "genre", "rank", "sales"]])

    if not frames:
        raise SystemExit("No known actual rank sales rows found")
    return pd.concat(frames, ignore_index=True)


def load_events() -> pd.DataFrame:
    events = pd.read_csv(EVENTS_FILE)
    events["start_date"] = pd.to_datetime(events["start_date"], errors="coerce")
    events["end_date"] = pd.to_datetime(events["end_date"], errors="coerce")
    events = events.dropna(subset=["name", "start_date", "end_date"])
    return events[["name", "start_date", "end_date"]]


def monotone_curve(values: pd.Series) -> pd.Series:
    fixed = values.copy()
    running = 0.0
    for rank in sorted(fixed.index, reverse=True):
        if pd.isna(fixed.loc[rank]):
            continue
        running = max(running, float(fixed.loc[rank]))
        fixed.loc[rank] = running
    return fixed


def train_curves(data: pd.DataFrame) -> pd.DataFrame:
    global_by_rank = data.groupby("rank")["sales"].median()
    rows = []

    for genre, group in data.groupby("genre", sort=True):
        by_rank = group.groupby("rank")["sales"].median()
        ranks = pd.Index(range(1, DISPLAY_RANK + 1), name="rank")
        curve = by_rank.reindex(ranks)
        curve = curve.interpolate(method="linear", limit_direction="both")
        curve = curve.fillna(global_by_rank.reindex(ranks))
        curve = curve.fillna(data["sales"].median())
        curve = monotone_curve(curve)

        for rank, estimate in curve.items():
            rows.append({
                "genre": genre,
                "rank": int(rank),
                "estimated_sales": round(float(estimate), 2),
            })

    return pd.DataFrame(rows).sort_values(["genre", "rank"])


def add_event_names(data: pd.DataFrame, events: pd.DataFrame) -> pd.DataFrame:
    data = data.copy()
    data["event_names"] = [[] for _ in range(len(data))]
    if events.empty:
        return data

    for event in events.itertuples(index=False):
        mask = data["date"].between(event.start_date, event.end_date)
        if mask.any():
            data.loc[mask, "event_names"] = data.loc[mask, "event_names"].map(lambda names, name=event.name: names + [name])
    return data


def event_factor_lookup(factors: pd.DataFrame) -> dict:
    return {
        (row.genre, row.event): float(row.factor)
        for row in factors.itertuples(index=False)
    }


def best_event_factor(row: pd.Series, lookup: dict) -> float:
    factor = 1.0
    for event_name in row.event_names:
        genre_factor = lookup.get((row.genre, event_name))
        global_factor = lookup.get((GLOBAL_GENRE, event_name))
        event_factor = genre_factor if genre_factor is not None else global_factor
        if event_factor is not None:
            factor = max(factor, float(event_factor))
    return factor


def train_event_factors(data: pd.DataFrame, curves: pd.DataFrame, events: pd.DataFrame) -> pd.DataFrame:
    if events.empty:
        return pd.DataFrame(columns=["genre", "event", "factor", "rows"])

    prediction_map = {
        (row.genre, int(row.rank)): float(row.estimated_sales)
        for row in curves.itertuples(index=False)
    }
    rows = []
    event_data = add_event_names(data, events)

    for row in event_data.itertuples(index=False):
        baseline = prediction_map.get((row.genre, int(row.rank)))
        if not baseline or not np.isfinite(baseline) or baseline <= 0 or not row.event_names:
            continue
        residual = float(row.sales) / float(baseline)
        if np.isfinite(residual) and residual > 0:
            for event_name in row.event_names:
                rows.append({
                    "genre": row.genre,
                    "event": event_name,
                    "residual": residual,
                })

    if not rows:
        return pd.DataFrame(columns=["genre", "event", "factor", "rows"])

    residuals = pd.DataFrame(rows)
    factor_rows = []

    by_genre_event = residuals.groupby(["genre", "event"])["residual"].agg(["median", "count"]).reset_index()
    by_genre_event = by_genre_event[by_genre_event["count"].ge(MIN_EVENT_ROWS)]
    for row in by_genre_event.itertuples(index=False):
        factor_rows.append({
            "genre": row.genre,
            "event": row.event,
            "factor": round(float(np.clip(row.median, MIN_FACTOR, MAX_FACTOR)), 4),
            "rows": int(row.count),
        })

    by_event = residuals.groupby("event")["residual"].agg(["median", "count"]).reset_index()
    by_event = by_event[by_event["count"].ge(MIN_GLOBAL_EVENT_ROWS)]
    for row in by_event.itertuples(index=False):
        factor_rows.append({
            "genre": GLOBAL_GENRE,
            "event": row.event,
            "factor": round(float(np.clip(row.median, MIN_FACTOR, MAX_FACTOR)), 4),
            "rows": int(row.count),
        })

    return pd.DataFrame(factor_rows).sort_values(["genre", "event"])


def evaluate_holdout(data: pd.DataFrame, events: pd.DataFrame) -> dict:
    rng = np.random.default_rng(SEED)
    holdout_mask = rng.random(len(data)) < HOLDOUT_RATE
    if holdout_mask.sum() == 0:
        holdout_mask[rng.integers(0, len(data))] = True

    train = data.loc[~holdout_mask].copy()
    test = data.loc[holdout_mask].copy()
    curves = train_curves(train)
    event_factors = train_event_factors(train, curves, events)
    factor_lookup = event_factor_lookup(event_factors)
    prediction_map = {
        (row.genre, int(row.rank)): float(row.estimated_sales)
        for row in curves.itertuples(index=False)
    }
    global_by_rank = train.groupby("rank")["sales"].median().to_dict()
    global_median = float(train["sales"].median())

    predictions = []
    test_with_events = add_event_names(test, events)
    for row in test_with_events.itertuples(index=False):
        prediction = prediction_map.get((row.genre, int(row.rank)))
        if prediction is None or not np.isfinite(prediction):
            prediction = float(global_by_rank.get(int(row.rank), global_median))
        prediction *= best_event_factor(pd.Series(row._asdict()), factor_lookup)
        predictions.append(prediction)

    actual = test["sales"].to_numpy(dtype=float)
    predicted = np.asarray(predictions, dtype=float)
    absolute_error = np.abs(predicted - actual)
    ape = absolute_error / np.maximum(actual, 1.0)

    return {
        "holdout_rate": HOLDOUT_RATE,
        "train_rows": int(len(train)),
        "test_rows": int(len(test)),
        "event_factor_rows": int(len(event_factors)),
        "wmape": round(float(absolute_error.sum() / actual.sum()), 6),
        "median_ape": round(float(np.median(ape)), 6),
        "within_25_percent": round(float((ape <= 0.25).mean()), 6),
    }


def main() -> None:
    data = load_known_sales()
    events = load_events()
    metrics = evaluate_holdout(data, events)
    curves = train_curves(data)
    event_factors = train_event_factors(data, curves, events)

    curves.to_csv(CURVE_OUT, index=False)
    event_factors.to_csv(EVENT_FACTOR_OUT, index=False)
    pd.DataFrame([metrics]).to_csv(METRICS_OUT, index=False)

    print(f"known actual sales rows: {len(data):,}")
    print(f"wrote {CURVE_OUT}: {len(curves):,} rows across {curves['genre'].nunique():,} genres")
    print(f"wrote {EVENT_FACTOR_OUT}: {len(event_factors):,} event factors")
    print(f"wrote {METRICS_OUT}: {metrics}")


if __name__ == "__main__":
    main()
