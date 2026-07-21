from __future__ import annotations

import argparse
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingRegressor, HistGradientBoostingRegressor
from sklearn.metrics import median_absolute_error
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder

try:
    from xgboost import XGBRegressor

    HAS_XGBOOST = True
except Exception:
    XGBRegressor = None
    HAS_XGBOOST = False

warnings.filterwarnings(
    "ignore",
    message="Skipping features without any observed values.*",
    category=UserWarning,
)
warnings.filterwarnings(
    "ignore",
    message="The 'generic' unit for NumPy timedelta is deprecated.*",
    category=DeprecationWarning,
)

from pipeline_paths import DASHBOARD_ROOT, WORK_ROOT

ROOT = DASHBOARD_ROOT
RANK_DIR = WORK_ROOT / "ranked-shops"
BY_MONTH_DIR = ROOT / "data" / "by-month"
EVENTS_FILE = ROOT / "data" / "events.csv"
GENRE_NAMES_FILE = ROOT / "data" / "genre_names.csv"
TRAINING_SOURCE = WORK_ROOT / "rank_training_known_sales.csv"
METRICS_OUT = ROOT / "data" / "rank_model_metrics.csv"
METRICS_BY_SPLIT_OUT = ROOT / "data" / "rank_model_metrics_by_split.csv"
METRICS_BY_GENRE_OUT = ROOT / "data" / "rank_model_metrics_by_genre.csv"
METRICS_BY_EVENT_OUT = ROOT / "data" / "rank_model_metrics_by_event.csv"
CURVE_OUT = ROOT / "data" / "rank_curves.csv"
EVENT_FACTOR_OUT = ROOT / "data" / "rank_event_factors.csv"
DISPLAY_RANK = 20
ESTIMATE_RANK = 80
HOLDOUT_RATE = 0.05
VALIDATION_RUNS = 3
SEED = 20260611
MAX_EVENT_DAYS = 45
EVENT_WINDOW_DAYS = 7
MIN_GENRE_PROFILE_ROWS = 80
MIN_GENRE_PROFILE_RANKS = 10
MIN_GENRE_MODEL_ROWS = 120
MIN_GROUP_MODEL_ROWS = 500
MIN_SIMILAR_MODEL_ROWS = 120
GLOBAL_GENRE = "__global__"
MIN_EVENT_FACTOR_ROWS = 5
MIN_GLOBAL_EVENT_FACTOR_ROWS = 20
MIN_EVENT_FACTOR = 0.65
MAX_EVENT_FACTOR = 2.4
PROFILE_MIN_ROWS = 30
MIN_CALIBRATION_ROWS = 25
MIN_GENRE_CALIBRATION_ROWS = 45
MIN_GROUP_CALIBRATION_ROWS = 120
MIN_RANK_CALIBRATION_ROWS = 25
MIN_EVENT_CALIBRATION_ROWS = 40
MIN_CALIBRATION_FACTOR = 0.55
MAX_CALIBRATION_FACTOR = 1.9
SPIKE_WEIGHT_MAX = 3.2
EVENT_WEIGHT_MAX = 1.85
CALIBRATION_SAMPLE_ROWS = 5_000
# Learned from TENKI same-weekday nearby baselines. These are feature signals,
# not direct multipliers; the boosted model learns how strongly to use them.
EVENT_INTENSITY = {
    "supersale": 2.12,
    "zero-five": 1.96,
    "newyear-sale": 1.65,
    "mothers-day": 1.37,
    "fathers-day": 1.37,
    "thank-you": 1.36,
    "marathon": 1.22,
    "black-friday": 1.11,
    "singles-day": 1.10,
    "39shop": 1.08,
    "point-up": 1.05,
    "wonderful-day": 0.94,
    "point-back": 0.82,
    "fashionthesale": 0.82,
    "ichiba-day": 0.79,
    "eagles": 0.75,
}


GENRE_GROUP_KEYWORDS = [
    ("food_seafood", ["サーモン", "鮭", "ホタテ", "イクラ", "カニ", "seafood", "salmon", "scallop", "roe", "crab"]),
    ("food_grains", ["白米", "米", "rice"]),
    ("food_beverages", ["日本茶", "植物茶", "tea"]),
    ("food_prepared", ["おせち", "詰め合わせ", "セット・詰め合わせ", "osechi", "assortment"]),
    ("alcohol", ["ワイン", "シャンパン", "ウイスキー", "whisky", "whiskey", "wine", "champagne"]),
    ("electronics", ["ノートpc", "スマートフォン", "カメラ", "レンズ", "家電", "本体", "laptop", "smartphone", "camera", "lens", "appliance", "main units"]),
    ("office_ink", ["インク", "ink"]),
    ("office_furniture", ["会議用", "チェア", "デスク", "conference", "chair", "desk"]),
    ("office_supplies", ["オフィス", "事務", "office"]),
    ("beauty_health", ["美容", "健康", "石けん", "ボディソープ", "ビタミン", "プロバイオティクス", "シャンプー", "トリートメント", "ファンデーション", "クレンジング", "ランジェリー", "beauty", "health", "soap", "vitamin", "probiotic", "shampoo", "conditioner", "foundation", "cleansing", "lingerie"]),
    ("home_furniture", ["テーブル", "カーテン", "クッション", "ハンガー", "マット", "寝具", "収納", "table", "curtain", "cushion", "hanger", "mat", "bedding", "storage"]),
    ("apparel_outerwear", ["コート", "ジャケット", "coat", "jacket"]),
    ("apparel_tops", ["シャツ", "ブラウス", "tシャツ", "ポロシャツ", "shirt", "blouse", "t-shirt", "polo"]),
    ("apparel_bottoms", ["パンツ", "ズボン", "スカート", "pants", "trousers", "skirt"]),
    ("apparel_dresses", ["ワンピース", "dress"]),
    ("apparel_bags_wallets", ["ハンドバッグ", "ショルダーバッグ", "メッセンジャーバッグ", "トートバッグ", "財布", "バッグ", "bag", "wallet"]),
    ("apparel_shoes", ["ウェッジ", "サンダル", "シューズ", "靴", "wedge", "sandal", "shoes"]),
    ("apparel_jewelry", ["指輪", "リング", "ピアス", "ring", "earrings"]),
    ("apparel_workwear", ["エプロン", "安全靴", "apron", "safety shoes"]),
    ("baby_kids", ["ベビー", "キッズ", "ジュニア", "baby", "kids", "junior"]),
    ("travel_gifts", ["旅行券", "ホテル券", "航空券", "カタログギフト", "チケット", "travel", "hotel", "airline", "voucher", "gift", "ticket"]),
    ("sports_outdoor", ["ゴルフ", "ウェッジ", "フォームローラー", "自転車", "距離計", "golf", "wedge", "foam roller", "bicycle", "rangefinder"]),
    ("pets", ["牧草", "ペット", "hay", "pet"]),
    ("daily_goods", ["ティッシュ", "掃除機", "クリーナー", "消臭", "ガム", "マグカップ", "tissue", "vacuum", "cleaner", "deodorant", "gum", "mug"]),
]

SEASONAL_PRIOR_PEAKS = {
    # Calendar priors from Japan shopping cycles. These are weak feature signals,
    # not direct multipliers; TENKI validation decides how much to use them.
    "food_seafood": [11, 12, 1],
    "food_grains": [8, 9, 10, 11],
    "office_ink": [3, 4],
    "office_furniture": [3, 4],
    "office_supplies": [3, 4],
    "apparel_outerwear": [10, 11, 12, 1, 2],
    "apparel_tops": [3, 4, 5, 9, 10],
    "apparel_bottoms": [3, 4, 9, 10],
    "apparel_dresses": [3, 4, 5, 6],
    "apparel_bags_wallets": [3, 4, 12],
    "apparel_shoes": [3, 4, 5, 9, 10],
    "apparel_jewelry": [12, 2, 3],
    "apparel_workwear": [3, 4],
}


def circular_month_peak(month: pd.Series, peaks: list[int]) -> pd.Series:
    if not peaks:
        return pd.Series(0.0, index=month.index)
    distances = []
    for peak in peaks:
        raw = (month - peak).abs()
        distances.append(np.minimum(raw, 12 - raw))
    nearest = np.minimum.reduce(distances)
    return pd.Series((1 - (nearest / 6)).clip(0, 1), index=month.index)


