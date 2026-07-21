#!/usr/bin/env bash
set -euo pipefail

DATA_ROOT="/opt/tenki-dashboard/site-data/data/ranked-shops-by-genre"
TMP_DIR="/tmp/tenki-rank-import"
PSQL=(sudo -u postgres psql -d tenki_dashboard)
mkdir -p "$TMP_DIR"

"${PSQL[@]}" <<'SQL'
DROP TABLE IF EXISTS dashboard_rank_rows;
CREATE TABLE dashboard_rank_rows (
  date date NOT NULL,
  genre_id bigint NOT NULL,
  rank integer NOT NULL,
  shop_id bigint,
  source text NOT NULL,
  sales numeric,
  sales_low numeric,
  sales_high numeric,
  lower_rank integer,
  upper_rank integer,
  lower_sales numeric,
  upper_sales numeric,
  item_id bigint
);
GRANT SELECT ON dashboard_rank_rows TO tenki_api;
SQL

mapfile -t months < <(find "$DATA_ROOT/all-items" -maxdepth 1 -name '*.csv' -print | sed -E 's#.*/([0-9]{4}-[0-9]{2})\.csv#\1#' | sort)

for month in "${months[@]}"; do
  tmp_file="$TMP_DIR/${month}.csv"
  find "$DATA_ROOT" -mindepth 2 -maxdepth 2 -name "${month}.csv" \
    ! -path "$DATA_ROOT/all/*" \
    ! -path "$DATA_ROOT/all-items/*" \
    -print0 \
    | xargs -0 awk 'FNR > 1' > "$tmp_file"

  chmod 0644 "$tmp_file"
  "${PSQL[@]}" -c "\\copy dashboard_rank_rows(date, genre_id, rank, shop_id, source, sales, sales_low, sales_high, lower_rank, upper_rank, lower_sales, upper_sales, item_id) FROM '$tmp_file' WITH (FORMAT csv, NULL '')"
  rm -f "$tmp_file"
  echo "imported $month"
done

"${PSQL[@]}" <<'SQL'
CREATE INDEX idx_dashboard_rank_rows_genre_date_rank
  ON dashboard_rank_rows (genre_id, date, rank);

CREATE INDEX idx_dashboard_rank_rows_date_sales
  ON dashboard_rank_rows (date, sales DESC);

CREATE INDEX idx_dashboard_rank_rows_date_rank
  ON dashboard_rank_rows (date, rank);

ANALYZE dashboard_rank_rows;
GRANT SELECT ON dashboard_rank_rows TO tenki_api;

SELECT COUNT(*) AS rows_loaded, MIN(date) AS first_date, MAX(date) AS last_date
FROM dashboard_rank_rows;
SQL
