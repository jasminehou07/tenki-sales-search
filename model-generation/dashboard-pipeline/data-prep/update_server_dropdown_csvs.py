#!/usr/bin/env python3
from __future__ import annotations

import csv
import os
import subprocess
from pathlib import Path


DATA_DIR = Path(
    os.environ.get("TENKI_SERVER_DATA_DIR", "/opt/tenki-dashboard/site-data/data")
).expanduser().resolve()
FILTER_OPTIONS = DATA_DIR / "filter_options.csv"
GENRE_NAMES = DATA_DIR / "genre_names.csv"


def psql_csv(sql: str) -> list[dict[str, str]]:
    output = subprocess.check_output(
        [
            "sudo",
            "-u",
            "postgres",
            "psql",
            "-d",
            "tenki_dashboard",
            "--csv",
            "-c",
            sql,
        ],
        text=True,
    )
    return list(csv.DictReader(output.splitlines()))


def main() -> None:
    genre_rows = psql_csv(
        """
        SELECT
          genre_id::text AS id,
          CASE
            WHEN NULLIF(genre_name_ja, '') IS NOT NULL
              AND NULLIF(genre_name_en, '') IS NOT NULL
              AND genre_name_ja <> genre_name_en
              THEN genre_name_ja || ' / ' || genre_name_en
            ELSE COALESCE(NULLIF(genre_name_ja, ''), 'Genre ' || genre_id::text)
          END AS label,
          COALESCE(dropdown_sales_yen, 0)::text AS sales
        FROM genres
        WHERE active = true
        ORDER BY dropdown_sales_yen DESC, genre_id;
        """
    )

    name_rows = psql_csv(
        """
        SELECT
          genre_id::text AS genre_id,
          CASE
            WHEN NULLIF(genre_name_ja, '') IS NOT NULL
              AND NULLIF(genre_name_en, '') IS NOT NULL
              AND genre_name_ja <> genre_name_en
              THEN genre_name_ja || ' / ' || genre_name_en
            ELSE COALESCE(NULLIF(genre_name_ja, ''), 'Genre ' || genre_id::text)
          END AS genre_name
        FROM genres
        WHERE active = true
        ORDER BY genre_id;
        """
    )

    with FILTER_OPTIONS.open(newline="", encoding="utf-8") as handle:
        existing = list(csv.DictReader(handle))

    preserved = [row for row in existing if row.get("type") != "genre"]
    combined = preserved + [
        {
            "type": "genre",
            "id": row["id"],
            "label": row["label"],
            "sales": row["sales"],
        }
        for row in genre_rows
    ]

    tmp_filter = FILTER_OPTIONS.with_suffix(".csv.tmp")
    with tmp_filter.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["type", "id", "label", "sales"])
        writer.writeheader()
        writer.writerows(combined)
    tmp_filter.replace(FILTER_OPTIONS)

    tmp_names = GENRE_NAMES.with_suffix(".csv.tmp")
    with tmp_names.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["genre_id", "genre_name"])
        writer.writeheader()
        writer.writerows(name_rows)
    tmp_names.replace(GENRE_NAMES)

    print(f"genre_rows={len(genre_rows)}")
    print(f"filter_rows={len(combined)}")
    print(f"genre_name_rows={len(name_rows)}")


if __name__ == "__main__":
    main()
