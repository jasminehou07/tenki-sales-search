from __future__ import annotations

from pathlib import Path

from shop_projection_model import (
    HOLDOUT_START,
    active_events,
    add_history_features,
    add_model_features,
    apply_predictions,
    evaluate_predictions,
    load_sales,
    tune_genre_params,
)
from pipeline_paths import DASHBOARD_ROOT


ROOT = DASHBOARD_ROOT
DATA_DIR = ROOT / "data" / "by-month"
EVENTS_FILE = ROOT / "data" / "events.csv"
OUTPUT_FILE = ROOT / "data" / "rakuten_shop_estimates.csv"


def train_and_predict():
    data = add_history_features(load_sales(DATA_DIR))
    calendar = active_events(EVENTS_FILE, data["date"].min(), data["date"].max())
    params = tune_genre_params(data, calendar)

    train = data[data["date"] < HOLDOUT_START].copy()
    holdout = data[data["date"] >= HOLDOUT_START].copy()
    holdout = add_model_features(holdout, train, calendar)
    holdout = apply_predictions(holdout, params)
    holdout["absolute_error"] = (holdout["sales"] - holdout["predicted_sales"]).abs()

    metrics = evaluate_predictions(holdout)
    print(f"Rows: {int(metrics['rows']):,}")
    print(f"Actual sales: {metrics['actual_sales']:,.0f}")
    print(f"Predicted sales: {metrics['predicted_sales']:,.0f}")
    print(f"Shop-level WAPE: {metrics['wape']:.3f}")
    print(f"Median APE: {metrics['median_ape']:.3f}")
    print(f"Within 25%: {metrics['within_25pct']:.3f}")

    output = holdout[["date", "shop", "genre", "sales", "predicted_sales", "absolute_error"]].copy()
    output["date"] = output["date"].dt.strftime("%Y-%m-%d")
    return output


def main() -> None:
    estimates = train_and_predict()
    estimates.to_csv(OUTPUT_FILE, index=False)
    print(f"Wrote {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
