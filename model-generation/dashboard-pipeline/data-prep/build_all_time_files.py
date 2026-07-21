import csv
from collections import defaultdict

from prep_paths import DASHBOARD_ROOT, WORK_ROOT


ROOT = DASHBOARD_ROOT
DATA = ROOT / "data"
OUT = DATA / "all-time"


def add_metric(target, row, *fields):
    for field in fields:
        target[field] += int(float(row.get(field, 0) or 0))


def write_rows(path, fieldnames, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


summary = defaultdict(lambda: defaultdict(int))
monthly = defaultdict(lambda: defaultdict(int))

for source in sorted((DATA / "by-month").glob("*.csv")):
    with source.open(newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            summary_key = (row["shop"], row["genre"])
            month_key = (row["date"][:7] + "-01", row["shop"], row["genre"])
            add_metric(summary[summary_key], row, "sales", "units", "page_views")
            add_metric(monthly[month_key], row, "sales", "units", "page_views")

write_rows(
    OUT / "summary.csv",
    ["shop", "genre", "sales", "units", "page_views"],
    [
        {
            "shop": shop,
            "genre": genre,
            "sales": values["sales"],
            "units": values["units"],
            "page_views": values["page_views"],
        }
        for (shop, genre), values in sorted(summary.items())
    ],
)

write_rows(
    OUT / "monthly.csv",
    ["date", "shop", "genre", "sales", "units", "page_views"],
    [
        {
            "date": date,
            "shop": shop,
            "genre": genre,
            "sales": values["sales"],
            "units": values["units"],
            "page_views": values["page_views"],
        }
        for (date, shop, genre), values in sorted(monthly.items())
    ],
)

items = defaultdict(lambda: defaultdict(int))

for source in sorted((DATA / "items-by-month").glob("*.csv")):
    with source.open(newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            key = (row["shop"], row["genre"], row["item"])
            add_metric(items[key], row, "sales", "units")

write_rows(
    OUT / "items.csv",
    ["shop", "genre", "item", "sales", "units"],
    [
        {
            "shop": shop,
            "genre": genre,
            "item": item,
            "sales": values["sales"],
            "units": values["units"],
        }
        for (shop, genre, item), values in sorted(items.items())
    ],
)

estimates = defaultdict(int)

for source_name in ["rakuten_estimates.csv", "rakuten_shop_estimates.csv"]:
    source = DATA / source_name
    if not source.exists():
        continue
    target = estimates if source_name == "rakuten_estimates.csv" else None
    with source.open(newline="") as handle:
        reader = csv.DictReader(handle)
        rows = defaultdict(int)
        for row in reader:
            date = row["date"][:7] + "-01"
            key = (date, row.get("shop", ""), row.get("genre_id") or row.get("genre", ""))
            rows[key] += int(float(row.get("predicted_sales", 0) or 0))
    out_name = "estimates_monthly.csv" if source_name == "rakuten_estimates.csv" else "shop_estimates_monthly.csv"
    write_rows(
        OUT / out_name,
        ["date", "shop", "genre", "predicted_sales"],
        [
            {
                "date": date,
                "shop": shop,
                "genre": genre,
                "predicted_sales": value,
            }
            for (date, shop, genre), value in sorted(rows.items())
        ],
    )

latest_rank_date_by_genre = {}
latest_rank_rows_by_genre = defaultdict(list)

rank_source_dir = WORK_ROOT / "ranked-shops"
for source in sorted(rank_source_dir.glob("*.csv")):
    with source.open(newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            genre = row["genre"]
            current_date = latest_rank_date_by_genre.get(genre)
            if current_date is None or row["date"] > current_date:
                latest_rank_date_by_genre[genre] = row["date"]
                latest_rank_rows_by_genre[genre] = [row]
            elif row["date"] == current_date:
                latest_rank_rows_by_genre[genre].append(row)

rank_fields = [
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
]
write_rows(
    OUT / "ranked_shops_latest.csv",
    rank_fields,
    [
        {field: row.get(field, "") for field in rank_fields}
        for genre in sorted(latest_rank_rows_by_genre)
        for row in latest_rank_rows_by_genre[genre]
    ],
)