def add_calendar_prior_features(out: pd.DataFrame) -> pd.DataFrame:
    out["calendar_seasonal_prior"] = 0.0
    for group, peaks in SEASONAL_PRIOR_PEAKS.items():
        mask = out["genre_group"].eq(group)
        if mask.any():
            out.loc[mask, "calendar_seasonal_prior"] = circular_month_peak(out.loc[mask, "month"], peaks)

    out["seafood_winter_signal"] = (
        out["genre_group"].eq("food_seafood") & out["month"].isin([11, 12, 1, 2])
    ).astype(int)
    out["seafood_year_end_signal"] = (
        out["genre_group"].eq("food_seafood") & out["month"].eq(12) & out["day"].ge(10)
    ).astype(int)
    out["rice_new_crop_signal"] = (
        out["genre_group"].eq("food_grains") & out["month"].isin([8, 9, 10, 11])
    ).astype(int)
    out["rice_year_end_stockup_signal"] = (
        out["genre_group"].eq("food_grains") & out["month"].eq(12) & out["day"].ge(15)
    ).astype(int)
    out["office_fiscal_start_signal"] = (
        out["genre_group"].isin(["office_ink", "office_furniture", "office_supplies"])
        & out["month"].isin([3, 4])
    ).astype(int)
    out["office_new_hire_signal"] = (
        out["genre_group"].isin(["office_ink", "office_furniture", "office_supplies"])
        & out["month"].eq(4)
    ).astype(int)
    out["apparel_spring_summer_signal"] = (
        out["genre_group"].isin(["apparel_tops", "apparel_bottoms", "apparel_dresses", "apparel_shoes", "apparel_bags_wallets"])
        & out["month"].isin([3, 4, 5, 6])
    ).astype(int)
    out["apparel_autumn_winter_signal"] = (
        out["genre_group"].isin(["apparel_outerwear", "apparel_tops", "apparel_bottoms", "apparel_shoes"])
        & out["month"].isin([9, 10, 11, 12])
    ).astype(int)
    out["apparel_gift_signal"] = (
        out["genre_group"].isin(["apparel_bags_wallets", "apparel_jewelry"])
        & out["month"].isin([12, 2, 3])
    ).astype(int)
    return out

SIMILAR_GENRE_OVERRIDES = {
    "101384": ["202502", "215110", "101535", "304587"],
    "101954": ["202502", "215110", "101535", "304587"],
    "211789": ["204490", "204519", "204586", "212377"],
    "553282": ["100895", "101146", "111908", "112666", "550091", "560287", "565864", "567686"],
    "563843": ["100040", "560202", "110335", "204490"],
    "563999": ["408099", "100962", "216307", "216348"],
}


def market_rank_profile() -> np.ndarray:
    ranks = np.arange(1, ESTIMATE_RANK + 1, dtype=float)
    return smooth_profile(ranks ** -1.0)


def read_rank_files() -> pd.DataFrame:
    frames = []
    for path in sorted(RANK_DIR.glob("*.csv")):
        frame = pd.read_csv(
            path,
            dtype={"date": "string", "genre": "string", "rank": "Int64", "shop": "string", "source": "string"},
        )
        frames.append(frame)
    if not frames:
        raise SystemExit("No ranked-shop CSVs found")
    data = pd.concat(frames, ignore_index=True)
    data["date"] = pd.to_datetime(data["date"], errors="coerce")
    data["sales"] = pd.to_numeric(data["sales"], errors="coerce")
    data["rank"] = pd.to_numeric(data["rank"], errors="coerce").astype("Int64")
    return data.dropna(subset=["date", "genre", "rank"])


def load_or_create_training_data(rank_rows: pd.DataFrame) -> pd.DataFrame:
    if TRAINING_SOURCE.exists():
        data = pd.read_csv(TRAINING_SOURCE, dtype={"genre": "string"})
        data["date"] = pd.to_datetime(data["date"], errors="coerce")
        data["sales"] = pd.to_numeric(data["sales"], errors="coerce")
        data["rank"] = pd.to_numeric(data["rank"], errors="coerce").astype("Int64")
    else:
        data = rank_rows[
            rank_rows["source"].eq("actual")
            & rank_rows["rank"].between(1, DISPLAY_RANK)
            & rank_rows["sales"].gt(0)
        ][["date", "genre", "rank", "sales"]].copy()
        data.to_csv(TRAINING_SOURCE, index=False)

    data = data[
        data["date"].notna()
        & data["genre"].notna()
        & data["rank"].between(1, DISPLAY_RANK)
        & data["sales"].gt(0)
    ].copy()
    if data.empty:
        raise SystemExit("No known rank-sales rows available for training")
    data["genre"] = data["genre"].astype(str)
    data["rank"] = data["rank"].astype(int)
    return data.sort_values(["date", "genre", "rank"]).reset_index(drop=True)


def load_events() -> pd.DataFrame:
    events = pd.read_csv(EVENTS_FILE)
    events["start_date"] = pd.to_datetime(events["start_date"], errors="coerce")
    events["end_date"] = pd.to_datetime(events["end_date"], errors="coerce")
    events = events.dropna(subset=["name", "start_date", "end_date"])[["name", "start_date", "end_date"]].copy()
    events["duration_days"] = (events["end_date"] - events["start_date"]).dt.days + 1
    events = events[events["duration_days"].between(1, MAX_EVENT_DAYS)].copy()
    events["intensity"] = events["name"].map(EVENT_INTENSITY).fillna(1.1).astype(float)
    return events


def build_event_profiles(data: pd.DataFrame, events: pd.DataFrame) -> pd.DataFrame:
    columns = [
        "event",
        "learned_intensity",
        "during_lift",
        "pre_lift",
        "post_lift",
        "overlap_lift",
        "active_rows",
        "pre_rows",
        "post_rows",
        "overlap_rows",
    ]
    if data.empty or events.empty:
        return pd.DataFrame(columns=columns)

    ref = data.copy()
    ref["genre"] = ref["genre"].astype(str)
    ref["rank"] = ref["rank"].astype(int)
    ref["baseline"] = ref.groupby(["genre", "rank"])["sales"].transform("median").clip(lower=1)
    ref["residual"] = (ref["sales"] / ref["baseline"]).replace([np.inf, -np.inf], np.nan).clip(0.2, 5.0)
    ref = ref.dropna(subset=["date", "residual"]).copy()
    if ref.empty:
        return pd.DataFrame(columns=columns)

    dates = pd.DataFrame({
        "date": pd.date_range(
            ref["date"].min() - pd.Timedelta(days=EVENT_WINDOW_DAYS),
            ref["date"].max() + pd.Timedelta(days=EVENT_WINDOW_DAYS),
            freq="D",
        )
    })
    dates["active_event_count"] = 0
    for event in events.itertuples(index=False):
        mask = dates["date"].between(event.start_date, event.end_date)
        if mask.any():
            dates.loc[mask, "active_event_count"] += 1
    active_count = dict(zip(dates["date"], dates["active_event_count"]))
    ref["active_event_count"] = ref["date"].map(active_count).fillna(0).astype(int)

    rows = []
    for name, occurrences in events.groupby("name", sort=True):
        active_mask = pd.Series(False, index=ref.index)
        pre_mask = pd.Series(False, index=ref.index)
        post_mask = pd.Series(False, index=ref.index)
        for event in occurrences.itertuples(index=False):
            active_mask |= ref["date"].between(event.start_date, event.end_date)
            pre_mask |= ref["date"].between(
                event.start_date - pd.Timedelta(days=EVENT_WINDOW_DAYS),
                event.start_date - pd.Timedelta(days=1),
            )
            post_mask |= ref["date"].between(
                event.end_date + pd.Timedelta(days=1),
                event.end_date + pd.Timedelta(days=EVENT_WINDOW_DAYS),
            )

        active = ref.loc[active_mask, "residual"]
        pre = ref.loc[pre_mask & ~active_mask, "residual"]
        post = ref.loc[post_mask & ~active_mask, "residual"]
        overlap = ref.loc[active_mask & ref["active_event_count"].gt(1), "residual"]
        static_intensity = float(EVENT_INTENSITY.get(str(name), 1.1))
        during_lift = float(active.median()) if len(active) >= PROFILE_MIN_ROWS else static_intensity
        pre_lift = float(pre.median()) if len(pre) >= PROFILE_MIN_ROWS else 1.0
        post_lift = float(post.median()) if len(post) >= PROFILE_MIN_ROWS else 1.0
        overlap_lift = float(overlap.median()) if len(overlap) >= PROFILE_MIN_ROWS else during_lift
        learned_intensity = np.clip((during_lift * 0.7) + (static_intensity * 0.3), 0.55, 3.0)
        rows.append({
            "event": str(name),
            "learned_intensity": round(float(learned_intensity), 4),
            "during_lift": round(float(np.clip(during_lift, 0.45, 3.5)), 4),
            "pre_lift": round(float(np.clip(pre_lift, 0.45, 3.0)), 4),
            "post_lift": round(float(np.clip(post_lift, 0.45, 3.0)), 4),
            "overlap_lift": round(float(np.clip(overlap_lift, 0.45, 3.8)), 4),
            "active_rows": int(len(active)),
            "pre_rows": int(len(pre)),
            "post_rows": int(len(post)),
            "overlap_rows": int(len(overlap)),
        })

    return pd.DataFrame(rows, columns=columns)


def classify_genre_label(label: str) -> str:
    text = str(label).lower()
    for group, keywords in GENRE_GROUP_KEYWORDS:
        if any(keyword.lower() in text for keyword in keywords):
            return group
    return "other"


def load_genre_groups() -> dict[str, str]:
    if not GENRE_NAMES_FILE.exists():
        return {}
    names = pd.read_csv(GENRE_NAMES_FILE, dtype={"genre_id": "string"})
    names["genre_group"] = names["genre_name"].map(classify_genre_label)
    return dict(zip(names["genre_id"].astype(str), names["genre_group"]))


GENRE_GROUPS = load_genre_groups()


def known_genres(data: pd.DataFrame) -> set[str]:
    return set(data["genre"].dropna().astype(str).unique())


