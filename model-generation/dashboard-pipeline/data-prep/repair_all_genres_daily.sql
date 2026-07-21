-- Repair/rebuild dashboard_genre_daily after expanding dashboard_rank_rows.
-- Run as postgres against tenki_dashboard.

\timing on

SET statement_timeout = 0;
SET maintenance_work_mem = '1024MB';
SET work_mem = '256MB';

DROP TABLE IF EXISTS dashboard_genre_daily_new;

CREATE UNLOGGED TABLE dashboard_genre_daily_new AS
WITH genre_unit_rate AS (
  SELECT
    item_genre AS genre_id,
    LEAST(0.60, GREATEST(0.00001, sum(units_sold)::numeric / NULLIF(sum(sales_yen)::numeric, 0))) AS units_per_yen
  FROM raw_genre_sales
  WHERE sales_yen > 0
    AND units_sold > 0
  GROUP BY item_genre
)
SELECT
  r.date,
  r.genre_id,
  sum(r.sales) AS estimated_sales_yen,
  sum(COALESCE(r.sales_low, r.sales)) AS sales_low_95,
  sum(COALESCE(r.sales_high, r.sales)) AS sales_high_95,
  sum(GREATEST(1::numeric, r.sales * COALESCE(gur.units_per_yen, 0.003))) AS estimated_units,
  sum(GREATEST(1::numeric, r.sales * COALESCE(gur.units_per_yen, 0.003)) * 0.65) AS units_low_95,
  sum(GREATEST(1::numeric, r.sales * COALESCE(gur.units_per_yen, 0.003)) * 1.35) AS units_high_95,
  sum(r.sales) FILTER (WHERE r.source = 'actual') AS known_sales_yen,
  NULL::numeric AS known_units,
  NULL::bigint AS known_page_views,
  CASE WHEN bool_or(r.source = 'actual') THEN 'hybrid' ELSE 'model' END AS source_kind,
  'github-pages-current'::text AS model_version,
  now() AS created_at
FROM dashboard_rank_rows r
LEFT JOIN genre_unit_rate gur
  ON gur.genre_id = r.genre_id
GROUP BY r.date, r.genre_id;

CREATE UNIQUE INDEX dashboard_genre_daily_new_pk
  ON dashboard_genre_daily_new (genre_id, date, model_version);
CREATE INDEX idx_dashboard_genre_daily_new_date
  ON dashboard_genre_daily_new (date);
ANALYZE dashboard_genre_daily_new;

TRUNCATE dashboard_genre_daily;
INSERT INTO dashboard_genre_daily (
  date,
  genre_id,
  estimated_sales_yen,
  sales_low_95,
  sales_high_95,
  estimated_units,
  units_low_95,
  units_high_95,
  known_sales_yen,
  known_units,
  known_page_views,
  source_kind,
  model_version,
  created_at
)
SELECT
  date,
  genre_id,
  estimated_sales_yen,
  sales_low_95,
  sales_high_95,
  estimated_units,
  units_low_95,
  units_high_95,
  known_sales_yen,
  known_units,
  known_page_views,
  source_kind,
  model_version,
  created_at
FROM dashboard_genre_daily_new;

WITH totals AS (
  SELECT genre_id, sum(estimated_sales_yen) AS total_sales
  FROM dashboard_genre_daily
  WHERE model_version = 'github-pages-current'
  GROUP BY genre_id
)
UPDATE genres g
SET dropdown_sales_yen = COALESCE(t.total_sales, 0),
    active = true
FROM totals t
WHERE t.genre_id = g.genre_id;

REFRESH MATERIALIZED VIEW mv_dashboard_all_genres_daily;

ANALYZE dashboard_genre_daily;
ANALYZE genres;

DROP TABLE dashboard_genre_daily_new;

SELECT 'daily_genres' AS metric, count(DISTINCT genre_id)::text AS value FROM dashboard_genre_daily
UNION ALL SELECT 'daily_rows', count(*)::text FROM dashboard_genre_daily
UNION ALL SELECT 'active_genres', count(*)::text FROM genres WHERE active = true
UNION ALL SELECT 'rank_rows_genres', count(DISTINCT genre_id)::text FROM dashboard_rank_rows
UNION ALL SELECT 'rank_rows', count(*)::text FROM dashboard_rank_rows;
