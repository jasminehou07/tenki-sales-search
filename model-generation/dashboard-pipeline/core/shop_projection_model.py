from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd


VALID_START = pd.Timestamp("2025-06-01")
HOLDOUT_START = pd.Timestamp("2025-12-03")
HIDDEN_HOLDOUT_RATE = 0.05
HIDDEN_HOLDOUT_SEED = 20260615
LAG_WEIGHTS = {"lag_7": 0.50, "lag_28": 0.30, "lag_90": 0.20}
DEFAULT_SEASONAL_WEIGHT = 0.35
DEFAULT_PREDICTION_SCALE = 0.9380731325338724
SEASONAL_WEIGHT_GRID = [0.0, 0.10, 0.15, 0.25, 0.35, 0.45, 0.60, 0.75]
SCALE_MULTIPLIER_GRID = [0.82, 0.90, 0.96, 1.0, 1.04, 1.10, 1.18]
MAX_EVENT_DAYS = 45
EVENT_INTENSITY = {
    "supersale": 3.0,
    "black-friday": 2.6,
    "newyear-sale": 2.4,
    "thank-you": 2.1,
    "marathon": 1.8,
    "singles-day": 1.7,
    "fashionthesale": 1.6,
    "point-back": 1.4,
    "point-up": 1.3,
    "39shop": 1.25,
    "ichiba-day": 1.2,
    "wonderful-day": 1.15,
    "zero-five": 1.05,
}
LAG_WEIGHT_PROFILES = {
    "very_recent": {"lag_7": 0.84, "lag_28": 0.12, "lag_90": 0.04},
    "recent": {"lag_7": 0.70, "lag_28": 0.20, "lag_90": 0.10},
    "two_week": {"lag_7": 0.58, "lag_28": 0.34, "lag_90": 0.08},
    "balanced": LAG_WEIGHTS,
    "month": {"lag_7": 0.25, "lag_28": 0.55, "lag_90": 0.20},
    "long": {"lag_7": 0.20, "lag_28": 0.30, "lag_90": 0.50},
    "very_long": {"lag_7": 0.10, "lag_28": 0.25, "lag_90": 0.65},
}
DEFAULT_LAG_PROFILE = "balanced"
MIN_FACTOR_ROWS = 25


def load_sales(data_dir: Path, metric: str = "sales") -> pd.DataFrame:
    frames = []
    for path in sorted(data_dir.glob("*.csv")):
        frame = pd.read_csv(
            path,
            usecols=["date", "shop", "genre", metric],
            dtype={"shop": "string", "genre": "string", metric: "float64"},
        )
        if metric != "sales":
            frame = frame.rename(columns={metric: "sales"})
        frames.append(frame)
    data = pd.concat(frames, ignore_index=True)
    data["date"] = pd.to_datetime(data["date"])
    data["sales"] = data["sales"].clip(lower=0)
    return data.sort_values(["shop", "genre", "date"]).reset_index(drop=True)


def active_events(events_file: Path, min_date: pd.Timestamp, max_date: pd.Timestamp) -> pd.DataFrame:
    events = pd.read_csv(events_file)
    events["start_date"] = pd.to_datetime(events["start_date"])
    events["end_date"] = pd.to_datetime(events["end_date"])
    events["duration_days"] = (events["end_date"] - events["start_date"]).dt.days + 1
    events = events[events["duration_days"].between(1, MAX_EVENT_DAYS)].copy()
    events["intensity"] = events["name"].map(EVENT_INTENSITY).fillna(1.1).astype(float)
    calendar = pd.DataFrame({"date": pd.date_range(min_date, max_date, freq="D")})
    calendar["event_intensity"] = 0.0
    calendar["major_event_intensity"] = 0.0
    calendar["event_count"] = 0
    calendar["event_day_share"] = 0.0
    for name in sorted(events["name"].unique()):
        calendar[f"event_{name}"] = 0
    for row in events.itertuples(index=False):
        mask = calendar["date"].between(row.start_date, row.end_date)
        calendar.loc[mask, f"event_{row.name}"] = 1
        calendar.loc[mask, "event_intensity"] = np.maximum(
            calendar.loc[mask, "event_intensity"],
            float(row.intensity),
        )
        if row.intensity >= 1.8:
            calendar.loc[mask, "major_event_intensity"] = np.maximum(
                calendar.loc[mask, "major_event_intensity"],
                float(row.intensity),
            )
        calendar.loc[mask, "event_count"] += 1
        event_day = (calendar.loc[mask, "date"] - row.start_date).dt.days + 1
        calendar.loc[mask, "event_day_share"] = np.maximum(
            calendar.loc[mask, "event_day_share"],
            event_day / max(float(row.duration_days), 1.0),
        )
    return calendar


