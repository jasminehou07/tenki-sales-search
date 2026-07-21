from pathlib import Path


path = Path("/opt/tenki-dashboard/api/server.js")
text = path.read_text()

start = text.index("app.get('/api/genre/rank-rows', async (req, res) => {")
end = text.index("app.get('/api/genre/rank-projection', async (req, res) => {", start)

route = r"""
app.get('/api/genre/rank-rows', async (req, res) => {
  const genreParam = String(req.query.genreId || 'all');
  const genreId = genreParam === 'all' ? null : intParam(genreParam);
  const start = isoDate(req.query.start, '2017-01-01');
  const end = isoDate(req.query.end, '2026-12-31');
  const limit = Math.min(Math.max(intParam(req.query.limit, 80) || 80, 1), 80);
  if (genreParam !== 'all' && !genreId) return res.status(400).json({ error: 'genreId_required' });

  if (!genreId) {
    return query(res, `
      WITH ranked AS (
        SELECT
          date::text AS date,
          genre_id::text AS genre,
          rank,
          shop_id::text AS shop,
          item_id::text AS item,
          CASE WHEN source IN ('actual', 'known_tenki', 'hybrid') THEN 'actual' ELSE 'estimated' END AS source,
          sales,
          sales_low,
          sales_high,
          ROW_NUMBER() OVER (
            PARTITION BY date
            ORDER BY sales DESC NULLS LAST, rank ASC, genre_id ASC, shop_id ASC, item_id ASC
          ) AS display_rank
        FROM dashboard_rank_rows
        WHERE date BETWEEN $1::date AND $2::date
          AND rank BETWEEN 1 AND 80
          AND sales > 0
          AND shop_id IS NOT NULL
          AND item_id IS NOT NULL
      )
      SELECT date, genre, display_rank AS rank, shop, item, source,
             sales::text, sales_low::text, sales_high::text,
             ''::text AS lower_rank, ''::text AS upper_rank, ''::text AS lower_sales, ''::text AS upper_sales
      FROM ranked
      WHERE display_rank <= $3
      ORDER BY date, display_rank
    `, [start, end, limit]);
  }

  return query(res, `
    SELECT date::text AS date,
           genre_id::text AS genre,
           rank,
           COALESCE(shop_id::text, '') AS shop,
           COALESCE(item_id::text, '') AS item,
           CASE WHEN source IN ('actual', 'known_tenki', 'hybrid') THEN 'actual' ELSE 'estimated' END AS source,
           sales::text,
           sales_low::text,
           sales_high::text,
           COALESCE(lower_rank::text, '') AS lower_rank,
           COALESCE(upper_rank::text, '') AS upper_rank,
           COALESCE(lower_sales::text, '') AS lower_sales,
           COALESCE(upper_sales::text, '') AS upper_sales
    FROM dashboard_rank_rows
    WHERE genre_id = $1
      AND date BETWEEN $2::date AND $3::date
      AND rank BETWEEN 1 AND $4
    ORDER BY date, rank
  `, [genreId, start, end, limit]);
});

"""

path.write_text(text[:start] + route + text[end:])