def build_similar_genre_map(data: pd.DataFrame) -> dict[str, list[str]]:
    available = known_genres(data)
    all_genres = set(GENRE_GROUPS) or available
    missing = sorted(all_genres - available)
    similar: dict[str, list[str]] = {}
    for genre in missing:
        candidates = [candidate for candidate in SIMILAR_GENRE_OVERRIDES.get(genre, []) if candidate in available]
        if len(candidates) < 2:
            genre_group = GENRE_GROUPS.get(genre, "other")
            group_candidates = [
                candidate for candidate in available
                if GENRE_GROUPS.get(candidate, "other") == genre_group and candidate != genre
            ]
            counts = data[data["genre"].isin(group_candidates)].groupby("genre")["sales"].size().sort_values(ascending=False)
            candidates.extend([candidate for candidate in counts.index.tolist() if candidate not in candidates])
        similar[genre] = candidates[:6]
    return {genre: candidates for genre, candidates in similar.items() if candidates}


def add_features(frame: pd.DataFrame, events: pd.DataFrame, event_profiles: pd.DataFrame | None = None) -> pd.DataFrame:
    out = frame.copy()
    out["genre"] = out["genre"].astype(str)
    out["genre_group"] = out["genre"].map(GENRE_GROUPS).fillna("other")
    out["rank"] = out["rank"].astype(int)
    out["year"] = out["date"].dt.year
    out["month"] = out["date"].dt.month
    out["day"] = out["date"].dt.day
    out["dow"] = out["date"].dt.dayofweek
    out["dayofyear"] = out["date"].dt.dayofyear
    out["rank_log"] = np.log1p(out["rank"])
    out["inv_rank"] = 1 / out["rank"]
    out["rank_sqrt"] = np.sqrt(out["rank"])
    out["month_sin"] = np.sin(2 * np.pi * out["month"] / 12)
    out["month_cos"] = np.cos(2 * np.pi * out["month"] / 12)
    out["dow_sin"] = np.sin(2 * np.pi * out["dow"] / 7)
    out["dow_cos"] = np.cos(2 * np.pi * out["dow"] / 7)
    out["year_sin"] = np.sin(2 * np.pi * out["dayofyear"] / 366)
    out["year_cos"] = np.cos(2 * np.pi * out["dayofyear"] / 366)
    out = add_calendar_prior_features(out)
    out["event_count"] = 0
    out["event_intensity"] = 0.0
    out["major_event_intensity"] = 0.0
    out["learned_event_intensity"] = 0.0
    out["event_stack_intensity"] = 0.0
    out["event_lift_signal"] = 1.0
    out["event_overlap_lift"] = 1.0
    out["pre_event_lift"] = 1.0
    out["post_event_lift"] = 1.0
    out["days_to_event"] = 99
    out["days_after_event"] = 99
    out["has_supersale"] = 0
    out["has_marathon"] = 0
    out["has_zero_five"] = 0
    out["has_black_friday"] = 0
    out["event_day_index"] = 0
    out["event_day_share"] = 0.0
    active_names = [[] for _ in range(len(out))]
    if event_profiles is not None and not event_profiles.empty:
        profile_lookup = {
            str(row.event): row
            for row in event_profiles.itertuples(index=False)
        }
    else:
        profile_lookup = {}

    for event in events.itertuples(index=False):
        profile = profile_lookup.get(str(event.name))
        learned_intensity = float(getattr(profile, "learned_intensity", event.intensity)) if profile is not None else float(event.intensity)
        during_lift = float(getattr(profile, "during_lift", 1.0)) if profile is not None else 1.0
        pre_lift = float(getattr(profile, "pre_lift", 1.0)) if profile is not None else 1.0
        post_lift = float(getattr(profile, "post_lift", 1.0)) if profile is not None else 1.0
        overlap_lift = float(getattr(profile, "overlap_lift", during_lift)) if profile is not None else during_lift
        mask = out["date"].between(event.start_date, event.end_date)
        if mask.any():
            out.loc[mask, "event_count"] += 1
            out.loc[mask, "event_intensity"] = np.maximum(out.loc[mask, "event_intensity"], float(event.intensity))
            out.loc[mask, "learned_event_intensity"] = np.maximum(out.loc[mask, "learned_event_intensity"], learned_intensity)
            out.loc[mask, "event_stack_intensity"] += learned_intensity
            out.loc[mask, "event_lift_signal"] = np.maximum(out.loc[mask, "event_lift_signal"], during_lift)
            out.loc[mask, "event_overlap_lift"] = np.maximum(out.loc[mask, "event_overlap_lift"], overlap_lift)
            if event.intensity >= 1.8:
                out.loc[mask, "major_event_intensity"] = np.maximum(
                    out.loc[mask, "major_event_intensity"],
                    float(event.intensity),
                )
            if event.name == "supersale":
                out.loc[mask, "has_supersale"] = 1
            elif event.name == "marathon":
                out.loc[mask, "has_marathon"] = 1
            elif event.name == "zero-five":
                out.loc[mask, "has_zero_five"] = 1
            elif event.name == "black-friday":
                out.loc[mask, "has_black_friday"] = 1
            event_day = (out.loc[mask, "date"] - event.start_date).dt.days + 1
            duration = max(float(event.duration_days), 1.0)
            out.loc[mask, "event_day_index"] = np.maximum(out.loc[mask, "event_day_index"], event_day)
            out.loc[mask, "event_day_share"] = np.maximum(out.loc[mask, "event_day_share"], event_day / duration)
            positions = np.flatnonzero(mask.to_numpy())
            for position in positions:
                active_names[position].append(str(event.name))
        pre_mask = out["date"].between(
            event.start_date - pd.Timedelta(days=EVENT_WINDOW_DAYS),
            event.start_date - pd.Timedelta(days=1),
        )
        if pre_mask.any():
            days = (event.start_date - out.loc[pre_mask, "date"]).dt.days
            out.loc[pre_mask, "pre_event_lift"] = np.maximum(out.loc[pre_mask, "pre_event_lift"], pre_lift)
            out.loc[pre_mask, "days_to_event"] = np.minimum(out.loc[pre_mask, "days_to_event"], days)
        post_mask = out["date"].between(
            event.end_date + pd.Timedelta(days=1),
            event.end_date + pd.Timedelta(days=EVENT_WINDOW_DAYS),
        )
        if post_mask.any():
            days = (out.loc[post_mask, "date"] - event.end_date).dt.days
            out.loc[post_mask, "post_event_lift"] = np.maximum(out.loc[post_mask, "post_event_lift"], post_lift)
            out.loc[post_mask, "days_after_event"] = np.minimum(out.loc[post_mask, "days_after_event"], days)

    out["event_names"] = active_names
    out["event_label"] = [
        "|".join(sorted(names)) if names else "none"
        for names in active_names
    ]
    out["has_event"] = out["event_count"].gt(0).astype(int)
    out["event_stack_intensity"] = out["event_stack_intensity"].where(out["has_event"].eq(1), 0.0)
    out["event_overlap_lift"] = out["event_overlap_lift"].where(out["event_count"].gt(1), 1.0)
    return out


