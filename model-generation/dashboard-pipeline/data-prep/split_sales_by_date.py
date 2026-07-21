import csv

from prep_paths import DASHBOARD_ROOT


source = DASHBOARD_ROOT / "data" / "sales_daily.csv"
target_dir = DASHBOARD_ROOT / "data" / "by-date"
target_dir.mkdir(parents=True, exist_ok=True)

current_date = None
current_file = None
writer = None
header = None

with source.open(newline="") as handle:
    reader = csv.reader(handle)
    header = next(reader)
    for row in reader:
        row_date = row[0]
        if row_date != current_date:
            if current_file:
                current_file.close()
            current_date = row_date
            current_file = (target_dir / f"{row_date}.csv").open("w", newline="")
            writer = csv.writer(current_file)
            writer.writerow(header)
        writer.writerow(row)

if current_file:
    current_file.close()
