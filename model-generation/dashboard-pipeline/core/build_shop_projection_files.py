from __future__ import annotations

import gc
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor

from shop_projection_model import (
    HIDDEN_HOLDOUT_RATE,
    HIDDEN_HOLDOUT_SEED,
    HOLDOUT_START,
    VALID_START,
    active_events,
    add_history_features,
    add_model_features,
    apply_boosted_predictions,
    apply_predictions,
    evaluate_predictions,
    hidden_holdout_split,
    load_sales,
    train_boosted_model,
    tune_genre_params,
)
from pipeline_paths import DASHBOARD_ROOT


ROOT = DASHBOARD_ROOT
DATA_DIR = ROOT / "data" / "by-month"
EVENTS_FILE = ROOT / "data" / "events.csv"
GENRE_NAMES_FILE = ROOT / "data" / "genre_names.csv"
MONTHLY_OUTPUT_DIR = ROOT / "data" / "shop-estimates-by-month"
TREND_OUTPUT_DIR = ROOT / "data" / "trend-estimates-by-month"
ALL_TIME_OUTPUT = ROOT / "data" / "all-time" / "shop_estimates_monthly.csv"
ALL_TIME_TREND_OUTPUT = ROOT / "data" / "all-time" / "trend_estimates_monthly.csv"
GENRE_PARAMS_OUTPUT = ROOT / "data" / "shop_projection_genre_params.csv"
METRICS_OUTPUT = ROOT / "data" / "shop_projection_metrics.csv"
PAGE_VIEW_PARAMS_OUTPUT = ROOT / "data" / "shop_projection_page_view_params.csv"
PAGE_VIEW_METRICS_OUTPUT = ROOT / "data" / "shop_projection_page_view_metrics.csv"
UNITS_PARAMS_OUTPUT = ROOT / "data" / "shop_projection_units_params.csv"
UNITS_METRICS_OUTPUT = ROOT / "data" / "shop_projection_units_metrics.csv"
MIN_AVERAGE_UNIT_PRICE = 100
MAX_AVERAGE_UNIT_PRICE = 1_000_000
STORE_CORRECTION_SAMPLE_ROWS = 900_000
ACTIVITY_GATE_SAMPLE_ROWS = 900_000
GROUP_CORRECTION_SAMPLE_ROWS = 55_000
MIN_GROUP_CORRECTION_ROWS = 20_000
MAX_GROUP_CORRECTION_MODELS = 10
PAIR_CORRECTION_SAMPLE_ROWS = 35_000
MIN_PAIR_CORRECTION_ROWS = 6_000
MAX_PAIR_CORRECTION_MODELS = 24
BLEND_WEIGHT_GRID = [0.0, 0.15, 0.30, 0.50, 0.70, 0.85, 1.0]
STORE_CORRECTION_FEATURES = [
    "shop_code",
    "genre_code",
    "dow",
    "month_num",
    "day",
    "weekofyear",
    "quarter",
    "is_weekend",
    "is_month_start",
    "is_month_end",
    "event_intensity",
    "major_event_intensity",
    "event_count",
    "event_day_share",
    "event_multiplier",
    "genre_dow_factor",
    "genre_month_factor",
    "genre_quarter_factor",
    "lag_1",
    "lag_7",
    "lag_14",
    "lag_28",
    "lag_56",
    "lag_90",
    "positive_rate_7",
    "positive_rate_28",
    "positive_rate_90",
    "recent_max_7",
    "recent_max_28",
    "recent_std_28",
    "previous_performance",
    "fallback",
    "base_prediction",
    "seasonal_signal",
    "event_history_signal",
    "recent_activity_signal",
    "baseline_predicted_sales",
    "shop_total_mean",
    "shop_genre_total_mean",
    "genre_total_mean",
    "shop_genre_rows",
    "shop_rows",
    "shop_group_code",
    "genre_group_code",
    "shop_group_mean",
    "recent_trend_7_28",
    "recent_trend_14_56",
    "history_strength",
]

GENRE_GROUP_KEYWORDS = [
    ("food_seafood", ["サーモン", "鮭", "ホタテ", "イクラ", "seafood", "salmon", "scallop", "roe"]),
    ("food_grains", ["白米", "米", "rice"]),
    ("food_beverages", ["日本茶", "植物茶", "tea"]),
    ("food_prepared", ["おせち", "詰め合わせ", "セット・詰め合わせ", "osechi", "assortment"]),
    ("alcohol", ["ワイン", "シャンパン", "ウイスキー", "whisky", "whiskey", "wine", "champagne"]),
    ("electronics", ["ノートpc", "スマートフォン", "カメラ", "レンズ", "家電", "本体", "laptop", "smartphone", "camera", "lens", "appliance", "main units"]),
    ("office_supplies", ["インク", "会議用", "チェア", "デスク", "ink", "conference", "chair", "office"]),
    ("beauty_health", ["美容", "健康", "石けん", "ボディソープ", "ビタミン", "プロバイオティクス", "シャンプー", "トリートメント", "ファンデーション", "クレンジング", "ランジェリー", "beauty", "health", "soap", "vitamin", "probiotic", "shampoo", "conditioner", "foundation", "cleansing", "lingerie"]),
    ("home_furniture", ["テーブル", "カーテン", "クッション", "ハンガー", "マット", "寝具", "収納", "こたつ", "ソファ", "タンス", "table", "curtain", "cushion", "hanger", "mat", "bedding", "storage", "kotatsu", "sofa", "dresser"]),
    ("apparel_accessories", ["コート", "ジャケット", "指輪", "リング", "エプロン", "wedge", "rings", "aprons", "coats", "jackets"]),
    ("baby_kids", ["ベビー", "キッズ", "ジュニア", "baby", "kids", "junior"]),
    ("travel_gifts", ["旅行券", "ホテル券", "航空券", "カタログギフト", "チケット", "travel", "hotel", "airline", "voucher", "gift", "ticket"]),
    ("sports_outdoor", ["ゴルフ", "ウェッジ", "フォームローラー", "自転車", "距離計", "golf", "wedge", "foam roller", "bicycle", "rangefinder"]),
    ("pets", ["牧草", "ペット", "ドッグフード", "キャットフード", "hay", "pet", "dog food", "cat food"]),
    ("daily_goods", ["ティッシュ", "掃除機", "クリーナー", "消臭", "ガム", "マグカップ", "tissue", "vacuum", "cleaner", "deodorant", "gum", "mug"]),
]


def active_prediction_frame(data: pd.DataFrame) -> pd.DataFrame:
    actual = data[["date", "shop", "genre", "sales"]].copy()
    spans = actual.groupby(["shop", "genre"], as_index=False)["date"].agg(["min", "max"]).reset_index()
    frames = []
    for row in spans.itertuples(index=False):
        frames.append(pd.DataFrame({
            "date": pd.date_range(row.min, row.max, freq="D"),
            "shop": row.shop,
            "genre": row.genre,
        }))
    grid = pd.concat(frames, ignore_index=True)
    grid = grid.merge(actual, on=["date", "shop", "genre"], how="left")
    return add_history_features(grid)


