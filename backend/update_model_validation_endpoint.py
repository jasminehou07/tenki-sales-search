from pathlib import Path

server_path = Path("/opt/tenki-dashboard/api/server.js")
text = server_path.read_text()

start = text.index("app.get('/api/model-validation'")
end = text.index("\n\nfunction csvEscape", start)

route = r"""app.get('/api/model-validation', (req, res) => {
  const entityType = req.query.entityType || null;
  const metricName = req.query.metricName || null;
  const modelName = req.query.modelName || null;
  const genreId = intParam(req.query.genreId);
  const shopId = intParam(req.query.shopId);
  const startDate = isoDate(req.query.startDate || req.query.start, null);
  const endDate = isoDate(req.query.endDate || req.query.end, startDate);
  const includeDaily = String(req.query.includeDaily || '') === '1';

  if ((startDate || endDate) && (!metricName || metricName === 'WMAPE')) {
    const scopedType = entityType === 'shop' ? 'shop' : 'genre';
    const scopedModelName = scopedType === 'shop' ? 'Shop sales model' : (modelName || 'Genre sales model');
    const params = [startDate || endDate, endDate || startDate, scopedModelName, scopedType, genreId, shopId];
    const where = ['validation_date BETWEEN $1::date AND $2::date'];

    if (scopedType === 'genre' && genreId) where.push('genre_id = $5');
    if (scopedType === 'shop' && shopId) where.push('shop_id = $6');
    if (modelName && scopedType === 'genre') {
      params.push(modelName);
      where.push(`model_name = $${params.length}`);
    }

    const dailySelect = includeDaily ? `
      UNION ALL
      SELECT
        validation_date,
        MAX(model_version) AS model_version,
        $3::text AS model_name,
        $4::text AS entity_type,
        MAX(entity_group) AS entity_group,
        CASE WHEN $4::text = 'genre' THEN $5::bigint ELSE NULL::bigint END AS genre_id,
        CASE WHEN $4::text = 'shop' THEN $6::bigint ELSE NULL::bigint END AS shop_id,
        NULL::text AS event_name,
        'WMAPE'::text AS metric_name,
        SUM(ABS(predicted_sales - actual_sales)) / NULLIF(SUM(ABS(actual_sales)), 0) * 100 AS metric_value,
        COUNT(*)::integer AS sample_size,
        MAX(created_at) AS evaluated_at
      FROM filtered
      GROUP BY validation_date
    ` : '';

    return query(res, `
      WITH filtered AS (
        SELECT *
        FROM model_validation_holdout_predictions
        WHERE ${where.join(' AND ')}
      )
      SELECT
        NULL::date AS validation_date,
        MAX(model_version) AS model_version,
        $3::text AS model_name,
        $4::text AS entity_type,
        MAX(entity_group) AS entity_group,
        CASE WHEN $4::text = 'genre' THEN $5::bigint ELSE NULL::bigint END AS genre_id,
        CASE WHEN $4::text = 'shop' THEN $6::bigint ELSE NULL::bigint END AS shop_id,
        NULL::text AS event_name,
        'WMAPE'::text AS metric_name,
        SUM(ABS(predicted_sales - actual_sales)) / NULLIF(SUM(ABS(actual_sales)), 0) * 100 AS metric_value,
        COUNT(*)::integer AS sample_size,
        MAX(created_at) AS evaluated_at
      FROM filtered
      HAVING COUNT(*) > 0
      ${dailySelect}
      ORDER BY validation_date NULLS FIRST
    `, params);
  }

  const params = [];
  const where = ['1=1'];

  if (entityType) {
    params.push(entityType);
    where.push(`entity_type = $${params.length}`);
  }
  if (metricName) {
    params.push(metricName);
    where.push(`metric_name = $${params.length}`);
  }
  if (modelName) {
    params.push(modelName);
    where.push(`model_name = $${params.length}`);
  }
  if (genreId) {
    params.push(genreId);
    where.push(`genre_id = $${params.length}`);
  }
  if (shopId) {
    params.push(shopId);
    where.push(`shop_id = $${params.length}`);
  }

  return query(res, `
    SELECT DISTINCT ON (
      model_name,
      entity_type,
      COALESCE(genre_id, 0),
      COALESCE(shop_id, 0),
      COALESCE(event_name, ''),
      metric_name
    )
      NULL::date AS validation_date,
      model_version,
      model_name,
      entity_type,
      entity_group,
      genre_id::text AS genre_id,
      shop_id::text AS shop_id,
      event_name,
      metric_name,
      metric_value,
      sample_size,
      evaluated_at
    FROM model_validation_metrics
    WHERE ${where.join(' AND ')}
    ORDER BY
      model_name,
      entity_type,
      COALESCE(genre_id, 0),
      COALESCE(shop_id, 0),
      COALESCE(event_name, ''),
      metric_name,
      evaluated_at DESC
  `, params);
});"""

backup_path = server_path.with_suffix(".js.bak-date-scoped-validation")
backup_path.write_text(text)
server_path.write_text(text[:start] + route + text[end:])
print("updated_model_validation_endpoint")
