import csv

from prep_paths import DASHBOARD_ROOT


ROOT = DASHBOARD_ROOT


def split_daily_folder(source_dir, target_dir):
    target_dir.mkdir(parents=True, exist_ok=True)
    writers = {}
    handles = {}

    try:
        for source in sorted(source_dir.glob("*.csv")):
            month = source.stem[:7]
            with source.open(newline="") as handle:
                reader = csv.reader(handle)
                header = next(reader)
                if month not in writers:
                    out = (target_dir / f"{month}.csv").open("w", newline="")
                    handles[month] = out
                    writers[month] = csv.writer(out)
                    writers[month].writerow(header)
                for row in reader:
                    writers[month].writerow(row)
    finally:
        for handle in handles.values():
            handle.close()


split_daily_folder(ROOT / "data/by-date", ROOT / "data/by-month")
split_daily_folder(ROOT / "data/items-by-date", ROOT / "data/items-by-month")
