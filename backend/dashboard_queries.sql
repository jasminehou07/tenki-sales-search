-- TENKI dashboard API query examples.
-- Use parameterized values from Node; do not concatenate user input into SQL.

-- 1. Genre dropdown, ordered by all-time estimated Rakuten sales.
SELECT
  genre_id,
  genre_name_ja,
  genre_name_en,
  genre_group,
  dropdown_sales_yen
FROM genres
WHERE active = true
ORDER BY dropdown_sales_yen DESC, genre_name_en NULLS LAST, genre_id;

-- 2. Shop dropdown, ordered by all-time estimated sales.
SELECT
  shop_id,
  COALESCE(shop_label, 'Shop ' || shop_id::text) AS shop_label,
  shop_group,
  dropdown_sales_yen
FROM shops
WHERE active = true
ORDER BY dropdown_sales_yen DESC, shop_id;

-- 3. By-genre top cards for one genre over a date range.
-- Params: $1 genre_id, $2 start_date, $3 end_date, $4 model_version
SELECT
  COUNT(*) AS days,
  SUM(estimated_sales_yen) AS estimated_sales_yen,
  SUM(sales_low_95) AS sales_low_95,
  SUM(sales_high_95) AS sales_high_95,
  SUM(estimated_units) AS estimated_units,
  SUM(units_low_95) AS units_low_95,
  SUM(units_high_95) AS units_high_95,
  SUM(known_page_views) AS known_page_views
FROM dashboard_genre_daily
WHERE genre_id = $1
  AND date BETWEEN $2 AND $3
  AND model_version = $4;

-- 4. By-genre top cards for all genres over a date range.
-- Params: $1 start_date, $2 end_date, $3 model_version
SELECT
  COUNT(*) AS days,
  SUM(estimated_sales_yen) AS estimated_sales_yen,
  SUM(sales_low_95) AS sales_low_95,
  SUM(sales_high_95) AS sales_high_95,
  SUM(estimated_units) AS estimated_units,
  SUM(units_low_95) AS units_low_95,
  SUM(units_high_95) AS units_high_95
FROM mv_dashboard_all_genres_daily
WHERE date BETWEEN $1 AND $2
  AND model_version = $3;

-- 5. Sales trend chart for one genre.
-- Params: $1 genre_id, $2 start_date, $3 end_date, $4 model_version
SELECT
  date,
  estimated_sales_yen,
  sales_low_95,
  sales_high_95,
  estimated_units,
  source_kind
FROM dashboard_genre_daily
WHERE genre_id = $1
  AND date BETWEEN $2 AND $3
  AND model_version = $4
ORDER BY date;

-- 6. Sales trend chart for all genres.
-- Params: $1 start_date, $2 end_date, $3 model_version
SELECT
  date,
  estimated_sales_yen,
  sales_low_95,
  sales_high_95,
  estimated_units
FROM mv_dashboard_all_genres_daily
WHERE date BETWEEN $1 AND $2
  AND model_version = $3
ORDER BY date;

-- 7. Sales by rank bar chart/table for one genre.
-- For a range, sums each rank across the selected days.
-- Params: $1 genre_id, $2 start_date, $3 end_date, $4 model_version
SELECT
  rank,
  MAX(shop_id) FILTER (WHERE source_kind IN ('known_tenki', 'hybrid')) AS known_shop_id,
  SUM(estimated_sales_yen) AS estimated_sales_yen,
  SUM(sales_low_95) AS sales_low_95,
  SUM(sales_high_95) AS sales_high_95,
  SUM(estimated_units) AS estimated_units,
  CASE
    WHEN BOOL_OR(source_kind IN ('known_tenki', 'hybrid')) THEN 'known_tenki'
    ELSE 'model'
  END AS source_kind
FROM dashboard_genre_rank_daily
WHERE genre_id = $1
  AND date BETWEEN $2 AND $3
  AND model_version = $4
  AND rank BETWEEN 1 AND 20
GROUP BY rank
ORDER BY rank;

-- 8. Rank projection graph for one selected rank.
-- Params: $1 genre_id, $2 rank, $3 start_date, $4 end_date, $5 model_version
SELECT
  date,
  rank,
  shop_id,
  estimated_sales_yen,
  sales_low_95,
  sales_high_95,
  source_kind
FROM dashboard_genre_rank_daily
WHERE genre_id = $1
  AND rank = $2
  AND date BETWEEN $3 AND $4
  AND model_version = $5
ORDER BY date;

-- 9. Promotions affecting the selected period.
-- Params: $1 start_date, $2 end_date
SELECT
  event_name,
  MIN(start_at)::date AS first_start_date,
  MAX(end_at)::date AS last_end_date,
  COUNT(*) AS event_occurrences,
  AVG(intensity) AS avg_intensity