def add_reference_features(frame: pd.DataFrame, reference: pd.DataFrame) -> pd.DataFrame:
    out = add_features(frame, load_events(), None) if "event_label" not in frame.columns else frame.copy()
    reference = reference.copy()
    reference["genre"] = reference["genre"].astype(str)
    reference["rank"] = reference["rank"].astype(int)
    reference["genre_group"] = reference["genre"].map(GENRE_GROUPS).fillna("other")

    genre_rank_median = reference.groupby(["genre", "rank"])["sales"].median().rename("genre_rank_median")
    genre_rank_mean = reference.groupby(["genre", "rank"])["sales"].mean().rename("genre_rank_mean")
    genre_median = reference.groupby("genre")["sales"].median().rename("genre_median")
    rank_median = reference.groupby("rank")["sales"].median().rename("rank_median")
    rank1_median = reference[reference["rank"].eq(1)].groupby("genre")["sales"].median().rename("rank1_median")
    global_median = float(reference["sales"].median())
    global_rank1_median = float(reference[reference["rank"].eq(1)]["sales"].median())

    index = pd.MultiIndex.from_frame(out[["genre", "rank"]])
    out["genre_rank_median"] = genre_rank_median.reindex(index).to_numpy()
    out["genre_rank_mean"] = genre_rank_mean.reindex(index).to_numpy()
    out["genre_median"] = out["genre"].map(genre_median)
    out["rank_median"] = out["rank"].map(rank_median)
    out["rank1_median"] = out["genre"].map(rank1_median)
    out[["genre_rank_median", "genre_rank_mean", "genre_median", "rank_median"]] = out[[
        "genre_rank_median",
        "genre_rank_mean",
        "genre_median",
        "rank_median",
    ]].fillna(global_median)
    out["rank1_median"] = out["rank1_median"].fillna(global_rank1_median).clip(lower=1)

    for column in ["genre_rank_median", "genre_rank_mean", "genre_median", "rank_median"]:
        out[f"log_{column}"] = np.log1p(out[column])
    out["rank_share"] = (out["genre_rank_median"] / out["rank1_median"]).clip(0.01, 1.0)

    if "event_label" in reference.columns:
        reference["event_label"] = reference["event_label"].fillna("none").astype(str)
    else:
        ref_events = add_features(reference[["date", "genre", "rank"]].copy(), load_events(), None)
        reference["event_label"] = ref_events["event_label"].to_numpy()
    reference["baseline"] = reference.groupby(["genre", "rank"])["sales"].transform("median").clip(lower=1)
    reference["promotion_residual"] = (reference["sales"] / reference["baseline"]).replace([np.inf, -np.inf], np.nan)
    event_reference = reference[
        reference["event_label"].ne("none")
        & reference["promotion_residual"].notna()
        & reference["promotion_residual"].gt(0)
    ].copy()

    def residual_map(keys: list[str], minimum_rows: int) -> tuple[pd.Series, pd.Series]:
        if event_reference.empty:
            return pd.Series(dtype=float), pd.Series(dtype=float)
        grouped = event_reference.groupby(keys)["promotion_residual"].agg(["median", "size"])
        grouped = grouped[grouped["size"].ge(minimum_rows)]
        return grouped["median"], grouped["size"]

    genre_event_lift, genre_event_rows = residual_map(["genre", "event_label"], 12)
    group_event_lift, group_event_rows = residual_map(["genre_group", "event_label"], 30)
    rank_event_lift, rank_event_rows = residual_map(["rank", "event_label"], 30)
    event_lift, event_rows = residual_map(["event_label"], 50)

    genre_event_index = pd.MultiIndex.from_frame(out[["genre", "event_label"]])
    group_event_index = pd.MultiIndex.from_frame(out[["genre_group", "event_label"]])
    rank_event_index = pd.MultiIndex.from_frame(out[["rank", "event_label"]])
    out["historical_genre_event_lift"] = genre_event_lift.reindex(genre_event_index).to_numpy()
    out["historical_genre_event_rows"] = genre_event_rows.reindex(genre_event_index).to_numpy()
    out["historical_group_event_lift"] = group_event_lift.reindex(group_event_index).to_numpy()
    out["historical_group_event_rows"] = group_event_rows.reindex(group_event_index).to_numpy()
    out["historical_rank_event_lift"] = rank_event_lift.reindex(rank_event_index).to_numpy()
    out["historical_rank_event_rows"] = rank_event_rows.reindex(rank_event_index).to_numpy()
    out["historical_event_lift"] = out["event_label"].map(event_lift)
    out["historical_event_rows"] = out["event_label"].map(event_rows)

    for column in [
        "historical_genre_event_lift",
        "historical_group_event_lift",
        "historical_rank_event_lift",
        "historical_event_lift",
    ]:
        out[column] = out[column].fillna(1.0).clip(0.35, 3.5)
        out[f"log_{column}"] = np.log(out[column])
    for column in [
        "historical_genre_event_rows",
        "historical_group_event_rows",
        "historical_rank_event_rows",
        "historical_event_rows",
    ]:
        out[column] = out[column].fillna(0).clip(lower=0)
        out[f"log_{column}"] = np.log1p(out[column])

    out["historical_best_event_lift"] = out[[
        "historical_genre_event_lift",
        "historical_group_event_lift",
        "historical_rank_event_lift",
        "historical_event_lift",
    ]].max(axis=1)
    out["historical_event_confidence"] = out[[
        "historical_genre_event_rows",
        "historical_group_event_rows",
        "historical_rank_event_rows",
        "historical_event_rows",
    ]].max(axis=1)
    out["log_historical_event_confidence"] = np.log1p(out["historical_event_confidence"])
    out["spike_lift_signal"] = out[[
        "event_lift_signal",
        "event_overlap_lift",
        "historical_best_event_lift",
    ]].max(axis=1).fillna(1.0).clip(0.5, 4.0)
    out["log_spike_lift_signal"] = np.log(out["spike_lift_signal"])
    return out


def spike_sample_weight(target: pd.Series, features: pd.DataFrame) -> np.ndarray:
    values = target.to_numpy(dtype=float)
    positive = values[values > 0]
    baseline = float(np.median(positive)) if len(positive) else 1.0
    baseline = max(baseline, 1.0)
    sales_weight = np.sqrt(np.maximum(values, 1.0) / baseline)
    sales_weight = np.clip(sales_weight, 0.75, SPIKE_WEIGHT_MAX)

    event_intensity = features.get("event_intensity", pd.Series(0, index=features.index)).fillna(0).to_numpy(dtype=float)
    historical_lift = features.get("historical_best_event_lift", pd.Series(1, index=features.index)).fillna(1).to_numpy(dtype=float)
    event_weight = 1 + (np.maximum(event_intensity - 1.0, 0) * 0.24)
    event_weight *= 1 + (np.maximum(historical_lift - 1.0, 0) * 0.18)
    event_weight = np.clip(event_weight, 1.0, EVENT_WEIGHT_MAX)

    rank = features.get("rank", pd.Series(1, index=features.index)).fillna(1).to_numpy(dtype=float)
    rank_weight = np.clip(1.1 - ((rank - 1) * 0.018), 0.82, 1.1)

    weights = sales_weight * event_weight * rank_weight
    return np.clip(weights, 0.7, SPIKE_WEIGHT_MAX * EVENT_WEIGHT_MAX)


def model_pipeline() -> Pipeline:
    features = [
        "genre",
        "genre_group",
        "event_label",
        "rank",
        "rank_log",
        "inv_rank",
        "rank_sqrt",
        "year",
        "month",
        "day",
        "dow",
        "dayofyear",
        "month_sin",
        "month_cos",
        "dow_sin",
        "dow_cos",
        "year_sin",
        "year_cos",
        "calendar_seasonal_prior",
        "seafood_winter_signal",
        "seafood_year_end_signal",
        "rice_new_crop_signal",
        "rice_year_end_stockup_signal",
        "office_fiscal_start_signal",
        "office_new_hire_signal",
        "apparel_spring_summer_signal",
        "apparel_autumn_winter_signal",
        "apparel_gift_signal",
        "has_event",
        "event_count",
        "event_intensity",
        "major_event_intensity",
        "learned_event_intensity",
        "event_stack_intensity",
        "event_lift_signal",
        "event_overlap_lift",
        "pre_event_lift",
        "post_event_lift",
        "days_to_event",
        "days_after_event",
        "has_supersale",
        "has_marathon",
        "has_zero_five",
        "has_black_friday",
        "event_day_index",
        "event_day_share",
        "log_genre_rank_median",
        "log_genre_rank_mean",
        "log_genre_median",
        "log_rank_median",
        "rank_share",
        "historical_genre_event_lift",
        "historical_group_event_lift",
        "historical_rank_event_lift",
        "historical_event_lift",
        "historical_best_event_lift",
        "log_historical_genre_event_lift",
        "log_historical_group_event_lift",
        "log_historical_rank_event_lift",
        "log_historical_event_lift",
        "historical_genre_event_rows",
        "historical_group_event_rows",
        "historical_rank_event_rows",
        "historical_event_rows",
        "historical_event_confidence",
        "log_historical_genre_event_rows",
        "log_historical_group_event_rows",
        "log_historical_rank_event_rows",
        "log_historical_event_rows",
        "log_historical_event_confidence",
        "spike_lift_signal",
        "log_spike_lift_signal",
    ]
    categorical = ["genre", "genre_group", "event_label"]
    numeric = [col for col in features if col not in categorical]
    numeric_pipeline = Pipeline([("imputer", SimpleImputer(strategy="median"))])
    transformer = ColumnTransformer(
        transformers=[
            ("cat", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), categorical),
            ("num", numeric_pipeline, numeric),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )
    if HAS_XGBOOST:
        regressor = XGBRegressor(
            objective="reg:squarederror",
            n_estimators=420,
            learning_rate=0.035,
            max_depth=5,
            min_child_weight=8,
            subsample=0.88,
            colsample_bytree=0.86,
            reg_alpha=0.04,
            reg_lambda=1.35,
            tree_method="hist",
            n_jobs=4,
            random_state=SEED,
        )
    else:
        regressor = HistGradientBoostingRegressor(
            loss="squared_error",
            learning_rate=0.04,
            max_iter=650,
            max_leaf_nodes=127,
            min_samples_leaf=12,
            l2_regularization=0.02,
            random_state=SEED,
        )
    return Pipeline([("features", transformer), ("model", regressor)])