def classify_genre_label(label: str) -> str:
    normalized = str(label or "").lower()
    for group, keywords in GENRE_GROUP_KEYWORDS:
        if any(keyword.lower() in normalized for keyword in keywords):
            return group
    return "other"


def load_genre_groups() -> dict[str, str]:
    names = pd.read_csv(GENRE_NAMES_FILE, dtype={"genre_id": "string"})
    label_col = "label" if "label" in names.columns else "genre_name"
    names["genre_group"] = names[label_col].map(classify_genre_label)
    return dict(zip(names["genre_id"].astype(str), names["genre_group"]))


def shop_group_tables(train: pd.DataFrame) -> tuple[dict[str, str], dict[str, str], dict[str, int], pd.Series]:
    genre_groups = load_genre_groups()
    frame = train.copy()
    frame["genre_group"] = frame["genre"].map(genre_groups).fillna("other")
    grouped = frame.groupby(["shop", "genre_group"], as_index=False)["sales"].sum()
    top = grouped.sort_values(["shop", "sales"], ascending=[True, False]).drop_duplicates("shop")
    shop_groups = dict(zip(top["shop"].astype(str), top["genre_group"].astype(str)))
    all_groups = sorted(set(genre_groups.values()) | set(shop_groups.values()) | {"other"})
    group_codes = {group: index for index, group in enumerate(all_groups)}
    shop_group_mean = frame.groupby("genre_group")["sales"].mean()
    return shop_groups, genre_groups, group_codes, shop_group_mean


def add_prediction_interval(
    estimates: pd.DataFrame,
    validation_estimates: pd.DataFrame,
    prediction_column: str,
) -> pd.DataFrame:
    scored = validation_estimates[validation_estimates["predicted_sales"].gt(0)].copy()
    genre_totals = scored.groupby("genre", as_index=False)[["sales", "predicted_sales"]].sum()
    genre_totals["ratio"] = ((genre_totals["sales"] + 1) / (genre_totals["predicted_sales"] + 1)).clip(0.1, 10.0)
    global_low = min(1.0, float(genre_totals["ratio"].quantile(0.025)))
    global_high = max(1.0, float(genre_totals["ratio"].quantile(0.975)))
    genre_quantiles = genre_totals[["genre", "ratio"]].copy()
    genre_quantiles["low_factor"] = (
        (genre_quantiles["ratio"].clip(upper=1.0) * 0.65) + (global_low * 0.35)
    ).clip(lower=max(0.1, global_low * 0.88), upper=1.0)
    genre_quantiles["high_factor"] = (
        (genre_quantiles["ratio"].clip(lower=1.0) * 0.65) + (global_high * 0.35)
    ).clip(lower=1.0, upper=global_high)
    genre_quantiles = genre_quantiles.drop(columns=["ratio"])

    out = estimates.merge(genre_quantiles, on="genre", how="left")
    out["low_factor"] = out["low_factor"].fillna(global_low).clip(0.1, 1.0)
    out["high_factor"] = out["high_factor"].fillna(global_high).clip(1.0, global_high)
    raw_low = out[prediction_column] * out["low_factor"]
    raw_high = out[prediction_column] * out["high_factor"]
    half_width = ((raw_high - raw_low).clip(lower=0) / 2).fillna(0)
    out[f"{prediction_column}_low"] = (out[prediction_column] - half_width).clip(lower=0).round(0).astype("int64")
    out[f"{prediction_column}_high"] = (out[prediction_column] + half_width).round(0).astype("int64")
    return out.drop(columns=["low_factor", "high_factor"])


def build_store_feature_tables(train: pd.DataFrame) -> dict[str, object]:
    shop_genre_stats = train.groupby(["shop", "genre"])["sales"].agg(["mean", "size"]).rename(
        columns={"mean": "shop_genre_total_mean", "size": "shop_genre_rows"}
    )
    shop_stats = train.groupby("shop")["sales"].agg(["mean", "size"]).rename(
        columns={"mean": "shop_total_mean", "size": "shop_rows"}
    )
    genre_mean = train.groupby("genre")["sales"].mean().rename("genre_total_mean")
    group_tables = shop_group_tables(train)
    return {
        "shop_genre_stats": shop_genre_stats,
        "shop_stats": shop_stats,
        "genre_mean": genre_mean,
        "group_tables": group_tables,
    }


def add_store_features(frame: pd.DataFrame, train: pd.DataFrame | None = None, tables: dict[str, object] | None = None) -> pd.DataFrame:
    out = frame.copy()
    if tables is None:
        if train is None:
            raise ValueError("train or tables is required")
        tables = build_store_feature_tables(train)
    shop_genre_stats = tables["shop_genre_stats"]
    shop_stats = tables["shop_stats"]
    genre_mean = tables["genre_mean"]
    shop_groups, genre_groups, group_codes, shop_group_mean = tables["group_tables"]

    pair_index = pd.MultiIndex.from_frame(out[["shop", "genre"]])
    out["shop_genre_total_mean"] = shop_genre_stats["shop_genre_total_mean"].reindex(pair_index).to_numpy()
    out["shop_genre_rows"] = shop_genre_stats["shop_genre_rows"].reindex(pair_index).to_numpy()
    out["shop_total_mean"] = out["shop"].map(shop_stats["shop_total_mean"])
    out["shop_rows"] = out["shop"].map(shop_stats["shop_rows"])
    out["genre_total_mean"] = out["genre"].map(genre_mean)
    out["shop_group"] = out["shop"].map(shop_groups).fillna("other")
    out["genre_group"] = out["genre"].map(genre_groups).fillna("other")
    out["shop_group_code"] = out["shop_group"].map(group_codes).fillna(group_codes.get("other", 0))
    out["genre_group_code"] = out["genre_group"].map(group_codes).fillna(group_codes.get("other", 0))
    out["shop_group_mean"] = out["shop_group"].map(shop_group_mean)
    out["recent_trend_7_28"] = ((out["lag_7"].fillna(0) + 1) / (out["lag_28"].fillna(0) + 1)).clip(0.05, 20.0)
    out["recent_trend_14_56"] = ((out["lag_14"].fillna(0) + 1) / (out["lag_56"].fillna(0) + 1)).clip(0.05, 20.0)
    out["history_strength"] = out[["lag_1", "lag_7", "lag_14", "lag_28", "lag_56", "lag_90"]].fillna(0).gt(0).sum(axis=1)
    return out


def store_matrix(frame: pd.DataFrame) -> pd.DataFrame:
    return frame[STORE_CORRECTION_FEATURES].replace([np.inf, -np.inf], np.nan).fillna(0)


def minimal_prediction_frame(frame: pd.DataFrame) -> pd.DataFrame:
    keep = [col for col in ["date", "shop", "genre", "sales", "predicted_sales"] if col in frame.columns]
    return frame[keep].copy()


