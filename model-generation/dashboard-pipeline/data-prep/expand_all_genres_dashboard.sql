-- Expand TENKI dashboard outputs from the raw 1100-genre ranking/sales tables.
-- Run as postgres against tenki_dashboard.

\timing on

SET statement_timeout = 0;
SET lock_timeout = 0;
SET maintenance_work_mem = '1024MB';
SET work_mem = '256MB';

DROP TABLE IF EXISTS dashboard_rank_rows_new;
DROP TABLE IF EXISTS dashboard_genre_daily_new;
DROP TABLE IF EXISTS known_rank_sales_full;
DROP TABLE IF EXISTS rank_genre_profile_full;
DROP TABLE IF EXISTS rank_global_profile_full;
DROP TABLE IF EXISTS genre_scale_full;
DROP TABLE IF EXISTS date_factor_full;
DROP TABLE IF EXISTS genre_unit_rate_full;

CREATE UNLOGGED TABLE known_rank_sales_full AS
SELECT
  r.date,
  r.genre_id,
  r.rank,
  r.shop_id,
  r.item_id,
  s.sales_yen::numeric AS sales_yen,
  s.units_sold::numeric AS units_sold
FROM raw_genre_rankings r
JOIN raw_genre_sales s
  ON s.item_genre = r.genre_id
 AND s.date = r.date
 AND s.shop_id = r.shop_id
 AND s.item_id = r.item_id
WHERE s.sales_yen > 0;

CREATE INDEX known_rank_sales_full_pk
  ON known_rank_sales_full (date, genre_id, rank, shop_id, item_id);
CREATE INDEX known_rank_sales_full_genre_rank
  ON known_rank_sales_full (genre_id, rank);
ANALYZE known_rank_sales_full;

CREATE UNLOGGED TABLE rank_genre_profile_full AS
SELECT
  genre_id,
  rank,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY sales_yen)::numeric AS sales_med,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY NULLIF(units_sold, 0))::numeric AS units_med,
  count(*) AS sample_size
FROM known_rank_sales_full
WHERE rank BETWEEN 1 AND 80
GROUP BY genre_id, rank;

CREATE UNIQUE INDEX rank_genre_profile_full_pk
  ON rank_genre_profile_full (genre_id, rank);
ANALYZE rank_genre_profile_full;

CREATE UNLOGGED TABLE rank_global_profile_full AS
SELECT
  rank,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY sales_yen)::numeric AS sales_med,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY NULLIF(units_sold, 0))::numeric AS units_med,
  count(*) AS sample_size
FROM known_rank_sales_full
WHERE rank BETWEEN 1 AND 80
GROUP BY rank;

CREATE UNIQUE INDEX rank_global_profile_full_pk
  ON rank_global_profile_full (rank);
ANALYZE rank_global_profile_full;

CREATE UNLOGGED TABLE genre_scale_full AS
WITH genre_avg AS (
  SELECT genre_id, avg(sales_yen) AS avg_sales
  FROM known_rank_sales_full
  GROUP BY genre_id
), global_avg AS (
  SELECT avg(sales_yen) AS avg_sales
  FROM known_rank_sales_full
)
SELECT
  g.genre_id,
  LEAST(5.0, GREATEST(0.20, g.avg_sales / NULLIF(ga.avg_sales, 0))) AS sales_scale
FROM genre_avg g
CROSS JOIN global_avg ga;

CREATE UNIQUE INDEX genre_scale_full_pk
  ON genre_scale_full (genre_id);
ANALYZE genre_scale_full;

CREATE UNLOGGED TABLE date_factor_full AS
WITH daily AS (
  SELECT date, sum(sales_yen) AS total_sales
  FROM known_rank_sales_full
  GROUP BY date
), global_daily AS (
  SELECT avg(total_sales) AS avg_total_sales
  FROM daily
)
SELECT
  d.date,
  LEAST(2.40, GREATEST(0.45, d.total_sales / NULLIF(g.avg_total_sales, 0))) AS sales_factor
FROM daily d
CROSS JOIN global_daily g;

CREATE UNIQUE INDEX date_factor_full_pk
  ON date_factor_full (date);
ANALYZE date_factor_full;

