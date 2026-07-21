from pathlib import Path


path = Path("/opt/tenki-dashboard/api/server.js")
text = path.read_text()

anchor = "app.get('/api/events', (req, res) => {"

route = r"""
app.get('/api/top-shops', async (req, res) => {
  const start = isoDate(req.query.start, '2017-01-01');
  const end = isoDate(req.query.end, '2026-12-31');
  const genreId = req.query.genreId === 'all' ? null : intParam(req.query.genreId);
  const shopId = req.query.shopId === 'all' ? null : intParam(req.query.shopId);
  const limit = Math.min(Math.max(intParam(req.query.limit, 25) || 25, 1), 100);
  const where = ['date BETWEEN $1::date AND $2::date'];
  const params = [start, end];
  if (genreId) {
    params.push(genreId);
    where.push(`item_genre = $${params.length}`);
  }
  if (shopId) {
    params.push(shopId);
    where.push(`shop_id = $${params.length}`);
  }
  params.push(limit);
  return query(res, `
    WITH base AS (
      SELECT shop_id, item_id, SUM(sales_yen) AS item_sales, SUM(units_sold) AS item_units, COUNT(*) AS item_rows
      FROM raw_genre_sales
      WHERE ${where.join(' AND ')}
      GROUP BY shop_id, item_id
      HAVING SUM(sales_yen) > 0 OR SUM(units_sold) > 0
    ), shop_totals AS (
      SELECT shop_id, SUM(item_sales) AS total_shop_sales, SUM(item_rows) AS known_rows
      FROM base
      GROUP BY shop_id
    ), top_items AS (
      SELECT shop_id, item_id, item_sales, item_units,
             ROW_NUMBER() OVER (PARTITION BY shop_id ORDER BY item_sales DESC, item_units DESC, item_id) AS item_rank
      FROM base
    ), grand_total AS (
      SELECT SUM(total_shop_sales) AS total_sales FROM shop_totals
    )
    SELECT st.shop_id::text AS shop,
           st.total_shop_sales::text AS total_shop_sales,
           CASE WHEN gt.total_sales > 0 THEN (st.total_shop_sales / gt.total_sales)::text ELSE '0' END AS sales_share,
           st.known_rows::text AS known_rows,
           ti.item_id::text AS top_item
    FROM shop_totals st
    CROSS JOIN grand_total gt
    LEFT JOIN top_items ti ON ti.shop_id = st.shop_id AND ti.item_rank = 1
    ORDER BY st.total_shop_sales DESC, st.shop_id
    LIMIT $${params.length}
  `, params);
});

"""

if "/api/top-shops" not in text:
    if anchor not in text:
        raise SystemExit("events route anchor not found")
    text = text.replace(anchor, route + anchor, 1)
    path.write_text(text)