def _fit_direct_store_model(frame: pd.DataFrame, seed: int) -> HistGradientBoostingRegressor:
    model = HistGradientBoostingRegressor(
        loss="squared_error",
        learning_rate=0.055,
        max_iter=120,
        max_leaf_nodes=31,
        min_samples_leaf=80,
        l2_regularization=0.06,
        random_state=seed,
        early_stopping=True,
        validation_fraction=0.08,
        n_iter_no_change=15,
    )
    model.fit(store_matrix(frame), np.log1p(frame["sales"].to_numpy(dtype=float)))
    return model


def train_direct_store_model(train_estimates: pd.DataFrame, train: pd.DataFrame) -> dict[str, object]:
    tables = build_store_feature_tables(train)
    frame = add_store_features(train_estimates, tables=tables)
    if len(frame) > STORE_CORRECTION_SAMPLE_ROWS:
        frame = frame.sample(STORE_CORRECTION_SAMPLE_ROWS, random_state=HIDDEN_HOLDOUT_SEED)
    return {
        "tables": tables,
        "model": _fit_direct_store_model(frame, HIDDEN_HOLDOUT_SEED),
    }


def train_activity_gate_model(train_estimates: pd.DataFrame, train: pd.DataFrame) -> dict[str, object] | None:
    tables = build_store_feature_tables(train)
    frame = add_store_features(train_estimates, tables=tables)
    if len(frame) > ACTIVITY_GATE_SAMPLE_ROWS:
        frame = frame.sample(ACTIVITY_GATE_SAMPLE_ROWS, random_state=HIDDEN_HOLDOUT_SEED + 303)
    target = frame["sales"].gt(0).astype(int)
    if target.nunique() < 2:
        return None
    model = HistGradientBoostingClassifier(
        learning_rate=0.045,
        max_iter=120,
        max_leaf_nodes=31,
        min_samples_leaf=90,
        l2_regularization=0.06,
        random_state=HIDDEN_HOLDOUT_SEED + 303,
        early_stopping=True,
        validation_fraction=0.08,
        n_iter_no_change=15,
    )
    model.fit(store_matrix(frame), target.to_numpy())
    return {
        "tables": tables,
        "model": model,
        "positive_rate": float(target.mean()),
    }


def train_store_correction_model(train_estimates: pd.DataFrame, train: pd.DataFrame) -> HistGradientBoostingRegressor:
    tables = build_store_feature_tables(train)
    frame = train_estimates[train_estimates["baseline_predicted_sales"].gt(0)].copy()
    if len(frame) > STORE_CORRECTION_SAMPLE_ROWS:
        frame = frame.sample(STORE_CORRECTION_SAMPLE_ROWS, random_state=HIDDEN_HOLDOUT_SEED)
    frame = add_store_features(frame, tables=tables)
    target = np.log(
        ((frame["sales"].to_numpy(dtype=float) + 1)
         / (frame["baseline_predicted_sales"].to_numpy(dtype=float) + 1)).clip(0.1, 10.0)
    )
    model = HistGradientBoostingRegressor(
        loss="squared_error",
        learning_rate=0.045,
        max_iter=150,
        max_leaf_nodes=31,
        min_samples_leaf=90,
        l2_regularization=0.08,
        random_state=HIDDEN_HOLDOUT_SEED + 17,
        early_stopping=True,
        validation_fraction=0.08,
        n_iter_no_change=15,
    )
    model.fit(store_matrix(frame), target)
    return model


def train_grouped_store_correction_model(train_estimates: pd.DataFrame, train: pd.DataFrame) -> dict[str, object]:
    tables = build_store_feature_tables(train)
    frame = train_estimates[train_estimates["baseline_predicted_sales"].gt(0)].copy()
    frame = add_store_features(frame, tables=tables)

    fallback_frame = frame
    if len(fallback_frame) > STORE_CORRECTION_SAMPLE_ROWS:
        fallback_frame = fallback_frame.sample(STORE_CORRECTION_SAMPLE_ROWS, random_state=HIDDEN_HOLDOUT_SEED + 101)
    fallback_model = _fit_store_correction_frame(fallback_frame, HIDDEN_HOLDOUT_SEED + 101)

    group_models = {}
    group_scales = {}
    group_items = [
        (shop_group, group_frame)
        for shop_group, group_frame in frame.groupby("shop_group", sort=True)
        if len(group_frame) >= MIN_GROUP_CORRECTION_ROWS
    ]
    group_items = sorted(group_items, key=lambda item: len(item[1]), reverse=True)[:MAX_GROUP_CORRECTION_MODELS]
    for index, (shop_group, group_frame) in enumerate(group_items, start=1):
        fit_frame = group_frame
        if len(fit_frame) > GROUP_CORRECTION_SAMPLE_ROWS:
            fit_frame = fit_frame.sample(GROUP_CORRECTION_SAMPLE_ROWS, random_state=HIDDEN_HOLDOUT_SEED + index)
        rng = np.random.default_rng(HIDDEN_HOLDOUT_SEED + 500 + index)
        calibration_mask = rng.random(len(fit_frame)) < 0.14
        calibration_frame = fit_frame.loc[calibration_mask].copy()
        fit_only = fit_frame.loc[~calibration_mask].copy()
        if len(fit_only) < MIN_GROUP_CORRECTION_ROWS // 2 or calibration_frame.empty:
            fit_only = fit_frame
            calibration_frame = fit_frame
        model = _fit_store_correction_frame(fit_only, HIDDEN_HOLDOUT_SEED + 200 + index)
        calibration_pred = (
            calibration_frame["baseline_predicted_sales"].to_numpy(dtype=float)
            * np.exp(model.predict(store_matrix(calibration_frame)).clip(-0.9, 0.9))
        ).clip(min=0)
        scale = 1.0
        if calibration_pred.sum() > 0:
            scale = float(np.clip(calibration_frame["sales"].sum() / calibration_pred.sum(), 0.70, 1.45))
        group_models[shop_group] = model
        group_scales[shop_group] = scale

    return {
        "tables": tables,
        "fallback_model": fallback_model,
        "group_models": group_models,
        "group_scales": group_scales,
    }


