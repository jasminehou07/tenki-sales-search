-- Stores the hidden 5% validation rows so the API can calculate WMAPE for
-- a selected day or date range instead of only showing one overall score.

\set ON_ERROR_STOP on

DROP TABLE IF EXISTS model_validation_holdout_predictions;

CREATE TABLE model_validation_holdout_predictions AS
WITH rank_actuals AS (
  SELECT
    r.date::date AS validation_date,
    r.genre_id,
    r.rank,
    r.shop_id,
    r.item_id,
    r.sales::numeric AS actual_sales,
    COALESCE(NULLIF(g.genre_group, ''), 'Other') AS genre_group,
    MOD(ABS(HASHTEXT(CONCAT_WS('|', r.date::text, r.genre_id::text, r.rank::text, COALESCE(r.shop_id::text, ''), COALESCE(r.item_id::text, '')))::bigint), 20) = 0 AS is_holdout
  FROM dashboard_rank_rows r
  LEFT JOIN genres g ON g.genre_id = r.genre_id
  WHERE r.source IN ('actual', 'known_tenki', 'hybrid')
    AND r.sales > 0
    AND r.genre_id IS NOT NULL
    AND r.rank BETWEEN 1 AND 80
),
train AS (
  SELECT * FROM rank_actuals WHERE NOT is_holdout
),
holdout AS (
  SELECT * FROM rank_actuals WHERE is_holdout
),
genre_stats AS (
  SELECT
    genre_id,
    genre_group,
    COUNT(*) AS train_rows,
    AVG(actual_sales) AS genre_avg_sales,
    CASE
      WHEN COUNT(*) >= 1000 THEN 'high-data genre'
      WHEN COUNT(*) >= 100 THEN 'medium-data genre group'
      ELSE 'small/niche genre adjustment'
    END AS validation_group
  FROM train
  GROUP BY genre_id, genre_group
),
genre_rank AS (
  SELECT genre_id, rank, AVG(actual_sales) AS avg_sales
  FROM train
  GROUP BY genre_id, rank
),
group_stats AS (
  SELECT genre_group, AVG(actual_sales) AS group_avg_sales
  FROM train
  GROUP BY genre_group
),
group_rank AS (
  SELECT genre_group, rank, AVG(actual_sales) AS avg_sales
  FROM train
  GROUP BY genre_group, rank
),
global_rank AS (
  SELECT rank, AVG(actual_sales) AS avg_sales
  FROM train
  GROUP BY rank
),
global_avg AS (
  SELECT AVG(actual_sales) AS avg_sales FROM train
)
SELECT
  'rank-validation-20260721'::text AS model_version,
  'Genre sales model'::text AS model_name,
  'genre'::text AS entity_type,
  gs.validation_group AS entity_group,
  NOW() AS created_at,
  h.validation_date,
  h.genre_id,
  h.shop_id,
  h.item_id,
  h.rank,
  h.actual_sales,
  CASE
    WHEN gs.train_rows >= 1000 THEN
      COALESCE(
        gr.avg_sales,
        gpr.avg_sales * NULLIF(gs.genre_avg_sales, 0) / NULLIF(gst.group_avg_sales, 0),
        gpr.avg_sales,
        glr.avg_sales,
        gla.avg_sales
      )
    WHEN gs.train_rows >= 100 THEN
      COALESCE(
        gpr.avg_sales * NULLIF(gs.genre_avg_sales, 0) / NULLIF(gst.group_avg_sales, 0),
        gr.avg_sales,
        gs.genre_avg_sales,
        gpr.avg_sales,
        glr.avg_sales,
        gla.avg_sales
      )
    ELSE
      COALESCE(
        gpr.avg_sales * NULLIF(gs.genre_avg_sales, 0) / NULLIF(gst.group_avg_sales, 0),
        gpr.avg_sales,
        glr.avg_sales,
        gs.genre_avg_sales,
        gla.avg_sales
      )
  END::numeric AS predicted_sales
FROM holdout h
JOIN genre_stats gs ON gs.genre_id = h.genre_id
LEFT JOIN genre_rank gr ON gr.genre_id = h.genre_id AND gr.rank = h.rank
LEFT JOIN group_stats gst ON gst.genre_group = gs.genre_group
LEFT JOIN group_rank gpr ON gpr.genre_group = gs.genre_group AND gpr.rank = h.rank
LEFT JOIN global_rank glr ON glr.rank = h.rank
CROSS JOIN global_avg gla
WHERE h.actual_sales > 0;

DELETE FROM model_validation_holdout_predictions
WHERE predicted_sales IS NULL
   OR predicted_sales <= 0
   OR actual_sales <= 0;

CREATE INDEX model_validation_holdout_predictions_date_idx
  ON model_validation_holdout_predictions (validation_date);

CREATE INDEX model_validation_holdout_predictions_genre_date_idx
  ON model_validation_holdout_predictions (genre_id, validation_date);

CREATE INDEX model_validation_holdout_predictions_shop_date_idx
  ON model_validation_holdout_predictions (shop_id, validation_date);

CREATE INDEX model_validation_holdout_predictions_model_idx
  ON model_validation_holdout_predictions (model_name, entity_type);

ANALYZE model_validation_holdout_predictions;

SELECT
  COUNT(*) AS holdout_rows,
  ROUND(SUM(ABS(predicted_sales - actual_sales)) / NULLIF(SUM(ABS(actual_sales)), 0) * 100, 2) AS overall_wmape
FROM model_validation_holdout_predictions;
