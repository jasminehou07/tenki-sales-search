from pathlib import Path


path = Path("/opt/tenki-dashboard/api/server.js")
text = path.read_text()

needle = "  if (!genreId) {\n    return query(res, `\n      WITH ranked AS ("
replacement = """  const aggregate = String(req.query.aggregate || '') === '1';

  if (aggregate && !genreId) {
    return query(res, `
      WITH item_totals AS (
        SELECT
          genre_id,
          shop_id,
          item_id,
          MIN(rank) AS source_rank,
          SUM(sales) AS sales,
          SUM(COALESCE(sales_low, sales)) AS sales_low,
          SUM(COALESCE(sales_high, sales)) AS sales_high,
          CASE WHEN BOOL_AND(source IN ('actual', 'known_tenki', 'hybrid')) THEN 'actual' ELSE 'estimated' END AS source
        FROM dashboard_rank_rows
        WHERE date BETWEEN $1::date AND $2::date
          AND rank BETWEEN 1 AND 80
          AND sales > 0
          AND shop_id IS NOT NULL
          AND item_id IS NOT NULL
        GROUP BY genre_id, shop_id, item_id
      ), ranked AS (
        SELECT
          $1::date::text AS date,
          genre_id::text AS genre,
          shop_id::text AS shop,
          item_id::text AS item,
          source,
          sales,
          sales_low,
          sales_high,
          ROW_NUMBER() OVER (ORDER BY sales DESC NULLS LAST, source_rank ASC, genre_id ASC, shop_id ASC, item_id ASC) AS display_rank
        FROM item_totals
      )
      SELECT date, genre, display_rank AS rank, shop, item, source,
             sales::text, sales_low::text, sales_high::text,
             ''::text AS lower_rank, ''::text AS upper_rank, ''::text AS lower_sales, ''::text AS upper_sales
      FROM ranked
      WHERE display_rank <= $3
      ORDER BY display_rank
    `, [start, end, limit]);
  }

  if (aggregate && genreId) {
    return query(res, `
      WITH rank_totals AS (
        SELECT
          rank,
          SUM(sales) AS sales,
          SUM(COALESCE(sales_low, sales)) AS sales_low,
          SUM(COALESCE(sales_high, sales)) AS sales_high,
          CASE WHEN BOOL_AND(source IN ('actual', 'known_tenki', 'hybrid')) THEN 'actual' ELSE 'estimated' END AS source
        FROM dashboard_rank_rows
        WHERE genre_id = $1
          AND date BETWEEN $2::date AND $3::date
          AND rank BETWEEN 1 AND $4
          AND sales > 0
        GROUP BY rank
      ), top_identity AS (
        SELECT DISTINCT ON (rank)
          rank,
          shop_id::text AS shop,
          item_id::text AS item
        FROM dashboard_rank_rows
        WHERE genre_id = $1
          AND date BETWEEN $2::date AND $3::date
          AND rank BETWEEN 1 AND $4
          AND shop_id IS NOT NULL
          AND item_id IS NOT NULL
        ORDER BY rank, sales DESC NULLS LAST, date DESC, shop_id ASC, item_id ASC
      )
      SELECT $2::date::text AS date,
             $1::text AS genre,
             rt.rank,
             COALESCE(ti.shop, '') AS shop,
             COALESCE(ti.item, '') AS item,
             rt.source,
             rt.sales::text,
             rt.sales_low::text,
             rt.sales_high::text,
             ''::text AS lower_rank, ''::text AS upper_rank, ''::text AS lower_sales, ''::text AS upper_sales
      FROM rank_totals rt
      LEFT JOIN top_identity ti ON ti.rank = rt.rank
      ORDER BY rt.rank
    `, [genreId, start, end, limit]);
  }

  if (!genreId) {
    return query(res, `
      WITH ranked AS ("""

if needle not in text:
    raise SystemExit("aggregate insertion point not found")

path.write_text(text.replace(needle, replacement, 1))