def train_pair_store_correction_model(train_estimates: pd.DataFrame, train: pd.DataFrame) -> dict[str, object]:
    tables = build_store_feature_tables(train)
    frame = train_estimates[train_estimates["baseline_predicted_sales"].gt(0)].copy()
    frame = add_store_features(frame, tables=tables)

    fallback_frame = frame
    if len(fallback_frame) > STORE_CORRECTION_SAMPLE_ROWS:
        fallback_frame = fallback_frame.sample(STORE_CORRECTION_SAMPLE_ROWS, random_state=HIDDEN_HOLDOUT_SEED + 701)
    fallback_model = _fit_store_correction_frame(fallback_frame, HIDDEN_HOLDOUT_SEED + 701)

    pair_models = {}
    pair_scales = {}
    pair_items = [
        ((shop_group, genre_group), pair_frame)
        for (shop_group, genre_group), pair_frame in frame.groupby(["shop_group", "genre_group"], sort=True)
        if len(pair_frame) >= MIN_PAIR_CORRECTION_ROWS
    ]
    pair_items = sorted(pair_items, key=lambda item: len(item[1]), reverse=True)[:MAX_PAIR_CORRECTION_MODELS]
    for index, ((shop_group, genre_group), pair_frame) in enumerate(pair_items, start=1):
        fit_frame = pair_frame
        if len(fit_frame) > PAIR_CORRECTION_SAMPLE_ROWS:
            fit_frame = fit_frame.sample(PAIR_CORRECTION_SAMPLE_ROWS, random_state=HIDDEN_HOLDOUT_SEED + 900 + index)
        rng = np.random.default_rng(HIDDEN_HOLDOUT_SEED + 1000 + index)
        calibration_mask = rng.random(len(fit_frame)) < 0.14
        calibration_frame = fit_frame.loc[calibration_mask].copy()
        fit_only = fit_frame.loc[~calibration_mask].copy()
        if len(fit_only) < MIN_PAIR_CORRECTION_ROWS // 2 or calibration_frame.empty:
            fit_only = fit_frame
            calibration_frame = fit_frame
        model = _fit_store_correction_frame(fit_only, HIDDEN_HOLDOUT_SEED + 1100 + index)
        calibration_pred = (
            calibration_frame["baseline_predicted_sales"].to_numpy(dtype=float)
            * np.exp(model.predict(store_matrix(calibration_frame)).clip(-0.9, 0.9))
        ).clip(min=0)
        scale = 1.0
        if calibration_pred.sum() > 0:
            scale = float(np.clip(calibration_frame["sales"].sum() / calibration_pred.sum(), 0.70, 1.45))
        key = (shop_group, genre_group)
        pair_models[key] = model
        pair_scales[key] = scale

    return {
        "tables": tables,
        "fallback_model": fallback_model,
        "pair_models": pair_models,
        "pair_scales": pair_scales,
    }


def _fit_store_correction_frame(frame: pd.DataFrame, seed: int) -> HistGradientBoostingRegressor:
    target = np.log(
        ((frame["sales"].to_numpy(dtype=float) + 1)
         / (frame["baseline_predicted_sales"].to_numpy(dtype=float) + 1)).clip(0.1, 10.0)
    )
    model = HistGradientBoostingRegressor(
        loss="squared_error",
        learning_rate=0.06,
        max_iter=70,
        max_leaf_nodes=31,
        min_samples_leaf=110,
        l2_regularization=0.08,
        random_state=seed,
        early_stopping=True,
        validation_fraction=0.08,
        n_iter_no_change=15,
    )
    model.fit(store_matrix(frame), target)
    return model


def apply_store_correction(
    estimates: pd.DataFrame,
    model: HistGradientBoostingRegressor,
    tables: dict[str, object],
) -> pd.DataFrame:
    out = estimates.rename(columns={"predicted_sales": "baseline_predicted_sales"}).copy()
    out = add_store_features(out, tables=tables)
    correction = model.predict(store_matrix(out)).clip(-0.9, 0.9)
    out["predicted_sales"] = (
        out["baseline_predicted_sales"].to_numpy(dtype=float)
        * np.exp(correction)
    ).clip(min=0)
    return out.drop(columns=["baseline_predicted_sales"])


def apply_direct_store_model(
    estimates: pd.DataFrame,
    model_bundle: dict[str, object],
) -> pd.DataFrame:
    out = estimates.copy()
    if "baseline_predicted_sales" not in out.columns:
        out["baseline_predicted_sales"] = out["predicted_sales"]
    out = add_store_features(out, tables=model_bundle["tables"])
    out["predicted_sales"] = np.expm1(model_bundle["model"].predict(store_matrix(out))).clip(min=0)
    return minimal_prediction_frame(out)


def apply_activity_gate(
    estimates: pd.DataFrame,
    gate_bundle: dict[str, object],
    strength: float = 0.45,
    feature_frame: pd.DataFrame | None = None,
) -> pd.DataFrame:
    out = estimates.copy()
    if feature_frame is not None:
        for column in STORE_CORRECTION_FEATURES:
            if column not in out.columns and column in feature_frame.columns:
                out[column] = feature_frame[column].to_numpy()
    if "baseline_predicted_sales" not in out.columns:
        out["baseline_predicted_sales"] = out["predicted_sales"]
    out = add_store_features(out, tables=gate_bundle["tables"])
    probability = gate_bundle["model"].predict_proba(store_matrix(out))[:, 1]
    positive_rate = max(float(gate_bundle.get("positive_rate", 0.2)), 0.01)
    gate = np.power(np.clip(probability / positive_rate, 0.05, 1.35), strength)
    out["predicted_sales"] = (
        out["predicted_sales"].to_numpy(dtype=float)
        * gate
    ).clip(min=0)
    return minimal_prediction_frame(out)


def apply_grouped_store_correction(
    estimates: pd.DataFrame,
    model_bundle: dict[str, object],
) -> pd.DataFrame:
    out = estimates.rename(columns={"predicted_sales": "baseline_predicted_sales"}).copy()
    out = add_store_features(out, tables=model_bundle["tables"])
    predictions = pd.Series(index=out.index, dtype="float64")
    for shop_group, model in model_bundle["group_models"].items():
        mask = out["shop_group"].eq(shop_group)
        if not mask.any():
            continue
        correction = model.predict(store_matrix(out.loc[mask])).clip(-0.9, 0.9)
        scale = model_bundle["group_scales"].get(shop_group, 1.0)
        predictions.loc[mask] = (
            out.loc[mask, "baseline_predicted_sales"].to_numpy(dtype=float)
            * np.exp(correction)
            * scale
        ).clip(min=0)

    missing = predictions.isna()
    if missing.any():
        fallback = model_bundle["fallback_model"]
        correction = fallback.predict(store_matrix(out.loc[missing])).clip(-0.9, 0.9)
        predictions.loc[missing] = (
            out.loc[missing, "baseline_predicted_sales"].to_numpy(dtype=float)
            * np.exp(correction)
        ).clip(min=0)

    out["predicted_sales"] = predictions.to_numpy(dtype=float)
    return minimal_prediction_frame(out)