def genre_model_pipeline() -> Pipeline:
    features = [
        "event_label",
        "rank",
        "rank_log",
        "inv_rank",
        "rank_sqrt",
        "year",
        "month",
        "day",
        "dow",
        "dayofyear",
        "month_sin",
        "month_cos",
        "dow_sin",
        "dow_cos",
        "year_sin",
        "year_cos",
        "calendar_seasonal_prior",
        "seafood_winter_signal",
        "seafood_year_end_signal",
        "rice_new_crop_signal",
        "rice_year_end_stockup_signal",
        "office_fiscal_start_signal",
        "office_new_hire_signal",
        "apparel_spring_summer_signal",
        "apparel_autumn_winter_signal",
        "apparel_gift_signal",
        "has_event",
        "event_count",
        "event_intensity",
        "major_event_intensity",
        "learned_event_intensity",
        "event_stack_intensity",
        "event_lift_signal",
        "event_overlap_lift",
        "pre_event_lift",
        "post_event_lift",
        "days_to_event",
        "days_after_event",
        "has_supersale",
        "has_marathon",
        "has_zero_five",
        "has_black_friday",
        "event_day_index",
        "event_day_share",
        "log_genre_rank_median",
        "log_genre_rank_mean",
        "log_genre_median",
        "log_rank_median",
        "rank_share",
        "historical_genre_event_lift",
        "historical_group_event_lift",
        "historical_rank_event_lift",
        "historical_event_lift",
        "historical_best_event_lift",
        "log_historical_genre_event_lift",
        "log_historical_group_event_lift",
        "log_historical_rank_event_lift",
        "log_historical_event_lift",
        "historical_genre_event_rows",
        "historical_group_event_rows",
        "historical_rank_event_rows",
        "historical_event_rows",
        "historical_event_confidence",
        "log_historical_genre_event_rows",
        "log_historical_group_event_rows",
        "log_historical_rank_event_rows",
        "log_historical_event_rows",
        "log_historical_event_confidence",
        "spike_lift_signal",
        "log_spike_lift_signal",
    ]
    categorical = ["event_label"]
    numeric = [col for col in features if col not in categorical]
    numeric_pipeline = Pipeline([("imputer", SimpleImputer(strategy="median"))])
    transformer = ColumnTransformer(
        transformers=[
            ("cat", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), categorical),
            ("num", numeric_pipeline, numeric),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )
    if HAS_XGBOOST:
        regressor = XGBRegressor(
            objective="reg:squarederror",
            n_estimators=220,
            learning_rate=0.045,
            max_depth=4,
            min_child_weight=5,
            subsample=0.9,
            colsample_bytree=0.9,
            reg_alpha=0.03,
            reg_lambda=1.15,
            tree_method="hist",
            n_jobs=2,
            random_state=SEED,
        )
    else:
        regressor = HistGradientBoostingRegressor(
            loss="squared_error",
            learning_rate=0.07,
            max_iter=140,
            max_leaf_nodes=31,
            min_samples_leaf=12,
            l2_regularization=0.015,
            random_state=SEED,
        )
    return Pipeline([("features", transformer), ("model", regressor)])


def group_model_pipeline() -> Pipeline:
    features = [
        "genre",
        "event_label",
        "rank",
        "rank_log",
        "inv_rank",
        "rank_sqrt",
        "year",
        "month",
        "day",
        "dow",
        "dayofyear",
        "month_sin",
        "month_cos",
        "dow_sin",
        "dow_cos",
        "year_sin",
        "year_cos",
        "calendar_seasonal_prior",
        "seafood_winter_signal",
        "seafood_year_end_signal",
        "rice_new_crop_signal",
        "rice_year_end_stockup_signal",
        "office_fiscal_start_signal",
        "office_new_hire_signal",
        "apparel_spring_summer_signal",
        "apparel_autumn_winter_signal",
        "apparel_gift_signal",
        "has_event",
        "event_count",
        "event_intensity",
        "major_event_intensity",
        "learned_event_intensity",
        "event_stack_intensity",
        "event_lift_signal",
        "event_overlap_lift",
        "pre_event_lift",
        "post_event_lift",
        "days_to_event",
        "days_after_event",
        "has_supersale",
        "has_marathon",
        "has_zero_five",
        "has_black_friday",
        "event_day_index",
        "event_day_share",
        "log_genre_rank_median",
        "log_genre_rank_mean",
        "log_genre_median",
        "log_rank_median",
        "rank_share",
        "historical_genre_event_lift",
        "historical_group_event_lift",
        "historical_rank_event_lift",
        "historical_event_lift",
        "historical_best_event_lift",
        "log_historical_genre_event_lift",
        "log_historical_group_event_lift",
        "log_historical_rank_event_lift",
        "log_historical_event_lift",
        "historical_genre_event_rows",
        "historical_group_event_rows",
        "historical_rank_event_rows",
        "historical_event_rows",
        "historical_event_confidence",
        "log_historical_genre_event_rows",
        "log_historical_group_event_rows",
        "log_historical_rank_event_rows",
        "log_historical_event_rows",
        "log_historical_event_confidence",
        "spike_lift_signal",
        "log_spike_lift_signal",
    ]
    categorical = ["genre", "event_label"]
    numeric = [col for col in features if col not in categorical]
    numeric_pipeline = Pipeline([("imputer", SimpleImputer(strategy="median"))])
    transformer = ColumnTransformer(
        transformers=[
            ("cat", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), categorical),
            ("num", numeric_pipeline, numeric),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )
    if HAS_XGBOOST:
        regressor = XGBRegressor(
            objective="reg:squarederror",
            n_estimators=260,
            learning_rate=0.045,
            max_depth=4,
            min_child_weight=6,
            subsample=0.9,
            colsample_bytree=0.9,
            reg_alpha=0.03,
            reg_lambda=1.2,
            tree_method="hist",
            n_jobs=2,
            random_state=SEED,
        )
    else:
        regressor = HistGradientBoostingRegressor(
            loss="squared_error",
            learning_rate=0.06,
            max_iter=170,
            max_leaf_nodes=47,
            min_samples_leaf=16,
            l2_regularization=0.02,
            random_state=SEED,
        )
    return Pipeline([("features", transformer), ("model", regressor)])


def train_prediction_model(data: pd.DataFrame, events: pd.DataFrame) -> dict:
    event_profiles = build_event_profiles(data, events)
    print(f"learned {len(event_profiles)} event intensity profiles...", flush=True)
    data_with_events = add_features(data, events, event_profiles)
    data_ref = data.copy()
    data_ref["event_label"] = data_with_events["event_label"].to_numpy()
    global_features = add_reference_features(data_with_events, data_ref)
    global_model = model_pipeline()
    print("fitting global model...", flush=True)
    global_weights = spike_sample_weight(data["sales"], global_features)
    global_model.fit(global_features, np.log1p(data["sales"]), model__sample_weight=global_weights)

    genre_models = {}
    genre_refs = {}
    eligible = [
        (genre, group.copy())
        for genre, group in data.groupby("genre", sort=True)
        if len(group) >= MIN_GENRE_MODEL_ROWS and group["rank"].nunique() >= 4
    ]
    print(f"fitting {len(eligible)} genre models...", flush=True)
    for index, (genre, group) in enumerate(eligible, start=1):
        if index % 25 == 0 or index == len(eligible):
            print(f"  genre model {index}/{len(eligible)}", flush=True)
        group_features = add_features(group, events, event_profiles)
        group_ref = group.copy()
        group_ref["event_label"] = group_features["event_label"].to_numpy()
        features = add_reference_features(group_features, group_ref)
        model = genre_model_pipeline()
        weights = spike_sample_weight(group["sales"], features)
        model.fit(features, np.log1p(group["sales"]), model__sample_weight=weights)
        genre_models[str(genre)] = model
        genre_refs[str(genre)] = group_ref

    grouped = data.copy()
    grouped["genre_group"] = grouped["genre"].map(GENRE_GROUPS).fillna("other")
    group_models = {}
    group_refs = {}
    eligible_groups = [
        (genre_group, group.copy())
        for genre_group, group in grouped.groupby("genre_group", sort=True)
        if len(group) >= MIN_GROUP_MODEL_ROWS and group["genre"].nunique() >= 2 and genre_group != "other"
    ]
    print(f"fitting {len(eligible_groups)} group models...", flush=True)
    for index, (genre_group, group) in enumerate(eligible_groups, start=1):
        print(f"  group model {index}/{len(eligible_groups)}: {genre_group}", flush=True)
        group_features = add_features(group, events, event_profiles)
        group_ref = group.copy()
        group_ref["event_label"] = group_features["event_label"].to_numpy()
        features = add_reference_features(group_features, group_ref)
        model = group_model_pipeline()
        weights = spike_sample_weight(group["sales"], features)
        model.fit(features, np.log1p(group["sales"]), model__sample_weight=weights)
        group_models[str(genre_group)] = model
        group_refs[str(genre_group)] = group_ref

    bundle = {
        "global": global_model,
        "global_ref": data_ref,
        "genre_models": genre_models,
        "genre_refs": genre_refs,
        "group_models": group_models,
        "group_refs": group_refs,
        "event_profiles": event_profiles,
    }
    print("building spike-aware calibration...", flush=True)
    calibration_data = data
    if len(calibration_data) > CALIBRATION_SAMPLE_ROWS:
        calibration_data = calibration_data.sample(CALIBRATION_SAMPLE_ROWS, random_state=SEED).sort_values(["date", "genre", "rank"])
    raw_predictions = predict_with_models(bundle, calibration_data, events, apply_calibration=False)
    bundle["calibration"] = build_calibration(calibration_data, raw_predictions, events, event_profiles)
    return bundle


def shrunk_factor(actual_sum: float, predicted_sum: float, rows: int, strength: int) -> float:
    if predicted_sum <= 0 or actual_sum <= 0 or rows <= 0:
        return 1.0
    raw_factor = float(actual_sum) / float(predicted_sum)
    weight = rows / (rows + strength)
    factor = 1.0 + ((raw_factor - 1.0) * weight)
    return float(np.clip(factor, MIN_CALIBRATION_FACTOR, MAX_CALIBRATION_FACTOR))