CREATE UNLOGGED TABLE genre_unit_rate_full AS
SELECT
  item_genre AS genre_id,
  LEAST(0.60, GREATEST(0.00001, sum(units_sold)::numeric / NULLIF(sum(sales_yen)::numeric, 0))) AS units_per_yen
FROM raw_genre_sales
WHERE sales_yen > 0
  AND units_sold > 0
GROUP BY item_genre;

CREATE UNIQUE INDEX genre_unit_rate_full_pk
  ON genre_unit_rate_full (genre_id);
ANALYZE genre_unit_rate_full;

CREATE TABLE dashboard_rank_rows_new AS
WITH base AS (
  SELECT
    r.date,
    r.genre_id,
    r.rank,
    r.shop_id,
    r.item_id,
    CASE
      WHEN k.sales_yen > 0 THEN k.sales_yen
      ELSE GREATEST(
        1::numeric,
        COALESCE(
          gp.sales_med,
          gl.sales_med * COALESCE(gs.sales_scale, 1.0),
          gl.sales_med,
          NULLIF(r.price_yen, 0)::numeric * GREATEST(0.40, 18.0 / (r.rank + 8))
        ) * COALESCE(df.sales_factor, 1.0)
      )
    END AS sales,
    CASE
      WHEN k.sales_yen > 0 THEN k.units_sold
      ELSE GREATEST(
        1::numeric,
        COALESCE(
          gp.units_med,
          gl.units_med,
          COALESCE(
            gp.sales_med,
            gl.sales_med * COALESCE(gs.sales_scale, 1.0),
            gl.sales_med,
            NULLIF(r.price_yen, 0)::numeric
          ) * COALESCE(gur.units_per_yen, 0.003)
        )
      )
    END AS units,
    CASE WHEN k.sales_yen > 0 THEN 'actual' ELSE 'estimated' END AS source
  FROM raw_genre_rankings r
  LEFT JOIN known_rank_sales_full k
    ON k.date = r.date
   AND k.genre_id = r.genre_id
   AND k.rank = r.rank
   AND k.shop_id = r.shop_id
   AND k.item_id = r.item_id
  LEFT JOIN rank_genre_profile_full gp
    ON gp.genre_id = r.genre_id
   AND gp.rank = r.rank
  LEFT JOIN rank_global_profile_full gl
    ON gl.rank = r.rank
  LEFT JOIN genre_scale_full gs
    ON gs.genre_id = r.genre_id
  LEFT JOIN date_factor_full df
    ON df.date = r.date
  LEFT JOIN genre_unit_rate_full gur
    ON gur.genre_id = r.genre_id
  WHERE r.rank BETWEEN 1 AND 80
)
SELECT
  date,
  genre_id,
  rank,
  shop_id,
  source,
  round(sales, 2) AS sales,
  CASE WHEN source = 'actual' THEN round(sales, 2) ELSE round(sales * 0.65, 2) END AS sales_low,
  CASE WHEN source = 'actual' THEN round(sales, 2) ELSE round(sales * 1.35, 2) END AS sales_high,
  NULL::integer AS lower_rank,
  NULL::integer AS upper_rank,
  NULL::numeric AS lower_sales,
  NULL::numeric AS upper_sales,
  item_id
FROM base;

CREATE INDEX idx_dashboard_rank_rows_new_genre_date_rank
  ON dashboard_rank_rows_new (genre_id, date, rank);
CREATE INDEX idx_dashboard_rank_rows_new_date_sales
  ON dashboard_rank_rows_new (date, sales DESC);
CREATE INDEX idx_dashboard_rank_rows_new_date_rank
  ON dashboard_rank_rows_new (date, rank);
CREATE INDEX idx_dashboard_rank_rows_new_shop_date
  ON dashboard_rank_rows_new (shop_id, date);
ANALYZE dashboard_rank_rows_new;

CREATE TABLE dashboard_genre_daily_new AS
SELECT
  date,
  genre_id,
  sum(sales) AS estimated_sales_yen,
  sum(COALESCE(sales_low, sales)) AS sales_low_95,
  sum(COALESCE(sales_high, sales)) AS sales_high_95,
  sum(GREATEST(1::numeric, sales * COALESCE(gur.units_per_yen, 0.003))) AS estimated_units,
  sum(GREATEST(1::numeric, sales * COALESCE(gur.units_per_yen, 0.003)) * 0.65) AS units_low_95,
  sum(GREATEST(1::numeric, sales * COALESCE(gur.units_per_yen, 0.003)) * 1.35) AS units_high_95,
  sum(sales) FILTER (WHERE source = 'actual') AS known_sales_yen,
  NULL::numeric AS known_units,
  NULL::bigint AS known_page_views,
  CASE WHEN bool_or(source = 'actual') THEN 'hybrid' ELSE 'model' END AS source_kind,
  'github-pages-current'::text AS model_version,
  now() AS created_at