def apply_pair_store_correction(
    estimates: pd.DataFrame,
    model_bundle: dict[str, object],
) -> pd.DataFrame:
    out = estimates.rename(columns={"predicted_sales": "baseline_predicted_sales"}).copy()
    out = add_store_features(out, tables=model_bundle["tables"])
    predictions = pd.Series(index=out.index, dtype="float64")
    for (shop_group, genre_group), model in model_bundle["pair_models"].items():
        mask = out["shop_group"].eq(shop_group) & out["genre_group"].eq(genre_group)
        if not mask.any():
            continue
        correction = model.predict(store_matrix(out.loc[mask])).clip(-0.9, 0.9)
        scale = model_bundle["pair_scales"].get((shop_group, genre_group), 1.0)
        predictions.loc[mask] = (
            out.loc[mask, "baseline_predicted_sales"].to_numpy(dtype=float)
            * np.exp(correction)
            * scale
        ).clip(min=0)

    missing = predictions.isna()
    if missing.any():
        fallback = model_bundle["fallback_model"]
        correction = fallback.predict(store_matrix(out.loc[missing])).clip(-0.9, 0.9)
        predictions.loc[missing] = (
            out.loc[missing, "baseline_predicted_sales"].to_numpy(dtype=float)
            * np.exp(correction)
        ).clip(min=0)

    out["predicted_sales"] = predictions.to_numpy(dtype=float)
    return minimal_prediction_frame(out)


def apply_store_correction_chunked(
    estimates: pd.DataFrame,
    train: pd.DataFrame,
    model: HistGradientBoostingRegressor,
    chunk_size: int = 350_000,
) -> pd.DataFrame:
    tables = build_store_feature_tables(train)
    chunks = []
    for start in range(0, len(estimates), chunk_size):
        chunk = estimates.iloc[start:start + chunk_size].copy()
        chunks.append(apply_store_correction(chunk, model, tables))
        del chunk
        gc.collect()
    return pd.concat(chunks, ignore_index=True)


def apply_direct_store_model_chunked(
    estimates: pd.DataFrame,
    model_bundle: dict[str, object],
    chunk_size: int = 350_000,
) -> pd.DataFrame:
    chunks = []
    for start in range(0, len(estimates), chunk_size):
        chunk = estimates.iloc[start:start + chunk_size].copy()
        chunks.append(apply_direct_store_model(chunk, model_bundle))
        del chunk
        gc.collect()
    return pd.concat(chunks, ignore_index=True)


def apply_grouped_store_correction_chunked(
    estimates: pd.DataFrame,
    model_bundle: dict[str, object],
    chunk_size: int = 350_000,
) -> pd.DataFrame:
    chunks = []
    for start in range(0, len(estimates), chunk_size):
        chunk = estimates.iloc[start:start + chunk_size].copy()
        chunks.append(apply_grouped_store_correction(chunk, model_bundle))
        del chunk
        gc.collect()
    return pd.concat(chunks, ignore_index=True)


def apply_pair_store_correction_chunked(
    estimates: pd.DataFrame,
    model_bundle: dict[str, object],
    chunk_size: int = 350_000,
) -> pd.DataFrame:
    chunks = []
    for start in range(0, len(estimates), chunk_size):
        chunk = estimates.iloc[start:start + chunk_size].copy()
        chunks.append(apply_pair_store_correction(chunk, model_bundle))
        del chunk
        gc.collect()
    return pd.concat(chunks, ignore_index=True)


def blend_estimate_frames(first: pd.DataFrame, second: pd.DataFrame, first_weight: float) -> pd.DataFrame:
    out = minimal_prediction_frame(first)
    out["predicted_sales"] = (
        first["predicted_sales"].to_numpy(dtype=float) * first_weight
        + second["predicted_sales"].to_numpy(dtype=float) * (1 - first_weight)
    ).clip(min=0)
    return out


def apply_named_model_to_chunk(
    name: str,
    chunk: pd.DataFrame,
    boosted_model: dict[str, object],
    direct_store_model: dict[str, object] | None,
    grouped_correction_model: dict[str, object] | None,
    pair_correction_model: dict[str, object] | None,
    activity_gate_model: dict[str, object] | None,
) -> pd.DataFrame:
    if name == "lag_event_baseline":
        return chunk.copy()
    if name == "trained_factor_correction":
        return apply_boosted_predictions(chunk.copy(), boosted_model)
    if name == "direct_store_gbt" and direct_store_model is not None:
        return apply_direct_store_model(chunk.copy(), direct_store_model)
    if name == "shop_group_correction_gbt" and grouped_correction_model is not None:
        return apply_grouped_store_correction(chunk.copy(), grouped_correction_model)
    if name == "shop_genre_group_correction_gbt" and pair_correction_model is not None:
        return apply_pair_store_correction(chunk.copy(), pair_correction_model)
    if name == "activity_gated_shop_genre_gbt" and pair_correction_model is not None and activity_gate_model is not None:
        pair = apply_pair_store_correction(chunk.copy(), pair_correction_model)
        return apply_activity_gate(
            pair,
            activity_gate_model,
            feature_frame=chunk,
        )
    raise ValueError(f"Cannot apply model {name}")


def apply_blend_chunked(
    estimates: pd.DataFrame,
    first_name: str,
    second_name: str,
    first_weight: float,
    boosted_model: dict[str, object],
    direct_store_model: dict[str, object] | None,
    grouped_correction_model: dict[str, object] | None,
    pair_correction_model: dict[str, object] | None,
    activity_gate_model: dict[str, object] | None,
    chunk_size: int = 250_000,
) -> pd.DataFrame:
    chunks = []
    for start in range(0, len(estimates), chunk_size):
        chunk = estimates.iloc[start:start + chunk_size].copy()
        first = apply_named_model_to_chunk(
            first_name,
            chunk,
            boosted_model,
            direct_store_model,
            grouped_correction_model,
            pair_correction_model,
            activity_gate_model,
        )
        second = apply_named_model_to_chunk(
            second_name,
            chunk,
            boosted_model,
            direct_store_model,
            grouped_correction_model,
            pair_correction_model,
            activity_gate_model,
        )
        chunks.append(blend_estimate_frames(first, second, first_weight))
        del chunk, first, second
        gc.collect()
    return pd.concat(chunks, ignore_index=True)


def best_blend_candidate(candidates: dict[str, pd.DataFrame]) -> tuple[str, dict[str, float], pd.DataFrame, tuple[str, str, float] | None]:
    best_name = None
    best_metrics = None
    best_frame = None
    best_blend = None
    names = list(candidates)
    for name, frame in candidates.items():
        metrics = evaluate_predictions(frame)
        if best_metrics is None or metrics["wape"] < best_metrics["wape"]:
            best_name = name
            best_metrics = metrics
            best_frame = frame
            best_blend = None
    for first_index, first_name in enumerate(names):
        for second_name in names[first_index + 1:]:
            for weight in BLEND_WEIGHT_GRID:
                frame = blend_estimate_frames(candidates[first_name], candidates[second_name], weight)
                metrics = evaluate_predictions(frame)
                if best_metrics is None or metrics["wape"] < best_metrics["wape"]:
                    best_name = f"blend_{weight:.2f}_{first_name}_{1 - weight:.2f}_{second_name}"
                    best_metrics = metrics
                    best_frame = frame
                    best_blend = (first_name, second_name, weight)
    return best_name, best_metrics, best_frame, best_blend