def build_calibration(
    data: pd.DataFrame,
    raw_predictions: pd.Series,
    events: pd.DataFrame,
    event_profiles: pd.DataFrame | None,
) -> dict:
    calibration = data[["date", "genre", "rank", "sales"]].copy()
    calibration["genre"] = calibration["genre"].astype(str)
    calibration["rank"] = calibration["rank"].astype(int)
    calibration["genre_group"] = calibration["genre"].map(GENRE_GROUPS).fillna("other")
    calibration["predicted_sales"] = raw_predictions.reindex(calibration.index).to_numpy(dtype=float)
    calibration = calibration[
        calibration["sales"].gt(0)
        & calibration["predicted_sales"].gt(0)
        & np.isfinite(calibration["predicted_sales"])
    ].copy()
    if calibration.empty:
        return {
            "global": 1.0,
            "genre": {},
            "genre_rank": {},
            "genre_group": {},
            "genre_event": {},
        }

    event_frame = add_features(calibration[["date", "genre", "rank"]].copy(), events, event_profiles)
    calibration["event_label"] = event_frame["event_label"].to_numpy()

    global_factor = shrunk_factor(
        calibration["sales"].sum(),
        calibration["predicted_sales"].sum(),
        len(calibration),
        strength=0,
    )

    def grouped_factors(keys: list[str], min_rows: int, strength: int) -> dict:
        factors = {}
        grouped = calibration.groupby(keys, sort=False).agg(
            actual=("sales", "sum"),
            predicted=("predicted_sales", "sum"),
            rows=("sales", "size"),
        ).reset_index()
        grouped = grouped[grouped["rows"].ge(min_rows)]
        for row in grouped.itertuples(index=False):
            key_values = tuple(getattr(row, key) for key in keys)
            key = key_values[0] if len(key_values) == 1 else key_values
            factors[key] = shrunk_factor(row.actual, row.predicted, int(row.rows), strength)
        return factors

    return {
        "global": global_factor,
        "genre": grouped_factors(["genre"], MIN_GENRE_CALIBRATION_ROWS, 120),
        "genre_rank": grouped_factors(["genre", "rank"], MIN_RANK_CALIBRATION_ROWS, 70),
        "genre_group": grouped_factors(["genre_group"], MIN_GROUP_CALIBRATION_ROWS, 180),
        "genre_event": grouped_factors(["genre", "event_label"], MIN_EVENT_CALIBRATION_ROWS, 100),
    }


def apply_prediction_calibration(predictions: pd.Series, frame: pd.DataFrame, calibration: dict | None) -> pd.Series:
    if not calibration:
        return predictions.clip(lower=0)

    rows = frame.copy()
    rows["genre"] = rows["genre"].astype(str)
    rows["rank"] = rows["rank"].astype(int)
    rows["genre_group"] = rows["genre"].map(GENRE_GROUPS).fillna("other")
    if "event_label" not in rows.columns:
        rows["event_label"] = "none"

    global_factor = float(calibration.get("global", 1.0))
    genre_factors = calibration.get("genre", {})
    genre_rank_factors = calibration.get("genre_rank", {})
    group_factors = calibration.get("genre_group", {})
    genre_event_factors = calibration.get("genre_event", {})

    factors = []
    for row in rows.itertuples(index=False):
        genre = str(row.genre)
        rank = int(row.rank)
        event_label = str(getattr(row, "event_label", "none"))
        genre_group = str(row.genre_group)
        factor = global_factor
        if genre_group in group_factors:
            factor *= group_factors[genre_group] / global_factor
        if genre in genre_factors:
            factor *= genre_factors[genre] / global_factor
        if (genre, rank) in genre_rank_factors:
            factor *= genre_rank_factors[(genre, rank)] / genre_factors.get(genre, global_factor)
        if event_label != "none" and (genre, event_label) in genre_event_factors:
            factor *= genre_event_factors[(genre, event_label)] / genre_factors.get(genre, global_factor)
        factors.append(float(np.clip(factor, MIN_CALIBRATION_FACTOR, MAX_CALIBRATION_FACTOR)))

    calibrated = predictions.to_numpy(dtype=float) * np.asarray(factors, dtype=float)
    return pd.Series(calibrated, index=predictions.index).clip(lower=0)


def predict_with_models(
    model_bundle: dict,
    frame: pd.DataFrame,
    events: pd.DataFrame,
    apply_calibration: bool = True,
) -> pd.Series:
    out = pd.Series(index=frame.index, dtype=float)
    genre_models = model_bundle.get("genre_models", {})
    genre_refs = model_bundle.get("genre_refs", {})
    group_models = model_bundle.get("group_models", {})
    group_refs = model_bundle.get("group_refs", {})
    global_model = model_bundle["global"]
    global_ref = model_bundle["global_ref"]
    event_profiles = model_bundle.get("event_profiles")
    featured_frame = add_features(frame, events, event_profiles)

    for genre, index in frame.groupby("genre").groups.items():
        rows = frame.loc[index]
        featured_rows = featured_frame.loc[index]
        genre = str(genre)
        genre_group = featured_rows["genre_group"].iat[0]
        if genre in genre_models:
            features = add_reference_features(featured_rows, genre_refs[genre])
            genre_predictions = np.expm1(genre_models[genre].predict(features)).clip(min=0)
            if genre_group in group_models and len(genre_refs[genre]) < 500:
                group_features = add_reference_features(featured_rows, group_refs[genre_group])
                group_predictions = np.expm1(group_models[genre_group].predict(group_features)).clip(min=0)
                genre_weight = min(0.82, max(0.55, len(genre_refs[genre]) / 600))
                predictions = (genre_predictions * genre_weight) + (group_predictions * (1 - genre_weight))
            else:
                predictions = genre_predictions
        elif genre_group in group_models:
            features = add_reference_features(featured_rows, group_refs[genre_group])
            predictions = np.expm1(group_models[genre_group].predict(features)).clip(min=0)
        else:
            features = add_reference_features(featured_rows, global_ref)
            predictions = np.expm1(global_model.predict(features)).clip(min=0)
        out.loc[index] = predictions
    if apply_calibration:
        out = apply_prediction_calibration(out, featured_frame, model_bundle.get("calibration"))
    return out


def metric_row(actual: pd.Series, predicted: pd.Series) -> dict:
    actual_values = actual.to_numpy(dtype=float)
    predicted_values = predicted.to_numpy(dtype=float)
    absolute_error = np.abs(predicted_values - actual_values)
    ape = absolute_error / np.maximum(actual_values, 1.0)
    return {
        "rows": int(len(actual_values)),
        "actual_sales": round(float(actual_values.sum()), 2),
        "predicted_sales": round(float(predicted_values.sum()), 2),
        "wmape": round(float(absolute_error.sum() / actual_values.sum()), 6) if actual_values.sum() else np.nan,
        "median_ape": round(float(np.median(ape)), 6) if len(ape) else np.nan,
        "mean_ape": round(float(np.mean(ape)), 6) if len(ape) else np.nan,
        "within_25_percent": round(float((ape <= 0.25).mean()), 6) if len(ape) else np.nan,
        "within_50_percent": round(float((ape <= 0.50).mean()), 6) if len(ape) else np.nan,
        "median_absolute_error": round(float(median_absolute_error(actual_values, predicted_values)), 2) if len(ape) else np.nan,
    }


def interval_factors(test: pd.DataFrame) -> tuple[pd.DataFrame, float, float]:
    scored = test[test["predicted_sales"].gt(0)].copy()
    scored["ratio"] = ((scored["sales"] + 1) / (scored["predicted_sales"] + 1)).clip(0.1, 10.0)
    global_low = float(scored["ratio"].quantile(0.025))
    global_high = float(scored["ratio"].quantile(0.975))
    counts = scored.groupby("genre")["ratio"].size()
    factors = scored.groupby("genre")["ratio"].quantile([0.025, 0.975]).unstack()
    factors.columns = ["low_factor", "high_factor"]
    factors = factors[counts.ge(20)].reset_index()
    factors["low_factor"] = factors["low_factor"].clip(lower=global_low, upper=1.0)
    factors["high_factor"] = factors["high_factor"].clip(lower=1.0, upper=global_high)
    return factors, global_low, global_high


def smooth_profile(values: np.ndarray) -> np.ndarray:
    profile = np.asarray(values, dtype=float).copy()
    profile = np.where(np.isfinite(profile) & (profile > 0), profile, np.nan)
    if np.isnan(profile).all():
        profile = 1 / np.sqrt(np.arange(1, len(profile) + 1, dtype=float))
    else:
        fallback = 1 / np.sqrt(np.arange(1, len(profile) + 1, dtype=float))
        if np.isnan(profile[0]):
            profile[0] = np.nanmax(profile)
        for index in range(1, len(profile)):
            if np.isnan(profile[index]):
                profile[index] = min(profile[index - 1] * 0.94, fallback[index])
        for index in range(len(profile) - 2, -1, -1):
            if profile[index] < profile[index + 1]:
                profile[index] = profile[index + 1]

    profile = np.maximum.accumulate(profile[::-1])[::-1]
    profile = np.clip(profile, 0.03, None)
    if profile[0] <= 0:
        profile[0] = np.nanmax(profile) or 1.0
    profile = profile / profile[0]
    return profile


