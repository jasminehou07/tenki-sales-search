from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import median_absolute_error

from shop_projection_model import (
    HIDDEN_HOLDOUT_RATE,
    HIDDEN_HOLDOUT_SEED,
    active_events,
    add_history_features,
    add_model_features,
    apply_predictions,
    evaluate_predictions,
    hidden_holdout_split,
    load_sales,
    tune_genre_params,
)
from pipeline_paths import DASHBOARD_ROOT


ROOT = DASHBOARD_ROOT
DATA_DIR = ROOT / "data" / "by-month"
EVENTS_FILE = ROOT / "data" / "events.csv"
GENRE_NAMES_FILE = ROOT / "data" / "genre_names.csv"


FEATURES = [
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
    "previous_performance",
    "fallback",
    "base_prediction",
    "seasonal_signal",
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

TRAIN_SAMPLE_ROWS = 900_000
MIN_GROUP_TRAIN_ROWS = 20_000
GROUP_SAMPLE_ROWS = 55_000
MAX_GROUP_MODELS = 10
MIN_PAIR_TRAIN_ROWS = 6_000
PAIR_SAMPLE_ROWS = 35_000
MAX_PAIR_MODELS = 24
BLEND_WEIGHT_GRID = [0.0, 0.15, 0.30, 0.50, 0.70, 0.85, 1.0]

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
    sales_by_shop_group = train.copy()
    sales_by_shop_group["genre_group"] = sales_by_shop_group["genre"].map(genre_groups).fillna("other")
    grouped = sales_by_shop_group.groupby(["shop", "genre_group"], as_index=False)["sales"].sum()
    top = grouped.sort_values(["shop", "sales"], ascending=[True, False]).drop_duplicates("shop")
    shop_groups = dict(zip(top["shop"].astype(str), top["genre_group"].astype(str)))
    all_groups = sorted(set(genre_groups.values()) | set(shop_groups.values()) | {"other"})
    group_codes = {group: index for index, group in enumerate(all_groups)}
    shop_group_mean = sales_by_shop_group.groupby("genre_group")["sales"].mean()
    return shop_groups, genre_groups, group_codes, shop_group_mean


def add_store_features(frame: pd.DataFrame, train: pd.DataFrame, group_tables: tuple | None = None) -> pd.DataFrame:
    out = frame.copy()
    shop_genre_stats = train.groupby(["shop", "genre"])["sales"].agg(["mean", "size"]).rename(
        columns={"mean": "shop_genre_total_mean", "size": "shop_genre_rows"}
    )
    shop_stats = train.groupby("shop")["sales"].agg(["mean", "size"]).rename(
        columns={"mean": "shop_total_mean", "size": "shop_rows"}
    )
    genre_mean = train.groupby("genre")["sales"].mean().rename("genre_total_mean")

    pair_index = pd.MultiIndex.from_frame(out[["shop", "genre"]])
    out["shop_genre_total_mean"] = shop_genre_stats["shop_genre_total_mean"].reindex(pair_index).to_numpy()
    out["shop_genre_rows"] = shop_genre_stats["shop_genre_rows"].reindex(pair_index).to_numpy()
    out["shop_total_mean"] = out["shop"].map(shop_stats["shop_total_mean"])
    out["shop_rows"] = out["shop"].map(shop_stats["shop_rows"])
    out["genre_total_mean"] = out["genre"].map(genre_mean)
    if group_tables is None:
        group_tables = shop_group_tables(train)
    shop_groups, genre_groups, group_codes, shop_group_mean = group_tables
    out["shop_group"] = out["shop"].map(shop_groups).fillna("other")
    out["genre_group"] = out["genre"].map(genre_groups).fillna("other")
    out["shop_group_code"] = out["shop_group"].map(group_codes).fillna(group_codes.get("other", 0))
    out["genre_group_code"] = out["genre_group"].map(group_codes).fillna(group_codes.get("other", 0))
    out["shop_group_mean"] = out["shop_group"].map(shop_group_mean)
    out["recent_trend_7_28"] = (
        (out["lag_7"].fillna(0) + 1)
        / (out["lag_28"].fillna(0) + 1)
    ).clip(0.05, 20.0)
    out["recent_trend_14_56"] = (
        (out["lag_14"].fillna(0) + 1)
        / (out["lag_56"].fillna(0) + 1)
    ).clip(0.05, 20.0)
    out["history_strength"] = out[["lag_1", "lag_7", "lag_14", "lag_28", "lag_56", "lag_90"]].fillna(0).gt(0).sum(axis=1)
    return out


def matrix(frame: pd.DataFrame) -> pd.DataFrame:
    return frame[FEATURES].replace([np.inf, -np.inf], np.nan).fillna(0)


def score(actual: pd.Series, predicted: np.ndarray) -> dict[str, float]:
    absolute_error = np.abs(actual.to_numpy(dtype=float) - predicted)
    nonzero = actual.gt(0).to_numpy()
    ape = absolute_error[nonzero] / actual.to_numpy(dtype=float)[nonzero]
    return {
        "rows": float(len(actual)),
        "actual_sales": float(actual.sum()),
        "predicted_sales": float(predicted.sum()),
        "wape": float(absolute_error.sum() / actual.sum()),
        "median_ape": float(np.median(ape)),
        "within_25pct": float((ape <= 0.25).mean()),
        "median_absolute_error": float(median_absolute_error(actual, predicted)),
    }


def train_residual_correction(train_model: pd.DataFrame, validation_model: pd.DataFrame) -> dict[str, float]:
    train_frame = train_model[train_model["baseline_predicted_sales"].gt(0)].copy()
    rng = np.random.default_rng(HIDDEN_HOLDOUT_SEED + 29)
    fit_mask = rng.random(len(train_frame)) < 0.86
    fit_frame = train_frame.loc[fit_mask].copy()
    calibration_frame = train_frame.loc[~fit_mask].copy()
    target = np.log(
        ((fit_frame["sales"].to_numpy(dtype=float) + 1)
         / (fit_frame["baseline_predicted_sales"].to_numpy(dtype=float) + 1)).clip(0.1, 10.0)
    )
    correction_model = HistGradientBoostingRegressor(
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
    correction_model.fit(matrix(fit_frame), target)
    calibration_pred = (
        calibration_frame["baseline_predicted_sales"].to_numpy(dtype=float)
        * np.exp(correction_model.predict(matrix(calibration_frame)).clip(-0.9, 0.9))
    ).clip(min=0)
    calibration_scale = 1.0
    if calibration_pred.sum() > 0:
        calibration_scale = float(
            np.clip(calibration_frame["sales"].sum() / calibration_pred.sum(), 0.75, 1.35)
        )
    correction = correction_model.predict(matrix(validation_model)).clip(-0.9, 0.9)
    predicted = (
        validation_model["baseline_predicted_sales"].to_numpy(dtype=float)
        * np.exp(correction)
        * calibration_scale
    ).clip(min=0)
    metrics = score(validation_model["sales"], predicted)
    metrics["calibration_scale"] = calibration_scale
    return metrics


def fit_correction_model(frame: pd.DataFrame, seed: int) -> HistGradientBoostingRegressor:
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
    model.fit(matrix(frame), target)
    return model


def train_grouped_residual_correction(train_model: pd.DataFrame, validation_model: pd.DataFrame) -> dict[str, float]:
    train_frame = train_model[train_model["baseline_predicted_sales"].gt(0)].copy()
    fallback_frame = train_frame
    if len(fallback_frame) > TRAIN_SAMPLE_ROWS:
        fallback_frame = fallback_frame.sample(TRAIN_SAMPLE_ROWS, random_state=HIDDEN_HOLDOUT_SEED + 101)
    fallback_model = fit_correction_model(fallback_frame, HIDDEN_HOLDOUT_SEED + 101)
    predictions = pd.Series(index=validation_model.index, dtype="float64")
    trained_groups = []

    group_items = [
        (shop_group, group_frame)
        for shop_group, group_frame in train_frame.groupby("shop_group", sort=True)
        if len(group_frame) >= MIN_GROUP_TRAIN_ROWS
    ]
    group_items = sorted(group_items, key=lambda item: len(item[1]), reverse=True)[:MAX_GROUP_MODELS]

    for index, (shop_group, group_frame) in enumerate(group_items, start=1):
        if len(group_frame) < MIN_GROUP_TRAIN_ROWS:
            continue
        fit_frame = group_frame
        if len(fit_frame) > GROUP_SAMPLE_ROWS:
            fit_frame = fit_frame.sample(GROUP_SAMPLE_ROWS, random_state=HIDDEN_HOLDOUT_SEED + index)
        rng = np.random.default_rng(HIDDEN_HOLDOUT_SEED + 500 + index)
        calibration_mask = rng.random(len(fit_frame)) < 0.14
        calibration_frame = fit_frame.loc[calibration_mask].copy()
        fit_only = fit_frame.loc[~calibration_mask].copy()
        if len(fit_only) < MIN_GROUP_TRAIN_ROWS // 2 or calibration_frame.empty:
            fit_only = fit_frame
            calibration_frame = fit_frame
        model = fit_correction_model(fit_only, HIDDEN_HOLDOUT_SEED + 200 + index)
        calibration_pred = (
            calibration_frame["baseline_predicted_sales"].to_numpy(dtype=float)
            * np.exp(model.predict(matrix(calibration_frame)).clip(-0.9, 0.9))
        ).clip(min=0)
        calibration_scale = 1.0
        if calibration_pred.sum() > 0:
            calibration_scale = float(
                np.clip(calibration_frame["sales"].sum() / calibration_pred.sum(), 0.70, 1.45)
            )
        mask = validation_model["shop_group"].eq(shop_group)
        if not mask.any():
            continue
        correction = model.predict(matrix(validation_model.loc[mask])).clip(-0.9, 0.9)
        predictions.loc[mask] = (
            validation_model.loc[mask, "baseline_predicted_sales"].to_numpy(dtype=float)
            * np.exp(correction)
            * calibration_scale
        ).clip(min=0)
        trained_groups.append(f"{shop_group}:{len(fit_frame):,}@{calibration_scale:.2f}")

    missing = predictions.isna()
    if missing.any():
        correction = fallback_model.predict(matrix(validation_model.loc[missing])).clip(-0.9, 0.9)
        predictions.loc[missing] = (
            validation_model.loc[missing, "baseline_predicted_sales"].to_numpy(dtype=float)
            * np.exp(correction)
        ).clip(min=0)

    metrics = score(validation_model["sales"], predictions.to_numpy(dtype=float))
    metrics["trained_groups"] = ", ".join(trained_groups)
    metrics["predictions"] = predictions.to_numpy(dtype=float)
    return metrics


def train_pair_residual_correction(train_model: pd.DataFrame, validation_model: pd.DataFrame) -> dict[str, float]:
    train_frame = train_model[train_model["baseline_predicted_sales"].gt(0)].copy()
    fallback_frame = train_frame
    if len(fallback_frame) > TRAIN_SAMPLE_ROWS:
        fallback_frame = fallback_frame.sample(TRAIN_SAMPLE_ROWS, random_state=HIDDEN_HOLDOUT_SEED + 701)
    fallback_model = fit_correction_model(fallback_frame, HIDDEN_HOLDOUT_SEED + 701)
    predictions = pd.Series(index=validation_model.index, dtype="float64")
    trained_pairs = []

    pair_items = [
        ((shop_group, genre_group), pair_frame)
        for (shop_group, genre_group), pair_frame in train_frame.groupby(["shop_group", "genre_group"], sort=True)
        if len(pair_frame) >= MIN_PAIR_TRAIN_ROWS
    ]
    pair_items = sorted(pair_items, key=lambda item: len(item[1]), reverse=True)[:MAX_PAIR_MODELS]

    for index, ((shop_group, genre_group), pair_frame) in enumerate(pair_items, start=1):
        fit_frame = pair_frame
        if len(fit_frame) > PAIR_SAMPLE_ROWS:
            fit_frame = fit_frame.sample(PAIR_SAMPLE_ROWS, random_state=HIDDEN_HOLDOUT_SEED + 900 + index)
        rng = np.random.default_rng(HIDDEN_HOLDOUT_SEED + 1000 + index)
        calibration_mask = rng.random(len(fit_frame)) < 0.14
        calibration_frame = fit_frame.loc[calibration_mask].copy()
        fit_only = fit_frame.loc[~calibration_mask].copy()
        if len(fit_only) < MIN_PAIR_TRAIN_ROWS // 2 or calibration_frame.empty:
            fit_only = fit_frame
            calibration_frame = fit_frame
        model = fit_correction_model(fit_only, HIDDEN_HOLDOUT_SEED + 1100 + index)
        calibration_pred = (
            calibration_frame["baseline_predicted_sales"].to_numpy(dtype=float)
            * np.exp(model.predict(matrix(calibration_frame)).clip(-0.9, 0.9))
        ).clip(min=0)
        calibration_scale = 1.0
        if calibration_pred.sum() > 0:
            calibration_scale = float(
                np.clip(calibration_frame["sales"].sum() / calibration_pred.sum(), 0.70, 1.45)
            )
        mask = validation_model["shop_group"].eq(shop_group) & validation_model["genre_group"].eq(genre_group)
        if not mask.any():
            continue
        correction = model.predict(matrix(validation_model.loc[mask])).clip(-0.9, 0.9)
        predictions.loc[mask] = (
            validation_model.loc[mask, "baseline_predicted_sales"].to_numpy(dtype=float)
            * np.exp(correction)
            * calibration_scale
        ).clip(min=0)
        trained_pairs.append(f"{shop_group}+{genre_group}:{len(fit_frame):,}@{calibration_scale:.2f}")

    missing = predictions.isna()
    if missing.any():
        correction = fallback_model.predict(matrix(validation_model.loc[missing])).clip(-0.9, 0.9)
        predictions.loc[missing] = (
            validation_model.loc[missing, "baseline_predicted_sales"].to_numpy(dtype=float)
            * np.exp(correction)
        ).clip(min=0)

    metrics = score(validation_model["sales"], predictions.to_numpy(dtype=float))
    metrics["trained_pairs"] = ", ".join(trained_pairs)
    metrics["predictions"] = predictions.to_numpy(dtype=float)
    return metrics


def blend_predictions(actual: pd.Series, named_predictions: dict[str, np.ndarray]) -> dict[str, object]:
    names = list(named_predictions)
    best = None
    if len(names) < 2:
        only = names[0]
        metrics = score(actual, named_predictions[only])
        metrics["blend"] = only
        metrics["predictions"] = named_predictions[only]
        return metrics

    for first_index, first_name in enumerate(names):
        for second_name in names[first_index + 1:]:
            first = named_predictions[first_name]
            second = named_predictions[second_name]
            for weight in BLEND_WEIGHT_GRID:
                pred = (first * weight) + (second * (1 - weight))
                metrics = score(actual, pred)
                metrics["blend"] = f"{weight:.2f}*{first_name}+{1-weight:.2f}*{second_name}"
                metrics["predictions"] = pred
                if best is None or metrics["wape"] < best["wape"]:
                    best = metrics
    return best


def run_metric(metric: str) -> None:
    print(f"\n=== {metric.upper()} MODEL ===", flush=True)
    print(f"loading {metric}...", flush=True)
    data = add_history_features(load_sales(DATA_DIR, metric=metric))
    calendar = active_events(EVENTS_FILE, data["date"].min(), data["date"].max())
    train, validation = hidden_holdout_split(data)
    print(f"train rows: {len(train):,}", flush=True)
    print(f"hidden rows: {len(validation):,}", flush=True)

    print("fitting current baseline...", flush=True)
    params = tune_genre_params(data, calendar, train=train, valid=validation)
    train_features = add_model_features(train, train, calendar)
    train_baseline = apply_predictions(train_features, params).rename(
        columns={"predicted_sales": "baseline_predicted_sales"}
    )
    validation_features = add_model_features(validation, train, calendar)
    validation_baseline = apply_predictions(validation_features, params)
    baseline_metrics = evaluate_predictions(validation_baseline)
    boosted_validation = validation_baseline.copy()

    print("building store-specific training matrix...", flush=True)
    group_tables = shop_group_tables(train)
    train_model_full = add_store_features(train_baseline, train, group_tables=group_tables)
    validation_model = add_store_features(
        validation_baseline.rename(columns={"predicted_sales": "baseline_predicted_sales"}),
        train,
        group_tables=group_tables,
    )
    train_model = train_model_full
    if len(train_model) > TRAIN_SAMPLE_ROWS:
        train_model = train_model.sample(TRAIN_SAMPLE_ROWS, random_state=HIDDEN_HOLDOUT_SEED)
        print(f"sampled train rows: {len(train_model):,}", flush=True)

    model = HistGradientBoostingRegressor(
        loss="squared_error",
        learning_rate=0.055,
        max_iter=120,
        max_leaf_nodes=31,
        min_samples_leaf=80,
        l2_regularization=0.06,
        random_state=HIDDEN_HOLDOUT_SEED,
        early_stopping=True,
        validation_fraction=0.08,
        n_iter_no_change=15,
    )
    print("training store-specific gradient boosted model...", flush=True)
    model.fit(matrix(train_model), np.log1p(train_model["sales"].to_numpy(dtype=float)))
    predicted = np.expm1(model.predict(matrix(validation_model))).clip(min=0)
    gbt_metrics = score(validation_model["sales"], predicted)

    print("training store-specific correction model...", flush=True)
    correction_metrics = train_residual_correction(train_model, validation_model)
    print("training shop-group correction models...", flush=True)
    grouped_correction_metrics = train_grouped_residual_correction(train_model_full, validation_model)
    print("training shop-group + genre-group correction models...", flush=True)
    pair_correction_metrics = train_pair_residual_correction(train_model_full, validation_model)
    blend_metrics = blend_predictions(validation_model["sales"], {
        "baseline": validation_model["baseline_predicted_sales"].to_numpy(dtype=float),
        "store_gbt": predicted,
        "shop_group": grouped_correction_metrics["predictions"],
        "shop_genre_group": pair_correction_metrics["predictions"],
    })

    print(f"\nCurrent {metric} shop model")
    print(f"WMAPE: {baseline_metrics['wape']:.4f}")
    print(f"Median APE: {baseline_metrics['median_ape']:.4f}")
    print(f"Within 25%: {baseline_metrics['within_25pct']:.4f}")

    print(f"\nExperimental {metric} store-specific GBT")
    print(f"WMAPE: {gbt_metrics['wape']:.4f}")
    print(f"Median APE: {gbt_metrics['median_ape']:.4f}")
    print(f"Within 25%: {gbt_metrics['within_25pct']:.4f}")
    print(f"Predicted sales: {gbt_metrics['predicted_sales']:,.0f}")
    print(f"Actual sales: {gbt_metrics['actual_sales']:,.0f}")
    print(f"Improvement: {(baseline_metrics['wape'] - gbt_metrics['wape']):.4f}")

    print(f"\nExperimental {metric} store-specific correction GBT")
    print(f"WMAPE: {correction_metrics['wape']:.4f}")
    print(f"Median APE: {correction_metrics['median_ape']:.4f}")
    print(f"Within 25%: {correction_metrics['within_25pct']:.4f}")
    print(f"Predicted sales: {correction_metrics['predicted_sales']:,.0f}")
    print(f"Actual sales: {correction_metrics['actual_sales']:,.0f}")
    print(f"Calibration scale: {correction_metrics['calibration_scale']:.4f}")
    print(f"Improvement: {(baseline_metrics['wape'] - correction_metrics['wape']):.4f}")

    print(f"\nExperimental {metric} shop-group correction GBT")
    print(f"WMAPE: {grouped_correction_metrics['wape']:.4f}")
    print(f"Median APE: {grouped_correction_metrics['median_ape']:.4f}")
    print(f"Within 25%: {grouped_correction_metrics['within_25pct']:.4f}")
    print(f"Predicted sales: {grouped_correction_metrics['predicted_sales']:,.0f}")
    print(f"Actual sales: {grouped_correction_metrics['actual_sales']:,.0f}")
    print(f"Improvement: {(baseline_metrics['wape'] - grouped_correction_metrics['wape']):.4f}")
    print(f"Groups trained: {grouped_correction_metrics['trained_groups']}")

    print(f"\nExperimental {metric} shop-group + genre-group correction GBT")
    print(f"WMAPE: {pair_correction_metrics['wape']:.4f}")
    print(f"Median APE: {pair_correction_metrics['median_ape']:.4f}")
    print(f"Within 25%: {pair_correction_metrics['within_25pct']:.4f}")
    print(f"Predicted sales: {pair_correction_metrics['predicted_sales']:,.0f}")
    print(f"Actual sales: {pair_correction_metrics['actual_sales']:,.0f}")
    print(f"Improvement: {(baseline_metrics['wape'] - pair_correction_metrics['wape']):.4f}")
    print(f"Pairs trained: {pair_correction_metrics['trained_pairs']}")

    print(f"\nExperimental {metric} blended prediction")
    print(f"WMAPE: {blend_metrics['wape']:.4f}")
    print(f"Median APE: {blend_metrics['median_ape']:.4f}")
    print(f"Within 25%: {blend_metrics['within_25pct']:.4f}")
    print(f"Blend: {blend_metrics['blend']}")
    print(f"Holdout method: random hidden {HIDDEN_HOLDOUT_RATE:.0%}")


def main() -> None:
    run_metric("sales")
    run_metric("units")


if __name__ == "__main__":
    main()