def build_metric_projection(
    metric: str,
    prediction_column: str,
    params_output: Path,
    metrics_output: Path,
    with_interval: bool = False,
):
    print(f"Loading {metric} actuals...", flush=True)
    data = add_history_features(load_sales(DATA_DIR, metric=metric))
    calendar = active_events(EVENTS_FILE, data["date"].min(), data["date"].max())
    train, validation = hidden_holdout_split(data)
    print(f"Training {metric}: {len(train):,} train rows, {len(validation):,} hidden rows", flush=True)
    params = tune_genre_params(data, calendar, train=train, valid=validation)
    params.to_csv(params_output, index=False)

    print(f"Building {metric} baseline features...", flush=True)
    train_features = add_model_features(train, train, calendar)
    train_baseline = apply_predictions(train_features, params)
    boosted_model = train_boosted_model(train_baseline)

    validation_features = add_model_features(validation, train, calendar)
    validation_baseline = apply_predictions(validation_features, params)
    validation_boosted = apply_boosted_predictions(validation_baseline, boosted_model)
    baseline_metrics = evaluate_predictions(validation_baseline)
    boosted_metrics = evaluate_predictions(validation_boosted)
    direct_store_model = None
    grouped_correction_model = None
    pair_correction_model = None
    activity_gate_model = None
    best_blend = None
    direct_store_metrics = None
    grouped_correction_metrics = None
    pair_correction_metrics = None
    activity_gate_metrics = None
    if metric in {"sales", "units"}:
        train_for_store = train_baseline.rename(columns={"predicted_sales": "baseline_predicted_sales"})
        print(f"Training direct {metric} store model...", flush=True)
        direct_store_model = train_direct_store_model(train_for_store, train)
        validation_direct_store = apply_direct_store_model(validation_baseline, direct_store_model)

        print(f"Training grouped {metric} correction model...", flush=True)
        grouped_correction_model = train_grouped_store_correction_model(train_for_store, train)
        validation_grouped_correction = apply_grouped_store_correction(validation_baseline, grouped_correction_model)

        print(f"Training grouped {metric} shop+genre correction model...", flush=True)
        pair_correction_model = train_pair_store_correction_model(train_for_store, train)
        validation_pair_correction = apply_pair_store_correction(validation_baseline, pair_correction_model)

        validation_activity_gate = None
        if metric == "sales":
            print("Training active-sales gate model...", flush=True)
            activity_gate_model = train_activity_gate_model(train_for_store, train)
            if activity_gate_model is not None:
                validation_activity_gate = apply_activity_gate(
                    validation_pair_correction,
                    activity_gate_model,
                    feature_frame=validation_baseline,
                )

        candidate_frames = {
            "lag_event_baseline": validation_baseline,
            "trained_factor_correction": validation_boosted,
            "direct_store_gbt": validation_direct_store,
            "shop_group_correction_gbt": validation_grouped_correction,
            "shop_genre_group_correction_gbt": validation_pair_correction,
        }
        if validation_activity_gate is not None:
            candidate_frames["activity_gated_shop_genre_gbt"] = validation_activity_gate
        direct_store_metrics = evaluate_predictions(validation_direct_store)
        grouped_correction_metrics = evaluate_predictions(validation_grouped_correction)
        pair_correction_metrics = evaluate_predictions(validation_pair_correction)
        activity_gate_metrics = evaluate_predictions(validation_activity_gate) if validation_activity_gate is not None else None
        best_model_name, best_metrics, validation_estimates, best_blend = best_blend_candidate(candidate_frames)
    else:
        candidate_frames = {
            "lag_event_baseline": validation_baseline,
            "trained_factor_correction": validation_boosted,
        }
        best_model_name, best_metrics, validation_estimates, best_blend = best_blend_candidate(candidate_frames)

    metrics = evaluate_predictions(validation_estimates)
    metrics["baseline_wape"] = baseline_metrics["wape"]
    metrics["trained_factor_wape"] = boosted_metrics["wape"]
    metrics["store_specific_correction_wape"] = pd.NA
    metrics["direct_store_wape"] = direct_store_metrics["wape"] if direct_store_metrics else pd.NA
    metrics["shop_group_correction_wape"] = grouped_correction_metrics["wape"] if grouped_correction_metrics else pd.NA
    metrics["shop_genre_group_correction_wape"] = pair_correction_metrics["wape"] if pair_correction_metrics else pd.NA
    metrics["activity_gate_wape"] = activity_gate_metrics["wape"] if activity_gate_metrics else pd.NA
    recent_validation = validation_estimates[validation_estimates["date"].ge(HOLDOUT_START)]
    metrics["recent_hidden_wape"] = evaluate_predictions(recent_validation)["wape"] if len(recent_validation) else pd.NA
    metrics["blend"] = (
        f"{best_blend[2]:.2f}*{best_blend[0]}+{1 - best_blend[2]:.2f}*{best_blend[1]}"
        if best_blend
        else pd.NA
    )
    metrics["model"] = best_model_name
    metrics["validation_method"] = "random_hidden_5pct"
    metrics["hidden_holdout_rate"] = HIDDEN_HOLDOUT_RATE
    metrics["hidden_holdout_seed"] = HIDDEN_HOLDOUT_SEED
    metrics["train_rows"] = int(len(train))
    metrics["hidden_rows"] = int(len(validation))
    metrics["validation_start"] = data["date"].min().strftime("%Y-%m-%d")
    metrics["validation_end"] = data["date"].max().strftime("%Y-%m-%d")
    metrics["genre_count"] = int(params["genre"].nunique())
    metrics["tuned_genre_count"] = int(params["validation_wape"].notna().sum())
    metrics["target"] = metric
    pd.DataFrame([metrics]).to_csv(metrics_output, index=False)
    del train_features, train_baseline, validation_features, validation_baseline, validation_boosted
    gc.collect()

    print(f"Running {metric} inference with {best_model_name}...", flush=True)
    inference = active_prediction_frame(data)
    features = add_model_features(inference, data, calendar)
    baseline_estimates = apply_predictions(features, params)
    if best_blend:
        first_name, second_name, first_weight = best_blend
        estimates = apply_blend_chunked(
            baseline_estimates,
            first_name,
            second_name,
            first_weight,
            boosted_model,
            direct_store_model,
            grouped_correction_model,
            pair_correction_model,
            activity_gate_model,
        )
    elif best_model_name == "trained_factor_correction":
        estimates = apply_boosted_predictions(baseline_estimates, boosted_model)
    elif best_model_name == "direct_store_gbt" and direct_store_model is not None:
        estimates = apply_direct_store_model_chunked(baseline_estimates, direct_store_model)
    elif best_model_name == "shop_group_correction_gbt" and grouped_correction_model is not None:
        estimates = apply_grouped_store_correction_chunked(baseline_estimates, grouped_correction_model)
    elif best_model_name == "shop_genre_group_correction_gbt" and pair_correction_model is not None:
        estimates = apply_pair_store_correction_chunked(baseline_estimates, pair_correction_model)
    elif best_model_name == "activity_gated_shop_genre_gbt" and pair_correction_model is not None and activity_gate_model is not None:
        estimates = apply_blend_chunked(
            baseline_estimates,
            "activity_gated_shop_genre_gbt",
            "activity_gated_shop_genre_gbt",
            1.0,
            boosted_model,
            direct_store_model,
            grouped_correction_model,
            pair_correction_model,
            activity_gate_model,
        )
    else:
        estimates = baseline_estimates
    estimates[prediction_column] = estimates["predicted_sales"].round(0).astype("int64")
    if with_interval:
        estimates = add_prediction_interval(estimates, validation_estimates, prediction_column)

    output_columns = ["date", "shop", "genre", prediction_column]
    if with_interval:
        output_columns.extend([f"{prediction_column}_low", f"{prediction_column}_high"])
    output = estimates[output_columns].copy()
    output["date"] = output["date"].dt.strftime("%Y-%m-%d")
    return output