def rank_profiles(reference: pd.DataFrame) -> tuple[np.ndarray, dict[str, np.ndarray], dict[str, int]]:
    ref = reference.copy()
    ref["genre"] = ref["genre"].astype(str)
    ref["rank"] = ref["rank"].astype(int)
    ref = ref[ref["rank"].between(1, DISPLAY_RANK) & ref["sales"].gt(0)].copy()
    if ref.empty:
        global_profile = smooth_profile(np.array([1 / np.sqrt(rank) for rank in range(1, DISPLAY_RANK + 1)]))
        return global_profile, {}, {}

    ref["group_key"] = ref["date"].dt.strftime("%Y-%m-%d") + "|" + ref["genre"]
    ref["group_max"] = ref.groupby("group_key")["sales"].transform("max").clip(lower=1)
    ref["rank_ratio"] = (ref["sales"] / ref["group_max"]).clip(0.01, 1.0)

    global_values = (
        ref.groupby("rank")["rank_ratio"]
        .median()
        .reindex(range(1, ESTIMATE_RANK + 1))
        .to_numpy(dtype=float)
    )
    global_profile = smooth_profile(global_values)

    genre_profiles: dict[str, np.ndarray] = {}
    genre_counts: dict[str, int] = {}
    for genre, group in ref.groupby("genre"):
        rows = len(group)
        ranks = group["rank"].nunique()
        genre_counts[str(genre)] = rows
        if rows < MIN_GENRE_PROFILE_ROWS or ranks < MIN_GENRE_PROFILE_RANKS:
            continue
        genre_values = (
            group.groupby("rank")["rank_ratio"]
            .median()
            .reindex(range(1, ESTIMATE_RANK + 1))
            .to_numpy(dtype=float)
        )
        genre_profile = smooth_profile(genre_values)
        weight = min(0.85, max(0.35, rows / 500))
        genre_profiles[str(genre)] = smooth_profile((genre_profile * weight) + (global_profile * (1 - weight)))
    return global_profile, genre_profiles, genre_counts


def apply_rank_curve_shape(frame: pd.DataFrame, reference: pd.DataFrame, prediction_col: str = "predicted_sales") -> pd.DataFrame:
    if frame.empty or prediction_col not in frame.columns:
        return frame

    # Keep the rank display logically descending without overriding the boosted
    # model's learned genre/date/promotion shape. The older curve blend looked
    # cleaner in sparse genres, but it made holdout WMAPE worse on the expanded
    # dataset.
    out = frame.sort_values(["date", "genre", "rank"]).copy()
    adjusted_groups = []
    for _, group in out.groupby(["date", "genre"], sort=False):
        group = group.copy()
        values = group[prediction_col].to_numpy(dtype=float)
        group[prediction_col] = spread_rank_values(values, target_total=float(np.nansum(values)))
        adjusted_groups.append(group)
    return pd.concat(adjusted_groups, ignore_index=True)


def spread_rank_values(values: np.ndarray, target_total: float | None = None) -> np.ndarray:
    fixed = np.asarray(values, dtype=float).copy()
    fixed = np.nan_to_num(fixed, nan=0.0, posinf=0.0, neginf=0.0).clip(min=0)
    if len(fixed) < 2 or fixed.max() <= 0:
        return fixed

    for index in range(1, len(fixed)):
        cap = fixed[index - 1] * 0.965
        if fixed[index] >= cap:
            fixed[index] = cap

    for index in range(1, len(fixed)):
        rank = index + 1
        min_ratio = 0.62 if rank <= 5 else 0.72 if rank <= 20 else 0.82
        floor = fixed[index - 1] * min_ratio
        if 0 < fixed[index] < floor:
            fixed[index] = floor

    if target_total and fixed.sum() > 0:
        fixed *= float(target_total) / fixed.sum()
    return fixed


def evaluate_holdout_split(
    data: pd.DataFrame,
    events: pd.DataFrame,
    seed: int,
    split: int,
) -> tuple[pd.DataFrame, dict]:
    rng = np.random.default_rng(seed)
    holdout_mask = rng.random(len(data)) < HOLDOUT_RATE
    if holdout_mask.sum() == 0:
        holdout_mask[rng.integers(0, len(data))] = True

    raw_train = data.loc[~holdout_mask].copy()
    raw_test = data.loc[holdout_mask].copy()
    model = train_prediction_model(raw_train, events)
    test = add_features(raw_test, events, model.get("event_profiles"))
    test["predicted_sales"] = predict_with_models(model, raw_test, events)
    test = apply_rank_curve_shape(test, raw_train, "predicted_sales")

    split_metrics = metric_row(test["sales"], test["predicted_sales"])
    split_metrics.update({
        "split": split,
        "seed": seed,
        "model": "genre_group_event_profile_xgboost_gradient_boosted_trees" if HAS_XGBOOST else "genre_group_event_profile_sklearn_gradient_boosted_trees",
        "holdout_rate": HOLDOUT_RATE,
        "train_rows": int(len(raw_train)),
        "test_rows": int(len(test)),
        "training_source": "TENKi known rank-sales rows only; event intensity profiles, genre models, group models, then global fallback",
    })
    test["split"] = split
    return test, split_metrics


def evaluate_holdout(
    data: pd.DataFrame,
    events: pd.DataFrame,
    fit_final_model: bool,
) -> tuple[dict | None, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, float, float]:
    scored_splits = []
    split_metrics = []
    for split in range(VALIDATION_RUNS):
        seed = SEED + (split * 7919)
        print(f"validation split {split + 1}/{VALIDATION_RUNS}...", flush=True)
        scored, metrics = evaluate_holdout_split(data, events, seed, split + 1)
        scored_splits.append(scored)
        split_metrics.append(metrics)

    scored = pd.concat(scored_splits, ignore_index=True)
    factors, global_low, global_high = interval_factors(scored)

    overall = metric_row(scored["sales"], scored["predicted_sales"])
    overall.update({
        "model": "genre_group_event_profile_xgboost_gradient_boosted_trees" if HAS_XGBOOST else "genre_group_event_profile_sklearn_gradient_boosted_trees",
        "holdout_rate": HOLDOUT_RATE,
        "validation_runs": VALIDATION_RUNS,
        "hidden_rows": int(len(scored)),
        "training_source": "TENKi known rank-sales rows only; event intensity profiles, genre models, group models, then global fallback",
    })

    by_genre = []
    for genre, group in scored.groupby("genre", sort=True):
        row = metric_row(group["sales"], group["predicted_sales"])
        row["genre"] = genre
        by_genre.append(row)

    by_event = []
    exploded = scored[["sales", "predicted_sales", "event_names"]].explode("event_names")
    exploded["event"] = exploded["event_names"].fillna("none")
    for event, group in exploded.groupby("event", sort=True):
        row = metric_row(group["sales"], group["predicted_sales"])
        row["event"] = event
        by_event.append(row)

    final_model = None
    if fit_final_model:
        print("fitting final model bundle...", flush=True)
        final_model = train_prediction_model(data, events)
    return (
        final_model,
        pd.DataFrame([overall]),
        pd.DataFrame(split_metrics),
        pd.DataFrame(by_genre),
        pd.DataFrame(by_event),
        factors,
        global_low,
        global_high,
    )


def prediction_grid(rank_rows: pd.DataFrame, training_data: pd.DataFrame) -> pd.DataFrame:
    date_genres = []
    if not rank_rows.empty:
        date_genres.append(rank_rows[["date", "genre"]].drop_duplicates())
    by_month_frames = []
    for path in sorted(BY_MONTH_DIR.glob("*.csv")):
        frame = pd.read_csv(path, usecols=["date", "genre"], dtype={"genre": "string"})
        frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
        by_month_frames.append(frame.dropna(subset=["date", "genre"]).drop_duplicates())
    if by_month_frames:
        date_genres.append(pd.concat(by_month_frames, ignore_index=True).drop_duplicates())
    if date_genres:
        date_genres = pd.concat(date_genres, ignore_index=True).drop_duplicates()
    else:
        date_genres = training_data[["date", "genre"]].drop_duplicates()
    all_dates = pd.DataFrame({"date": sorted(date_genres["date"].dropna().unique())})
    all_genres = pd.DataFrame({"genre": sorted(date_genres["genre"].dropna().astype(str).unique())})
    ranks = pd.DataFrame({"rank": list(range(1, ESTIMATE_RANK + 1))})
    grid = all_dates.merge(all_genres, how="cross").merge(ranks, how="cross")
    return grid.sort_values(["date", "genre", "rank"]).reset_index(drop=True)


def prediction_date_genres(rank_rows: pd.DataFrame, training_data: pd.DataFrame) -> pd.DataFrame:
    date_genres = []
    if not rank_rows.empty:
        date_genres.append(rank_rows[["date", "genre"]].drop_duplicates())
    by_month_frames = []
    for path in sorted(BY_MONTH_DIR.glob("*.csv")):
        frame = pd.read_csv(path, usecols=["date", "genre"], dtype={"genre": "string"})
        frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
        by_month_frames.append(frame.dropna(subset=["date", "genre"]).drop_duplicates())
    if by_month_frames:
        date_genres.append(pd.concat(by_month_frames, ignore_index=True).drop_duplicates())
    if date_genres:
        return pd.concat(date_genres, ignore_index=True).drop_duplicates()
    return training_data[["date", "genre"]].drop_duplicates()


