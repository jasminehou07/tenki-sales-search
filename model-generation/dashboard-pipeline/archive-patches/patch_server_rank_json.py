from pathlib import Path


path = Path("/opt/tenki-dashboard/api/server.js")
text = path.read_text()

anchor = "app.get('/api/genre/rank-projection', async (req, res) => {"

route = r"""
app.get('/api/genre/rank-rows', async (req, res) => {
  const genreParam = String(req.query.genreId || 'all');
  const genreId = genreParam === 'all' ? null : intParam(genreParam);
  const start = isoDate(req.query.start, '2017-01-01');
  const end = isoDate(req.query.end, '2026-12-31');
  const limit = Math.min(Math.max(intParam(req.query.limit, 80) || 80, 1), 80);
  const modelVersion = req.query.modelVersion || await latestModelVersion('dashboard_genre_rank_daily');
  if (genreParam !== 'all' && !genreId) return res.status(400).json({ error: 'genreId_required' });

  if (!genreId) {
    return query(res, `
      WITH ranked AS (
        SELECT
          d.date::text AS date,
          d.genre_id::text AS genre,
          d.rank,
          COALESCE(rr.shop_id, d.shop_id)::text AS shop,
          COALESCE(rr.item_id::text, '') AS item,
          CASE WHEN d.source_kind IN ('known_tenki', 'hybrid') THEN 'actual' ELSE 'estimated' END AS source,
          d.estimated_sales_yen AS sales,
          d.sales_low_95 AS sales_low,
          d.sales_high_95 AS sales_high,
          ROW_NUMBER() OVER (
            PARTITION BY d.date
            ORDER BY d.estimated_sales_yen DESC, d.rank ASC, d.genre_id ASC, COALESCE(rr.shop_id, d.shop_id) ASC, rr.item_id ASC
          ) AS display_rank
        FROM dashboard_genre_rank_daily d
        LEFT JOIN LATERAL (
          SELECT raw.shop_id, raw.item_id
          FROM raw_genre_rankings raw
          WHERE raw.genre_id = d.genre_id AND raw.date = d.date AND raw.rank = d.rank
          ORDER BY raw.source_file DESC, raw.shop_id, raw.item_id
          LIMIT 1
        ) rr ON true
        WHERE d.date BETWEEN $1::date AND $2::date
          AND d.model_version = $3
          AND d.rank BETWEEN 1 AND 80
          AND d.estimated_sales_yen > 0
          AND COALESCE(rr.shop_id, d.shop_id) IS NOT NULL
          AND rr.item_id IS NOT NULL
      )
      SELECT date, genre, display_rank AS rank, shop, item, source,
             sales::text, sales_low::text, sales_high::text,
             ''::text AS lower_rank, ''::text AS upper_rank, ''::text AS lower_sales, ''::text AS upper_sales
      FROM ranked
      WHERE display_rank <= $4
      ORDER BY date, display_rank
    `, [start, end, modelVersion, limit]);
  }

  return query(res, `
    SELECT d.date::text AS date, d.genre_id::text AS genre, d.rank,
           COALESCE(rr.shop_id, d.shop_id)::text AS shop,
           COALESCE(rr.item_id::text, '') AS item,
           CASE WHEN d.source_kind IN ('known_tenki', 'hybrid') THEN 'actual' ELSE 'estimated' END AS source,
           d.estimated_sales_yen::text AS sales,
           d.sales_low_95::text AS sales_low,
           d.sales_high_95::text AS sales_high,
           ''::text AS lower_rank, ''::text AS upper_rank, ''::text AS lower_sales, ''::text AS upper_sales
    FROM dashboard_genre_rank_daily d
    LEFT JOIN LATERAL (
      SELECT raw.shop_id, raw.item_id
      FROM raw_genre_rankings raw
      WHERE raw.genre_id = d.genre_id AND raw.date = d.date AND raw.rank = d.rank
      ORDER BY raw.source_file DESC, raw.shop_id, raw.item_id
      LIMIT 1
    ) rr ON true
    WHERE d.genre_id = $1
      AND d.date BETWEEN $2::date AND $3::date
      AND d.model_version = $4
      AND d.rank BETWEEN 1 AND $5
    ORDER BY d.date, d.rank
  `, [genreId, start, end, modelVersion, limit]);
});

"""

if "/api/genre/rank-rows" not in text:
    if anchor not in text:
        raise SystemExit("rank-projection route anchor not found")
    text = text.replace(anchor, route + anchor, 1)
    path.write_text(text)
