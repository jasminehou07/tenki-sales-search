from pathlib import Path

server_path = Path("/opt/tenki-dashboard/api/server.js")
text = server_path.read_text()

route = r"""
app.get('/api/model-validation', (req, res) => {
  const entityType = req.query.entityType || null;
  const metricName = req.query.metricName || null;
  const modelName = req.query.modelName || null;
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

  return query(res, `
    SELECT DISTINCT ON (
      model_name,
      entity_type,
      COALESCE(genre_id, 0),
      COALESCE(shop_id, 0),
      COALESCE(event_name, ''),
      metric_name
    )
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
});

"""

if "app.get('/api/model-validation'" not in text:
    marker = "\n\nfunction csvEscape(value) {"
    if marker not in text:
        raise SystemExit("marker_not_found")
    text = text.replace(marker, "\n\n" + route + "function csvEscape(value) {", 1)
    server_path.with_suffix(".js.bak-model-validation").write_text(server_path.read_text())
    server_path.write_text(text)
    print("added_model_validation_endpoint")
else:
    print("model_validation_endpoint_already_present")