FROM dashboard_rank_rows_new r
LEFT JOIN genre_unit_rate_full gur
  ON gur.genre_id = r.genre_id
GROUP BY date, r.genre_id;

CREATE UNIQUE INDEX dashboard_genre_daily_new_pk
  ON dashboard_genre_daily_new (genre_id, date, model_version);
CREATE INDEX idx_dashboard_genre_daily_new_date
  ON dashboard_genre_daily_new (date);
ANALYZE dashboard_genre_daily_new;

BEGIN;
ALTER TABLE dashboard_rank_rows RENAME TO dashboard_rank_rows_old;
ALTER TABLE dashboard_rank_rows_new RENAME TO dashboard_rank_rows;
COMMIT;

DROP TABLE dashboard_rank_rows_old;

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

INSERT INTO genres (
  genre_id,
  genre_name_ja,
  genre_name_en,
  genre_group,
  dropdown_sales_yen,
  active
)
WITH raw_genres AS (
  SELECT DISTINCT genre_id FROM raw_genre_rankings
  UNION
  SELECT DISTINCT item_genre AS genre_id FROM raw_genre_sales
), totals AS (
  SELECT genre_id, sum(estimated_sales_yen) AS total_sales
  FROM dashboard_genre_daily
  WHERE model_version = 'github-pages-current'
  GROUP BY genre_id
)
SELECT
  rg.genre_id,
  COALESCE(g.genre_name_ja, 'Genre ' || rg.genre_id::text),
  COALESCE(g.genre_name_en, 'Genre ' || rg.genre_id::text),
  COALESCE(g.genre_group, 'uncategorized'),
  COALESCE(t.total_sales, 0),
  true
FROM raw_genres rg
LEFT JOIN genres g ON g.genre_id = rg.genre_id
LEFT JOIN totals t ON t.genre_id = rg.genre_id
ON CONFLICT (genre_id) DO UPDATE SET
  dropdown_sales_yen = EXCLUDED.dropdown_sales_yen,
  active = true,
  genre_name_ja = COALESCE(genres.genre_name_ja, EXCLUDED.genre_name_ja),
  genre_name_en = COALESCE(genres.genre_name_en, EXCLUDED.genre_name_en),
  genre_group = COALESCE(genres.genre_group, EXCLUDED.genre_group);

UPDATE genres g
SET active = false
WHERE NOT EXISTS (
  SELECT 1
  FROM raw_genre_rankings r
  WHERE r.genre_id = g.genre_id
)
AND NOT EXISTS (
  SELECT 1
  FROM raw_genre_sales s
  WHERE s.item_genre = g.genre_id
);

REFRESH MATERIALIZED VIEW mv_dashboard_all_genres_daily;

ANALYZE dashboard_rank_rows;
ANALYZE dashboard_genre_daily;
ANALYZE genres;

DROP TABLE IF EXISTS dashboard_genre_daily_new;
DROP TABLE IF EXISTS known_rank_sales_full;
DROP TABLE IF EXISTS rank_genre_profile_full;
DROP TABLE IF EXISTS rank_global_profile_full;
DROP TABLE IF EXISTS genre_scale_full;
DROP TABLE IF EXISTS date_factor_full;
DROP TABLE IF EXISTS genre_unit_rate_full;

SELECT 'genres' AS table_name, count(*) AS count FROM genres WHERE active = true
UNION ALL SELECT 'dashboard_rank_rows_genres', count(DISTINCT genre_id) FROM dashboard_rank_rows
UNION ALL SELECT 'dashboard_rank_rows', count(*) FROM dashboard_rank_rows
UNION ALL SELECT 'dashboard_genre_daily_genres', count(DISTINCT genre_id) FROM dashboard_genre_daily
UNION ALL SELECT 'dashboard_genre_daily', count(*) FROM dashboard_genre_daily;
