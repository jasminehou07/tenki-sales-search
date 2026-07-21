-- Per-genre WMAPE validation for the dashboard.
-- Uses known ranked item sales, hides a deterministic 5%, predicts them from the remaining 95%,
-- then stores WMAPE by genre in model_validation_metrics.

\set ON_ERROR_STOP on

DROP TABLE IF EXISTS tmp_validation_rank_actuals;
CREATE UNLOGGED TABLE tmp_validation_rank_actuals AS
SELECT
  r.date,
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
  AND r.rank BETWEEN 1 AND 80;

CREATE INDEX tmp_validation_rank_actuals_genre_rank_idx
  ON tmp_validation_rank_actuals (genre_id, rank);

CREATE INDEX tmp_validation_rank_actuals_group_rank_idx
  ON tmp_validation_rank_actuals (genre_group, rank);

ANALYZE tmp_validation_rank_actuals;

DROP TABLE IF EXISTS tmp_validation_predictions;
CREATE UNLOGGED TABLE tmp_validation_predictions AS
WITH train AS (
  SELECT * FROM tmp_validation_rank_actuals WHERE NOT is_holdout
),
holdout AS (
  SELECT * FROM tmp_validation_rank_actuals WHERE is_holdout
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
),
scored AS (
  SELECT
    h.date,
    h.genre_id,
    h.rank,
    h.actual_sales,
    gs.train_rows,
    gs.validation_group,
    CASE
      WHEN gs.train_rows >= 1000 THEN
        COALESCE(
          gr.avg_sales,
          gs.genre_avg_sales * NULLIF(gpr.avg_sales, 0) / NULLIF(gst.group_avg_sales, 0),
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
    END AS predicted_sales
  FROM holdout h
  JOIN genre_stats gs ON gs.genre_id = h.genre_id
  LEFT JOIN genre_rank gr ON gr.genre_id = h.genre_id AND gr.rank = h.rank
  LEFT JOIN group_stats gst ON gst.genre_group = gs.genre_group
  LEFT JOIN group_rank gpr ON gpr.genre_group = gs.genre_group AND gpr.rank = h.rank
  LEFT JOIN global_rank glr ON glr.rank = h.rank
  CROSS JOIN global_avg gla
)
SELECT *
FROM scored
WHERE predicted_sales IS NOT NULL
  AND predicted_sales > 0
  AND actual_sales > 0;

ANALYZE tmp_validation_predictions;

DELETE FROM model_validation_metrics
WHERE model_version = 'rank-validation-20260721'
  AND model_name = 'Genre sales model'
  AND metric_name IN ('WMAPE', 'Median APE', 'Within 25%');

INSERT INTO model_validation_metrics (
  model_version,
  model_name,
  entity_type,
  entity_group,
  genre_id,
  shop_id,
  event_name,
  metric_name,
  metric_value,
  sample_size
)
SELECT
  'rank-validation-20260721' AS model_version,
  'Genre sales model' AS model_name,
  'genre' AS entity_type,
  validation_group AS entity_group,
  genre_id,
  NULL::bigint AS shop_id,
  NULL::text AS event_name,
  'WMAPE' AS metric_name,
  SUM(ABS(predicted_sales - actual_sales)) / NULLIF(SUM(ABS(actual_sales)), 0) * 100 AS metric_value,
  COUNT(*)::integer AS sample_size
FROM tmp_validation_predictions
GROUP BY genre_id, validation_group
HAVING COUNT(*) > 0;

INSERT INTO model_validation_metrics (
  model_version,
  model_name,
  entity_type,
  entity_group,
  genre_id,
  shop_id,
  event_name,
  metric_name,
  metric_value,
  sample_size
)
SELECT
  'rank-validation-20260721',
  'Genre sales model',
  'genre',
  validation_group,
  genre_id,
  NULL::bigint,
  NULL::text,
  'Median APE',
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ABS(predicted_sales - actual_sales) / NULLIF(actual_sales, 0)) * 100,
  COUNT(*)::integer
FROM tmp_validation_predictions
GROUP BY genre_id, validation_group
HAVING COUNT(*) > 0;

INSERT INTO model_validation_metrics (
  model_version,
  model_name,
  entity_type,
  entity_group,
  genre_id,
  shop_id,
  event_name,
  metric_name,
  metric_value,
  sample_size
)
SELECT
  'rank-validation-20260721',
  'Genre sales model',
  'genre',
  validation_group,
  genre_id,
  NULL::bigint,
  NULL::text,
  'Within 25%',
  AVG(CASE WHEN ABS(predicted_sales - actual_sales) / NULLIF(actual_sales, 0) <= 0.25 THEN 1 ELSE 0 END) * 100,
  COUNT(*)::integer
FROM tmp_validation_predictions
GROUP BY genre_id, validation_group
HAVING COUNT(*) > 0;

INSERT INTO model_validation_metrics (
  model_version,
  model_name,
  entity_type,
  entity_group,
  genre_id,
  shop_id,
  event_name,
  metric_name,
  metric_value,
  sample_size
)
SELECT
  'rank-validation-20260721',
  'Genre sales model',
  'genre',
  'all genres',
  NULL::bigint,
  NULL::bigint,
  NULL::text,
  'WMAPE',
  SUM(ABS(predicted_sales - actual_sales)) / NULLIF(SUM(ABS(actual_sales)), 0) * 100,
  COUNT(*)::integer
FROM tmp_validation_predictions;

SELECT
  metric_name,
  entity_group,
  COUNT(*) AS rows,
  ROUND(AVG(metric_value), 2) AS avg_metric,
  ROUND(MIN(metric_value), 2) AS min_metric,
  ROUND(MAX(metric_value), 2) AS max_metric
FROM model_validation_metrics
WHERE model_version = 'rank-validation-20260721'
  AND model_name = 'Genre sales model'
GROUP BY metric_name, entity_group
ORDER BY metric_name, entity_group;