FROM promotion_events
WHERE event_name NOT IN ('fashionthesale', 'fathers-day')
  AND start_at::date <= $2
  AND end_at::date >= $1
GROUP BY event_name
ORDER BY avg_intensity DESC, event_name;

-- 10. Promotion tooltip: selected event performance vs normal days.
-- Params: $1 event_name, $2 genre_id, $3 start_date, $4 end_date, $5 model_version
WITH selected_event_days AS (
  SELECT DISTINCT d.date
  FROM dashboard_genre_daily d
  JOIN promotion_events e
    ON d.date BETWEEN e.start_at::date AND e.end_at::date
  WHERE e.event_name = $1
    AND d.genre_id = $2
    AND d.date BETWEEN $3 AND $4
    AND d.model_version = $5
),
event_sales AS (
  SELECT AVG(estimated_sales_yen) AS avg_event_sales
  FROM dashboard_genre_daily
  WHERE genre_id = $2
    AND model_version = $5
    AND date IN (SELECT date FROM selected_event_days)
),
normal_sales AS (
  SELECT AVG(d.estimated_sales_yen) AS avg_normal_sales
  FROM dashboard_genre_daily d
  WHERE d.genre_id = $2
    AND d.model_version = $5
    AND EXTRACT(DOW FROM d.date) IN (
      SELECT EXTRACT(DOW FROM date) FROM selected_event_days
    )
    AND d.date NOT IN (
      SELECT DISTINCT dd.date
      FROM dashboard_genre_daily dd
      JOIN promotion_events ee
        ON dd.date BETWEEN ee.start_at::date AND ee.end_at::date
      WHERE dd.genre_id = $2
        AND dd.model_version = $5
    )
)
SELECT
  $1 AS event_name,
  avg_event_sales,
  avg_normal_sales,
  CASE
    WHEN avg_normal_sales > 0 THEN (avg_event_sales / avg_normal_sales - 1) * 100
    ELSE NULL
  END AS percent_lift
FROM event_sales, normal_sales;

-- 11. By-shop top cards for one shop over a date range.
-- Params: $1 shop_id, $2 start_date, $3 end_date, $4 model_version
SELECT
  COUNT(*) AS days,
  SUM(estimated_sales_yen) AS estimated_sales_yen,
  SUM(sales_low_95) AS sales_low_95,
  SUM(sales_high_95) AS sales_high_95,
  SUM(estimated_units) AS estimated_units,
  SUM(units_low_95) AS units_low_95,
  SUM(units_high_95) AS units_high_95
FROM dashboard_shop_daily
WHERE shop_id = $1
  AND date BETWEEN $2 AND $3
  AND model_version = $4;

-- 12. By-shop top cards for all shops.
-- Params: $1 start_date, $2 end_date, $3 model_version
SELECT
  COUNT(*) AS days,
  SUM(estimated_sales_yen) AS estimated_sales_yen,
  SUM(sales_low_95) AS sales_low_95,
  SUM(sales_high_95) AS sales_high_95,
  SUM(estimated_units) AS estimated_units,
  SUM(units_low_95) AS units_low_95,
  SUM(units_high_95) AS units_high_95
FROM mv_dashboard_all_shops_daily
WHERE date BETWEEN $1 AND $2
  AND model_version = $3;

-- 13. Sales by genre inside one shop.
-- Params: $1 shop_id, $2 start_date, $3 end_date, $4 model_version
SELECT
  sg.genre_id,
  g.genre_name_ja,
  g.genre_name_en,
  SUM(sg.estimated_sales_yen) AS estimated_sales_yen,
  SUM(sg.sales_low_95) AS sales_low_95,
  SUM(sg.sales_high_95) AS sales_high_95,
  SUM(sg.estimated_units) AS estimated_units
FROM dashboard_shop_genre_daily sg
LEFT JOIN genres g ON g.genre_id = sg.genre_id
WHERE sg.shop_id = $1
  AND sg.date BETWEEN $2 AND $3
  AND sg.model_version = $4
GROUP BY sg.genre_id, g.genre_name_ja, g.genre_name_en
ORDER BY estimated_sales_yen DESC
LIMIT 20;

-- 14. Latest WMAPE shown under chart titles.
-- Params: $1 model_name, $2 entity_type, $3 optional_genre_id
SELECT
  metric_value AS wmape,
  sample_size,
  evaluated_at
FROM model_validation_metrics
WHERE model_name = $1
  AND entity_type = $2
  AND metric_name = 'WMAPE'
  AND ($3::bigint IS NULL OR genre_id = $3)
ORDER BY evaluated_at DESC
LIMIT 1;

-- 15. Refresh rollups after a model/imputation run.
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_all_genres_daily;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_all_shops_daily;