def add_history_features(data: pd.DataFrame) -> pd.DataFrame:
    out = data.copy()
    group = out.groupby(["shop", "genre"], sort=False)["sales"]
    out["lag_1"] = group.transform(lambda s: s.shift(1))
    out["lag_7"] = group.transform(lambda s: s.shift(1).rolling(7, min_periods=1).mean())
    out["lag_14"] = group.transform(lambda s: s.shift(1).rolling(14, min_periods=1).mean())
    out["lag_28"] = group.transform(lambda s: s.shift(1).rolling(28, min_periods=1).mean())
    out["lag_56"] = group.transform(lambda s: s.shift(1).rolling(56, min_periods=1).mean())
    out["lag_90"] = group.transform(lambda s: s.shift(1).rolling(90, min_periods=1).mean())
    shifted_positive = group.transform(lambda s: s.shift(1).gt(0).astype(float))
    out["positive_rate_7"] = shifted_positive.groupby([out["shop"], out["genre"]], sort=False).transform(
        lambda s: s.rolling(7, min_periods=1).mean()
    )
    out["positive_rate_28"] = shifted_positive.groupby([out["shop"], out["genre"]], sort=False).transform(
        lambda s: s.rolling(28, min_periods=1).mean()
    )
    out["positive_rate_90"] = shifted_positive.groupby([out["shop"], out["genre"]], sort=False).transform(
        lambda s: s.rolling(90, min_periods=1).mean()
    )
    out["recent_max_7"] = group.transform(lambda s: s.shift(1).rolling(7, min_periods=1).max())
    out["recent_max_28"] = group.transform(lambda s: s.shift(1).rolling(28, min_periods=1).max())
    out["recent_std_28"] = group.transform(lambda s: s.shift(1).rolling(28, min_periods=2).std())
    return out


def _seasonal_factor_tables(train: pd.DataFrame) -> dict[str, object]:
    daily = train.groupby("date", as_index=False)["sales"].sum()
    daily["dow"] = daily["date"].dt.dayofweek
    daily["month_num"] = daily["date"].dt.month
    daily["quarter"] = daily["date"].dt.quarter
    overall_daily = daily["sales"].mean()
    global_dow = (daily.groupby("dow")["sales"].mean() / overall_daily).clip(0.75, 1.35)
    global_month = (daily.groupby("month_num")["sales"].mean() / overall_daily).clip(0.75, 1.35)
    global_quarter = (daily.groupby("quarter")["sales"].mean() / overall_daily).clip(0.80, 1.25)

    genre_daily = train.groupby(["genre", "date"], as_index=False)["sales"].sum()
    genre_daily["dow"] = genre_daily["date"].dt.dayofweek
    genre_daily["month_num"] = genre_daily["date"].dt.month
    genre_daily["quarter"] = genre_daily["date"].dt.quarter
    genre_overall = genre_daily.groupby("genre")["sales"].mean()

    genre_dow = (
        genre_daily.groupby(["genre", "dow"])["sales"].mean()
        .div(genre_overall, level="genre")
        .clip(0.65, 1.55)
        .rename("genre_dow_factor")
        .reset_index()
    )
    genre_month = (
        genre_daily.groupby(["genre", "month_num"])["sales"].mean()
        .div(genre_overall, level="genre")
        .clip(0.65, 1.55)
        .rename("genre_month_factor")
        .reset_index()
    )
    genre_quarter = (
        genre_daily.groupby(["genre", "quarter"])["sales"].mean()
        .div(genre_overall, level="genre")
        .clip(0.70, 1.40)
        .rename("genre_quarter_factor")
        .reset_index()
    )
    return {
        "global_dow": global_dow,
        "global_month": global_month,
        "global_quarter": global_quarter,
        "genre_dow": genre_dow,
        "genre_month": genre_month,
        "genre_quarter": genre_quarter,
    }