def average_unit_prices() -> tuple[pd.Series, pd.Series, float]:
    data = load_sales(DATA_DIR, metric="sales")
    units = load_sales(DATA_DIR, metric="units").rename(columns={"sales": "units"})
    actual = data.merge(units[["date", "shop", "genre", "units"]], on=["date", "shop", "genre"], how="left")
    actual = actual[actual["sales"].gt(0) & actual["units"].gt(0)].copy()
    if actual.empty:
        return pd.Series(dtype="float64"), pd.Series(dtype="float64"), 3000.0

    by_shop_genre = actual.groupby(["shop", "genre"])[["sales", "units"]].sum()
    by_shop_genre["avg_unit_price"] = (by_shop_genre["sales"] / by_shop_genre["units"]).clip(
        MIN_AVERAGE_UNIT_PRICE,
        MAX_AVERAGE_UNIT_PRICE,
    )

    by_genre = actual.groupby("genre")[["sales", "units"]].sum()
    by_genre["avg_unit_price"] = (by_genre["sales"] / by_genre["units"]).clip(
        MIN_AVERAGE_UNIT_PRICE,
        MAX_AVERAGE_UNIT_PRICE,
    )

    global_average = float(actual["sales"].sum() / actual["units"].sum())
    global_average = max(MIN_AVERAGE_UNIT_PRICE, min(MAX_AVERAGE_UNIT_PRICE, global_average))
    return by_shop_genre["avg_unit_price"], by_genre["avg_unit_price"], global_average


def apply_unit_fallback(estimates: pd.DataFrame) -> pd.DataFrame:
    by_shop_genre, by_genre, global_average = average_unit_prices()
    out = estimates.copy()
    lookup = out.set_index(["shop", "genre"]).index.map(by_shop_genre).astype("float64")
    genre_lookup = out["genre"].map(by_genre).astype("float64")
    out["average_unit_price"] = pd.Series(lookup, index=out.index).fillna(genre_lookup).fillna(global_average)

    needs_exact = out["predicted_sales"].gt(0) & out["predicted_units"].fillna(0).le(0)
    exact_fallback = (out.loc[needs_exact, "predicted_sales"] / out.loc[needs_exact, "average_unit_price"]).round()
    out.loc[needs_exact, "predicted_units"] = exact_fallback.clip(lower=1).astype("int64")

    needs_low = out["predicted_units"].gt(0) & out["predicted_units_low"].fillna(0).le(0)
    low_fallback = (out.loc[needs_low, "predicted_sales_low"] / out.loc[needs_low, "average_unit_price"]).round()
    out.loc[needs_low, "predicted_units_low"] = low_fallback.clip(lower=1).astype("int64")

    needs_high = out["predicted_units"].gt(0) & out["predicted_units_high"].fillna(0).le(0)
    high_fallback = (out.loc[needs_high, "predicted_sales_high"] / out.loc[needs_high, "average_unit_price"]).round()
    out.loc[needs_high, "predicted_units_high"] = high_fallback.clip(lower=1).astype("int64")

    out["predicted_units"] = out["predicted_units"].fillna(0).round().astype("int64")
    out["predicted_units_low"] = out["predicted_units_low"].fillna(0).round().astype("int64")
    out["predicted_units_high"] = out["predicted_units_high"].fillna(0).round().astype("int64")
    out["predicted_units_low"] = out[["predicted_units_low", "predicted_units"]].min(axis=1)
    out["predicted_units_high"] = out[["predicted_units_high", "predicted_units"]].max(axis=1)
    return out.drop(columns=["average_unit_price"])


def _unit_price_tables(train: pd.DataFrame) -> tuple[pd.Series, pd.Series, float, pd.DataFrame]:
    positive = train[train["sales"].gt(0) & train["units"].gt(0)].copy()
    if positive.empty:
        empty = pd.Series(dtype="float64")
        return empty, empty, 3000.0, pd.DataFrame(columns=["shop", "genre", "average_unit_price", "rows"])

    by_shop_genre = positive.groupby(["shop", "genre"])[["sales", "units"]].sum()
    by_shop_genre["average_unit_price"] = (by_shop_genre["sales"] / by_shop_genre["units"]).clip(
        MIN_AVERAGE_UNIT_PRICE,
        MAX_AVERAGE_UNIT_PRICE,
    )
    by_genre = positive.groupby("genre")[["sales", "units"]].sum()
    by_genre["average_unit_price"] = (by_genre["sales"] / by_genre["units"]).clip(
        MIN_AVERAGE_UNIT_PRICE,
        MAX_AVERAGE_UNIT_PRICE,
    )
    global_average = float(positive["sales"].sum() / positive["units"].sum())
    global_average = max(MIN_AVERAGE_UNIT_PRICE, min(MAX_AVERAGE_UNIT_PRICE, global_average))

    counts = positive.groupby(["shop", "genre"]).size().rename("rows")
    params = by_shop_genre[["average_unit_price"]].join(counts).reset_index()
    params["source"] = "shop_genre_actual_units"
    return by_shop_genre["average_unit_price"], by_genre["average_unit_price"], global_average, params


def _apply_unit_price_model(frame: pd.DataFrame, shop_genre_price: pd.Series, genre_price: pd.Series, global_average: float) -> pd.DataFrame:
    out = frame.copy()
    lookup = out.set_index(["shop", "genre"]).index.map(shop_genre_price).astype("float64")
    genre_lookup = out["genre"].map(genre_price).astype("float64")
    out["average_unit_price"] = pd.Series(lookup, index=out.index).fillna(genre_lookup).fillna(global_average)
    out["average_unit_price"] = out["average_unit_price"].clip(MIN_AVERAGE_UNIT_PRICE, MAX_AVERAGE_UNIT_PRICE)
    for sales_col, units_col in [
        ("predicted_sales", "predicted_units"),
        ("predicted_sales_low", "predicted_units_low"),
        ("predicted_sales_high", "predicted_units_high"),
    ]:
        out[units_col] = (out[sales_col] / out["average_unit_price"]).round().clip(lower=0).astype("int64")
    out["predicted_units_low"] = out[["predicted_units_low", "predicted_units"]].min(axis=1)
    out["predicted_units_high"] = out[["predicted_units_high", "predicted_units"]].max(axis=1)
    return out.drop(columns=["average_unit_price"])


