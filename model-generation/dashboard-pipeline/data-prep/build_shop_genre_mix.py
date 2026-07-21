from __future__ import annotations

import pandas as pd

from prep_paths import DASHBOARD_ROOT

ROOT = DASHBOARD_ROOT
SOURCE_DIR = ROOT / "data" / "by-month"
OUTPUT = ROOT / "data" / "shop_genre_mix.csv"
MAX_GENRES_PER_SHOP = 8


def main() -> None:
    frames = []
    for path in sorted(SOURCE_DIR.glob("*.csv")):
        frame = pd.read_csv(
            path,
            usecols=["shop", "genre", "sales", "units"],
            dtype={"shop": "string", "genre": "string", "sales": "float64", "units": "float64"},
        )
        frames.append(frame)
    data = pd.concat(frames, ignore_index=True)
    data["sales"] = data["sales"].clip(lower=0)
    data["units"] = data["units"].clip(lower=0)

    shop_genre = data.groupby(["shop", "genre"], as_index=False)[["sales", "units"]].sum()
    shop_genre = shop_genre[shop_genre["sales"].gt(0)].copy()
    genre_totals = shop_genre.groupby("genre", as_index=False)["sales"].sum().rename(columns={"sales": "genre_sales"})
    shop_totals = shop_genre.groupby("shop", as_index=False)["sales"].sum().rename(columns={"sales": "shop_sales"})

    mix = shop_genre.merge(genre_totals, on="genre", how="left").merge(shop_totals, on="shop", how="left")
    mix["genre_share"] = (mix["sales"] / mix["genre_sales"].replace(0, pd.NA)).fillna(0).clip(0, 1)
    mix["shop_mix_share"] = (mix["sales"] / mix["shop_sales"].replace(0, pd.NA)).fillna(0).clip(0, 1)
    mix["unit_rate"] = (mix["units"] / mix["sales"].replace(0, pd.NA)).fillna(0).clip(lower=0)
    mix = mix.sort_values(["shop", "sales"], ascending=[True, False])
    mix["shop_rank"] = mix.groupby("shop").cumcount() + 1
    mix = mix[mix["shop_rank"].le(MAX_GENRES_PER_SHOP)].copy()

    mix[[
        "shop",
        "genre",
        "shop_rank",
        "sales",
        "units",
        "genre_sales",
        "shop_sales",
        "genre_share",
        "shop_mix_share",
        "unit_rate",
    ]].to_csv(OUTPUT, index=False)
    print(f"Wrote {len(mix):,} shop genre mix rows to {OUTPUT}")


if __name__ == "__main__":
    main()