def _event_factor_tables(train: pd.DataFrame, calendar: pd.DataFrame) -> tuple[dict[str, float], dict[str, pd.Series]]:
    event_cols = [col for col in calendar.columns if col.startswith("event_")]
    daily = train.groupby("date", as_index=False)["sales"].sum().merge(calendar, on="date", how="left")
    overall = daily["sales"].mean()
    global_factors = {}
    for col in event_cols:
        active = daily[daily[col].eq(1)]
        if len(active) >= 5 and overall > 0:
            global_factors[col] = float(np.clip(active["sales"].mean() / overall, 0.65, 2.4))

    genre_daily = train.groupby(["genre", "date"], as_index=False)["sales"].sum().merge(
        calendar, on="date", how="left"
    )
    genre_overall = genre_daily.groupby("genre")["sales"].mean()
    genre_factors = {}
    for col in event_cols:
        active = genre_daily[genre_daily[col].eq(1)]
        counts = active.groupby("genre")["sales"].size()
        means = active.groupby("genre")["sales"].mean()
        factors = (means / genre_overall).where(counts >= 5).dropna().clip(0.65, 2.4)
        genre_factors[col] = factors
    return global_factors, genre_factors


def add_model_features(frame: pd.DataFrame, train: pd.DataFrame, calendar: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    out["dow"] = out["date"].dt.dayofweek
    out["month_num"] = out["date"].dt.month
    out["day"] = out["date"].dt.day
    out["weekofyear"] = out["date"].dt.isocalendar().week.astype(int)
    out["quarter"] = out["date"].dt.quarter
    out["is_weekend"] = out["dow"].isin([5, 6]).astype(int)
    out["is_month_start"] = out["date"].dt.is_month_start.astype(int)
    out["is_month_end"] = out["date"].dt.is_month_end.astype(int)

    seasonal_tables = _seasonal_factor_tables(train)
    out = out.merge(seasonal_tables["genre_dow"], on=["genre", "dow"], how="left")
    out = out.merge(seasonal_tables["genre_month"], on=["genre", "month_num"], how="left")
    out = out.merge(seasonal_tables["genre_quarter"], on=["genre", "quarter"], how="left")
    out["genre_dow_factor"] = out["genre_dow_factor"].fillna(
        out["dow"].map(seasonal_tables["global_dow"])
    ).fillna(1.0)
    out["genre_month_factor"] = out["genre_month_factor"].fillna(
        out["month_num"].map(seasonal_tables["global_month"])
    ).fillna(1.0)
    out["genre_quarter_factor"] = out["genre_quarter_factor"].fillna(
        out["quarter"].map(seasonal_tables["global_quarter"])
    ).fillna(1.0)

    out = out.merge(calendar, on="date", how="left")
    global_event_factors, genre_event_factors = _event_factor_tables(train, calendar)
    out["event_multiplier"] = 1.0
    for col in [c for c in calendar.columns if c.startswith("event_")]:
        active = out[col].eq(1)
        if not active.any():
            continue
        factor = out.loc[active, "genre"].map(genre_event_factors.get(col, pd.Series(dtype="float64")))
        factor = factor.fillna(global_event_factors.get(col, 1.0))
        event_weight = 1 + ((out.loc[active, "event_intensity"].fillna(1.0) - 1) * 0.35)
        factor = (1 + ((factor - 1) * event_weight)).clip(0.55, 3.0)
        out.loc[active, "event_multiplier"] = np.maximum(out.loc[active, "event_multiplier"], factor)

    group_mean = train.groupby(["shop", "genre"])["sales"].mean()
    shop_mean = train.groupby("shop")["sales"].mean()
    genre_mean = train.groupby("genre")["sales"].mean()
    global_mean = train["sales"].mean()

    group_index = pd.MultiIndex.from_frame(out[["shop", "genre"]])
    out["fallback"] = group_mean.reindex(group_index).to_numpy()
    out["fallback"] = out["fallback"].fillna(out["shop"].map(shop_mean))
    out["fallback"] = out["fallback"].fillna(out["genre"].map(genre_mean))
    out["fallback"] = out["fallback"].fillna(global_mean)
    out["shop_code"] = pd.to_numeric(out["shop"], errors="coerce").fillna(0)
    out["genre_code"] = pd.to_numeric(out["genre"], errors="coerce").fillna(0)

    history = sum(out[col].fillna(0) * weight for col, weight in LAG_WEIGHTS.items())
    has_history = sum(out[col].fillna(0) for col in LAG_WEIGHTS).gt(0)
    out["previous_performance"] = (
        out["lag_1"].fillna(0) * 0.30
        + out["lag_7"].fillna(0) * 0.30
        + out["lag_28"].fillna(0) * 0.25
        + out["lag_90"].fillna(0) * 0.15
    ).where(has_history, out["fallback"])
    out["base_prediction"] = history.where(has_history, out["fallback"])
    out["seasonal_signal"] = (
        out["genre_dow_factor"]
        * out["genre_month_factor"]
        * out["genre_quarter_factor"]
        * out["event_multiplier"]
        * (1 + (out["major_event_intensity"].fillna(0) * 0.025))
    ).clip(0.55, 2.2)
    out["event_history_signal"] = (
        out["previous_performance"].fillna(out["fallback"])
        * out["event_multiplier"].fillna(1.0)
        * (1 + (out["major_event_intensity"].fillna(0) * 0.08))
    ).clip(lower=0)
    out["recent_activity_signal"] = (
        out["positive_rate_7"].fillna(0) * 0.55
        + out["positive_rate_28"].fillna(0) * 0.30
        + out["positive_rate_90"].fillna(0) * 0.15
    ).clip(0, 1)
    return out


def _boosted_matrix(frame: pd.DataFrame) -> pd.DataFrame:
    return frame.replace([np.inf, -np.inf], np.nan).fillna(0)


def _factor_table(frame: pd.DataFrame, keys: list[str]) -> pd.DataFrame:
    grouped = (
        frame.groupby(keys, dropna=False)
        .agg(log_ratio=("log_ratio", "median"), rows=("log_ratio", "size"))
        .reset_index()
    )
    return grouped[grouped["rows"].ge(MIN_FACTOR_ROWS)].drop(columns=["rows"])


def train_boosted_model(train_features: pd.DataFrame) -> dict[str, object]:
    frame = train_features[train_features["predicted_sales"].gt(0)].copy()
    frame["ratio"] = ((frame["sales"] + 1) / (frame["predicted_sales"] + 1)).clip(0.15, 6.0)
    frame["log_ratio"] = np.log(frame["ratio"])
    frame["event_bucket"] = pd.cut(
        frame["event_intensity"].fillna(0),
        bins=[-0.1, 0.01, 1.2, 1.8, 2.5, 10],
        labels=False,
    ).fillna(0).astype(int)
    frame["performance_bucket"] = pd.qcut(
        frame["previous_performance"].fillna(frame["fallback"]).rank(method="first"),
        q=8,
        labels=False,
        duplicates="drop",
    ).fillna(0).astype(int)

    return {
        "global_log_ratio": float(np.median(frame["log_ratio"])) if len(frame) else 0.0,
        "genre": _factor_table(frame, ["genre"]),
        "shop_genre": _factor_table(frame, ["shop", "genre"]),
        "genre_dow": _factor_table(frame, ["genre", "dow"]),
        "genre_month": _factor_table(frame, ["genre", "month_num"]),
        "genre_event": _factor_table(frame, ["genre", "event_bucket"]),
        "genre_performance": _factor_table(frame, ["genre", "performance_bucket"]),
    }


def _merge_factor(out: pd.DataFrame, table: pd.DataFrame, keys: list[str], name: str) -> pd.DataFrame:
    if table.empty:
        out[name] = 0.0
        return out
    return out.merge(table.rename(columns={"log_ratio": name}), on=keys, how="left")


def apply_boosted_predictions(features: pd.DataFrame, model: dict[str, object]) -> pd.DataFrame:
    out = features.copy()
    out["event_bucket"] = pd.cut(
        out["event_intensity"].fillna(0),
        bins=[-0.1, 0.01, 1.2, 1.8, 2.5, 10],
        labels=False,
    ).fillna(0).astype(int)
    out["performance_bucket"] = pd.qcut(
        out["previous_performance"].fillna(out["fallback"]).rank(method="first"),
        q=8,
        labels=False,
        duplicates="drop",
    ).fillna(0).astype(int)

    factor_specs = [
        ("shop_genre", ["shop", "genre"], 0.34),
        ("genre", ["genre"], 0.18),
        ("genre_dow", ["genre", "dow"], 0.12),
        ("genre_month", ["genre", "month_num"], 0.12),
        ("genre_event", ["genre", "event_bucket"], 0.13),
        ("genre_performance", ["genre", "performance_bucket"], 0.11),
    ]
    correction = pd.Series(float(model.get("global_log_ratio", 0.0)) * 0.25, index=out.index)
    for table_name, keys, weight in factor_specs:
        column = f"{table_name}_log_factor"
        out = _merge_factor(out, model.get(table_name, pd.DataFrame()), keys, column)
        correction += out[column].fillna(0.0) * weight

    baseline = out["predicted_sales"].to_numpy(dtype=float)
    out["predicted_sales"] = (baseline * np.exp(correction.clip(-0.75, 0.75))).clip(lower=0)
    return out


def base_prediction_for_profile(frame: pd.DataFrame, weights: dict[str, float]) -> pd.Series:
    history = sum(frame[col].fillna(0) * weight for col, weight in weights.items())
    has_history = sum(frame[col].fillna(0) for col in weights).gt(0)
    return history.where(has_history, frame["fallback"])


def hidden_holdout_split(data: pd.DataFrame, seed: int = HIDDEN_HOLDOUT_SEED) -> tuple[pd.DataFrame, pd.DataFrame]:
    rng = np.random.default_rng(seed)
    hidden_mask = rng.random(len(data)) < HIDDEN_HOLDOUT_RATE
    if hidden_mask.sum() == 0:
        hidden_mask[rng.integers(0, len(data))] = True
    return data.loc[~hidden_mask].copy(), data.loc[hidden_mask].copy()


def tune_genre_params(
    data: pd.DataFrame,
    calendar: pd.DataFrame,
    train: pd.DataFrame | None = None,
    valid: pd.DataFrame | None = None,
) -> pd.DataFrame:
    if train is None or valid is None:
        train = data[data["date"] < VALID_START].copy()
        valid = data[(data["date"] >= VALID_START) & (data["date"] < HOLDOUT_START)].copy()
    valid = add_model_features(valid, train, calendar)

    rows = []
    for genre, frame in valid.groupby("genre", sort=False):
        actual_total = frame["sales"].sum()
        if len(frame) < 60 or actual_total <= 0:
            rows.append({
                "genre": genre,
                "lag_profile": DEFAULT_LAG_PROFILE,
                **{f"{col}_weight": weight for col, weight in LAG_WEIGHT_PROFILES[DEFAULT_LAG_PROFILE].items()},
                "seasonal_weight": DEFAULT_SEASONAL_WEIGHT,
                "prediction_scale": DEFAULT_PREDICTION_SCALE,
                "validation_wape": np.nan,
            })
            continue

        best = None
        for lag_profile, lag_weights in LAG_WEIGHT_PROFILES.items():
            base_prediction = base_prediction_for_profile(frame, lag_weights)
            for seasonal_weight in SEASONAL_WEIGHT_GRID:
                raw = (
                    base_prediction
                    * (1 - seasonal_weight + seasonal_weight * frame["seasonal_signal"])
                ).clip(lower=0)
                if raw.sum() <= 0:
                    continue
                total_scale = float(np.clip(actual_total / raw.sum(), 0.55, 1.60))
                for scale_multiplier in SCALE_MULTIPLIER_GRID:
                    scale = float(np.clip(total_scale * scale_multiplier, 0.55, 1.60))
                    pred = raw * scale
                    wape = (frame["sales"] - pred).abs().sum() / actual_total
                    total_bias = abs(float(pred.sum()) - actual_total) / actual_total
                    candidate = {
                        "wape": wape,
                        "score": wape + (0.35 * total_bias),
                        "seasonal_weight": seasonal_weight,
                        "scale": scale,
                        "lag_profile": lag_profile,
                        "lag_weights": lag_weights,
                    }
                    if best is None or candidate["score"] < best["score"]:
                        best = candidate

        if best is None:
            rows.append({
                "genre": genre,
                "lag_profile": DEFAULT_LAG_PROFILE,
                **{f"{col}_weight": weight for col, weight in LAG_WEIGHT_PROFILES[DEFAULT_LAG_PROFILE].items()},
                "seasonal_weight": DEFAULT_SEASONAL_WEIGHT,
                "prediction_scale": DEFAULT_PREDICTION_SCALE,
                "validation_wape": np.nan,
            })
            continue

        rows.append({
            "genre": genre,
            "lag_profile": best["lag_profile"],
            **{f"{col}_weight": weight for col, weight in best["lag_weights"].items()},
            "seasonal_weight": best["seasonal_weight"],
            "prediction_scale": best["scale"],
            "validation_wape": best["wape"],
        })
    return pd.DataFrame(rows)


def apply_predictions(features: pd.DataFrame, params: pd.DataFrame) -> pd.DataFrame:
    param_cols = [
        "genre",
        "lag_7_weight",
        "lag_28_weight",
        "lag_90_weight",
        "seasonal_weight",
        "prediction_scale",
    ]
    out = features.merge(params[param_cols], on="genre", how="left")
    for col, weight in LAG_WEIGHT_PROFILES[DEFAULT_LAG_PROFILE].items():
        out[f"{col}_weight"] = out[f"{col}_weight"].fillna(weight)
    out["seasonal_weight"] = out["seasonal_weight"].fillna(DEFAULT_SEASONAL_WEIGHT)
    out["prediction_scale"] = out["prediction_scale"].fillna(DEFAULT_PREDICTION_SCALE)
    out["genre_base_prediction"] = (
        out["lag_7"].fillna(0) * out["lag_7_weight"]
        + out["lag_28"].fillna(0) * out["lag_28_weight"]
        + out["lag_90"].fillna(0) * out["lag_90_weight"]
    )
    has_history = out[["lag_7", "lag_28", "lag_90"]].fillna(0).sum(axis=1).gt(0)
    out["genre_base_prediction"] = out["genre_base_prediction"].where(has_history, out["fallback"])
    out["predicted_sales"] = (
        out["genre_base_prediction"]
        * (1 - out["seasonal_weight"] + out["seasonal_weight"] * out["seasonal_signal"])
        * out["prediction_scale"]
    ).clip(lower=0)
    return out


def evaluate_predictions(frame: pd.DataFrame) -> dict[str, float]:
    actual = frame["sales"]
    pred = frame["predicted_sales"]
    absolute_error = (actual - pred).abs()
    nonzero = actual.gt(0)
    ape = absolute_error[nonzero] / actual[nonzero]
    return {
        "rows": float(len(frame)),
        "actual_sales": float(actual.sum()),
        "predicted_sales": float(pred.sum()),
        "wape": float(absolute_error.sum() / actual.sum()) if actual.sum() else float("nan"),
        "median_ape": float(ape.median()) if len(ape) else float("nan"),
        "within_25pct": float(ape.le(0.25).mean()) if len(ape) else float("nan"),
    }