def build_unit_price_projection(sales: pd.DataFrame) -> pd.DataFrame:
    sales_actual = load_sales(DATA_DIR, metric="sales")
    units_actual = load_sales(DATA_DIR, metric="units").rename(columns={"sales": "units"})
    actual = sales_actual.merge(units_actual[["date", "shop", "genre", "units"]], on=["date", "shop", "genre"], how="left")
    actual["units"] = actual["units"].fillna(0).clip(lower=0)
    train, validation = hidden_holdout_split(actual)
    shop_genre_price, genre_price, global_average, params = _unit_price_tables(train)
    params.to_csv(UNITS_PARAMS_OUTPUT, index=False)

    validation_frame = validation.rename(columns={"sales": "predicted_sales"}).copy()
    validation_frame["predicted_sales_low"] = validation_frame["predicted_sales"]
    validation_frame["predicted_sales_high"] = validation_frame["predicted_sales"]
    validation_estimates = _apply_unit_price_model(validation_frame, shop_genre_price, genre_price, global_average)
    validation_scored = pd.DataFrame({
        "sales": validation["units"].to_numpy(dtype=float),
        "predicted_sales": validation_estimates["predicted_units"].to_numpy(dtype=float),
    })
    metrics = evaluate_predictions(validation_scored)
    metrics["baseline_wape"] = metrics["wape"]
    metrics["trained_factor_wape"] = metrics["wape"]
    metrics["model"] = "shop_genre_unit_price"
    metrics["validation_method"] = "random_hidden_5pct"
    metrics["hidden_holdout_rate"] = HIDDEN_HOLDOUT_RATE
    metrics["hidden_holdout_seed"] = HIDDEN_HOLDOUT_SEED
    metrics["train_rows"] = int(len(train))
    metrics["hidden_rows"] = int(len(validation))
    metrics["validation_start"] = actual["date"].min().strftime("%Y-%m-%d")
    metrics["validation_end"] = actual["date"].max().strftime("%Y-%m-%d")
    metrics["genre_count"] = int(actual["genre"].nunique())
    metrics["tuned_genre_count"] = int(params["genre"].nunique())
    metrics["target"] = "units"
    pd.DataFrame([metrics]).to_csv(UNITS_METRICS_OUTPUT, index=False)

    return _apply_unit_price_model(sales, shop_genre_price, genre_price, global_average)[[
        "date",
        "shop",
        "genre",
        "predicted_units",
        "predicted_units_low",
        "predicted_units_high",
    ]]


def build_projection():
    print("Building grouped sales model...", flush=True)
    sales = build_metric_projection(
        "sales",
        "predicted_sales",
        GENRE_PARAMS_OUTPUT,
        METRICS_OUTPUT,
        with_interval=True,
    )
    print("Building unit-price model from TENKI actual units...", flush=True)
    units = build_unit_price_projection(sales)
    estimates = sales.merge(units, on=["date", "shop", "genre"], how="left")
    estimates["predicted_page_views"] = 0
    estimates["predicted_page_views_low"] = 0
    estimates["predicted_page_views_high"] = 0
    return apply_unit_fallback(estimates)


def write_outputs(estimates) -> None:
    MONTHLY_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for path in MONTHLY_OUTPUT_DIR.glob("*.csv"):
        path.unlink()
    TREND_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for path in TREND_OUTPUT_DIR.glob("*.csv"):
        path.unlink()

    estimates["month"] = estimates["date"].str.slice(0, 7)
    for month, frame in estimates.groupby("month", sort=True):
        frame.drop(columns=["month"]).to_csv(MONTHLY_OUTPUT_DIR / f"{month}.csv", index=False)
        trend = (
            frame.groupby(["date", "genre"], as_index=False)[[
                "predicted_sales",
                "predicted_sales_low",
                "predicted_sales_high",
            ]]
            .sum()
        )
        trend_all = (
            frame.groupby("date", as_index=False)[[
                "predicted_sales",
                "predicted_sales_low",
                "predicted_sales_high",
            ]]
            .sum()
        )
        trend_all["genre"] = "all"
        pd.concat([trend_all, trend], ignore_index=True)[[
            "date",
            "genre",
            "predicted_sales",
            "predicted_sales_low",
            "predicted_sales_high",
        ]].to_csv(TREND_OUTPUT_DIR / f"{month}.csv", index=False)

    monthly = (
        estimates.assign(date=estimates["month"] + "-01")
        .groupby(["date", "shop", "genre"], as_index=False)[[
            "predicted_sales",
            "predicted_sales_low",
            "predicted_sales_high",
            "predicted_units",
            "predicted_units_low",
            "predicted_units_high",
            "predicted_page_views",
            "predicted_page_views_low",
            "predicted_page_views_high",
        ]]
        .sum()
    )
    ALL_TIME_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    monthly.to_csv(ALL_TIME_OUTPUT, index=False)
    trend_monthly = (
        monthly.groupby(["date", "genre"], as_index=False)[[
            "predicted_sales",
            "predicted_sales_low",
            "predicted_sales_high",
        ]]
        .sum()
    )
    trend_monthly_all = (
        monthly.groupby("date", as_index=False)[[
            "predicted_sales",
            "predicted_sales_low",
            "predicted_sales_high",
        ]]
        .sum()
    )
    trend_monthly_all["genre"] = "all"
    pd.concat([trend_monthly_all, trend_monthly], ignore_index=True)[[
        "date",
        "genre",
        "predicted_sales",
        "predicted_sales_low",
        "predicted_sales_high",
    ]].to_csv(ALL_TIME_TREND_OUTPUT, index=False)


def main() -> None:
    estimates = build_projection()
    write_outputs(estimates)
    print(f"Wrote {len(estimates):,} projection rows")
    print(f"Wrote monthly files to {MONTHLY_OUTPUT_DIR}")
    print(f"Wrote compact all-time projection to {ALL_TIME_OUTPUT}")
    print(f"Wrote trend files to {TREND_OUTPUT_DIR}")
    print(f"Wrote compact all-time trend projection to {ALL_TIME_TREND_OUTPUT}")
    print(f"Wrote genre tuning params to {GENRE_PARAMS_OUTPUT}")
    print(f"Wrote validation metrics to {METRICS_OUTPUT}")
    print(f"Wrote page-view tuning params to {PAGE_VIEW_PARAMS_OUTPUT}")
    print(f"Wrote page-view validation metrics to {PAGE_VIEW_METRICS_OUTPUT}")
    print(f"Wrote units tuning params to {UNITS_PARAMS_OUTPUT}")
    print(f"Wrote units validation metrics to {UNITS_METRICS_OUTPUT}")


if __name__ == "__main__":
    main()