def prediction_grid_for_dates(dates: pd.Series, genres: pd.Series) -> pd.DataFrame:
    all_dates = pd.DataFrame({"date": sorted(pd.to_datetime(dates).dropna().unique())})
    all_genres = pd.DataFrame({"genre": sorted(genres.dropna().astype(str).unique())})
    ranks = pd.DataFrame({"rank": list(range(1, ESTIMATE_RANK + 1))})
    return all_dates.merge(all_genres, how="cross").merge(ranks, how="cross").sort_values(["date", "genre", "rank"]).reset_index(drop=True)


def enforce_rank_order(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.sort_values(["date", "genre", "rank"]).copy()
    adjusted = []
    for _, group in out.groupby(["date", "genre"], sort=False):
        values = group["sales"].to_numpy(dtype=float)
        values = spread_rank_values(values, target_total=float(np.nansum(values)))
        group = group.copy()
        group["sales"] = values
        adjusted.append(group)
    return pd.concat(adjusted, ignore_index=True)


def train_event_factors(data: pd.DataFrame, curve_rows: pd.DataFrame, events: pd.DataFrame) -> pd.DataFrame:
    if events.empty:
        return pd.DataFrame(columns=["genre", "event", "factor", "rows"])

    baseline_map = {
        (str(row.genre), int(row.rank)): float(row.estimated_sales)
        for row in curve_rows.itertuples(index=False)
    }
    event_data = add_features(data, events)
    rows = []
    for row in event_data.itertuples(index=False):
        baseline = baseline_map.get((str(row.genre), int(row.rank)))
        if not baseline or not np.isfinite(baseline) or baseline <= 0:
            continue
        if not row.event_names:
            continue
        residual = float(row.sales) / baseline
        if not np.isfinite(residual) or residual <= 0:
            continue
        for event_name in row.event_names:
            rows.append({
                "genre": str(row.genre),
                "event": str(event_name),
                "residual": residual,
            })

    if not rows:
        return pd.DataFrame(columns=["genre", "event", "factor", "rows"])

    residuals = pd.DataFrame(rows)
    factor_rows = []
    by_genre_event = residuals.groupby(["genre", "event"])["residual"].agg(["median", "count"]).reset_index()
    by_genre_event = by_genre_event[by_genre_event["count"].ge(MIN_EVENT_FACTOR_ROWS)]
    for row in by_genre_event.itertuples(index=False):
        factor_rows.append({
            "genre": row.genre,
            "event": row.event,
            "factor": round(float(np.clip(row.median, MIN_EVENT_FACTOR, MAX_EVENT_FACTOR)), 4),
            "rows": int(row.count),
        })

    by_event = residuals.groupby("event")["residual"].agg(["median", "count"]).reset_index()
    by_event = by_event[by_event["count"].ge(MIN_GLOBAL_EVENT_FACTOR_ROWS)]
    for row in by_event.itertuples(index=False):
        factor_rows.append({
            "genre": GLOBAL_GENRE,
            "event": row.event,
            "factor": round(float(np.clip(row.median, MIN_EVENT_FACTOR, MAX_EVENT_FACTOR)), 4),
            "rows": int(row.count),
        })

    return pd.DataFrame(factor_rows).sort_values(["genre", "event"])


def write_prediction_outputs(
    model: Pipeline,
    rank_rows: pd.DataFrame,
    training_data: pd.DataFrame,
    events: pd.DataFrame,
    factors: pd.DataFrame,
    global_low: float,
    global_high: float,
) -> None:
    staging_dir = RANK_DIR.with_name(f"{RANK_DIR.name}-new")
    staging_dir.mkdir(parents=True, exist_ok=True)
    for old_file in staging_dir.glob("*.csv"):
        old_file.unlink()
    RANK_DIR.mkdir(parents=True, exist_ok=True)
    date_genres = prediction_date_genres(rank_rows, training_data)
    all_genres = date_genres["genre"].astype(str).drop_duplicates()
    date_genres["month"] = date_genres["date"].dt.strftime("%Y-%m")
    curve_parts = []
    total_rows = 0

    for month, group in date_genres.groupby("month", sort=True):
        grid = prediction_grid_for_dates(group["date"], all_genres)
        total_rows += len(grid)
        print(f"predicting {month}: {len(grid):,} rank rows", flush=True)
        grid["sales"] = predict_with_models(model, grid, events)
        grid = apply_rank_curve_shape(
            grid.rename(columns={"sales": "predicted_sales"}),
            training_data,
            "predicted_sales",
        ).rename(columns={"predicted_sales": "sales"})
        grid = enforce_rank_order(grid)
        grid = grid.merge(factors, on="genre", how="left")
        grid["low_factor"] = grid["low_factor"].fillna(global_low).clip(0.1, 1.0)
        grid["high_factor"] = grid["high_factor"].fillna(global_high).clip(1.0, 10.0)
        grid["sales_low"] = (grid["sales"] * grid["low_factor"]).round(2)
        grid["sales_high"] = (grid["sales"] * grid["high_factor"]).round(2)
        grid["date"] = grid["date"].dt.strftime("%Y-%m-%d")
        grid["sales"] = grid["sales"].round(2)
        grid["shop"] = ""
        grid["source"] = "estimated"
        grid["lower_rank"] = ""
        grid["upper_rank"] = ""
        grid["lower_sales"] = ""
        grid["upper_sales"] = ""
        output = grid[[
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
        ]]
        output.to_csv(staging_dir / f"{month}.csv", index=False)
        curve_parts.append(
            output.groupby(["genre", "rank"], as_index=False)["sales"]
            .median()
        )

    print(f"predicted {total_rows:,} rank rows", flush=True)
    curve_rows = (
        pd.concat(curve_parts, ignore_index=True)
        .groupby(["genre", "rank"], as_index=False)["sales"]
        .median()
        .rename(columns={"sales": "estimated_sales"})
        .sort_values(["genre", "rank"])
    )
    for old_file in RANK_DIR.glob("*.csv"):
        old_file.unlink()
    for new_file in staging_dir.glob("*.csv"):
        new_file.replace(RANK_DIR / new_file.name)
    staging_dir.rmdir()
    curve_rows.to_csv(CURVE_OUT, index=False)
    train_event_factors(training_data, curve_rows, events).to_csv(EVENT_FACTOR_OUT, index=False)


def previous_wmape() -> float | None:
    if not METRICS_OUT.exists():
        return None
    try:
        metrics = pd.read_csv(METRICS_OUT)
    except Exception:
        return None
    if metrics.empty or "wmape" not in metrics:
        return None
    return float(metrics["wmape"].iat[0])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--publish-output",
        action="store_true",
        help="Write website metrics and monthly prediction CSVs after validation improves WMAPE.",
    )
    parser.add_argument(
        "--force-publish",
        action="store_true",
        help="Write website CSVs even when validation WMAPE is unchanged or worse.",
    )
    args = parser.parse_args()

    rank_rows = read_rank_files()
    training_data = load_or_create_training_data(rank_rows)
    events = load_events()
    baseline_wmape = previous_wmape()
    model, overall, by_split, by_genre, by_event, factors, global_low, global_high = evaluate_holdout(
        training_data,
        events,
        fit_final_model=args.publish_output,
    )
    new_wmape = float(overall["wmape"].iat[0])
    improved = baseline_wmape is None or new_wmape < baseline_wmape

    should_publish = args.publish_output and (improved or args.force_publish)

    if should_publish:
        write_prediction_outputs(model, rank_rows, training_data, events, factors, global_low, global_high)
        overall.to_csv(METRICS_OUT, index=False)
        by_split.to_csv(METRICS_BY_SPLIT_OUT, index=False)
        by_genre.to_csv(METRICS_BY_GENRE_OUT, index=False)
        by_event.to_csv(METRICS_BY_EVENT_OUT, index=False)
    elif args.publish_output:
        print(
            f"skipped publishing because WMAPE did not improve: "
            f"new={new_wmape} previous={baseline_wmape}",
            flush=True,
        )
    else:
        print("validation-only run; website CSVs were not written", flush=True)

    print(f"training rows: {len(training_data):,}")
    print(f"model: {overall['model'].iat[0]}")
    print(f"validation runs: {VALIDATION_RUNS}")
    print(f"wmape: {overall['wmape'].iat[0]}")
    print(f"previous_wmape: {baseline_wmape}")
    print(f"improved: {improved}")
    print(f"median_ape: {overall['median_ape'].iat[0]}")
    print(f"within_25_percent: {overall['within_25_percent'].iat[0]}")
    if should_publish:
        print(f"wrote model estimates to {RANK_DIR}")
        print(f"wrote metrics to {METRICS_OUT}, {METRICS_BY_SPLIT_OUT}, {METRICS_BY_GENRE_OUT}, {METRICS_BY_EVENT_OUT}")


if __name__ == "__main__":
    main()
