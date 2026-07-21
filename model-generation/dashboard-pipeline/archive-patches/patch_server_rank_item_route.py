from pathlib import Path

path = Path("/opt/tenki-dashboard/api/server.js")
text = path.read_text()

text = text.replace(
    "  { name: 'upper_sales', key: 'upper_sales' },\n];",
    "  { name: 'upper_sales', key: 'upper_sales' },\n  { name: 'item', key: 'item' },\n];",
    1,
)

old = """    SELECT date::text AS date, genre_id::text AS genre, rank::text AS rank,
           COALESCE(shop_id::text, '') AS shop,
           CASE WHEN source_kind IN ('known_tenki', 'hybrid') THEN 'known_tenki' ELSE 'estimated' END AS source,
           estimated_sales_yen::text AS sales, sales_low_95::text AS sales_low, sales_high_95::text AS sales_high,
           ''::text AS lower_rank, ''::text AS upper_rank, ''::text AS lower_sales, ''::text AS upper_sales
    FROM dashboard_genre_rank_daily
    WHERE genre_id = $1 AND date >= $2::date AND date < ($3::date + INTERVAL '1 month') AND model_version = $4 AND rank BETWEEN 1 AND 80
    ORDER BY date, dashboard_genre_rank_daily.rank
"""

new = """    SELECT d.date::text AS date, d.genre_id::text AS genre, d.rank::text AS rank,
           COALESCE(rr.shop_id::text, d.shop_id::text, '') AS shop,
           CASE WHEN d.source_kind IN ('known_tenki', 'hybrid') THEN 'known_tenki' ELSE 'estimated' END AS source,
           d.estimated_sales_yen::text AS sales, d.sales_low_95::text AS sales_low, d.sales_high_95::text AS sales_high,
           ''::text AS lower_rank, ''::text AS upper_rank, ''::text AS lower_sales, ''::text AS upper_sales,
           COALESCE(rr.item_id::text, '') AS item
    FROM dashboard_genre_rank_daily d
    LEFT JOIN LATERAL (
      SELECT raw.shop_id, raw.item_id
      FROM raw_genre_rankings raw
      WHERE raw.genre_id = d.genre_id AND raw.date = d.date AND raw.rank = d.rank
      ORDER BY raw.source_file DESC, raw.shop_id, raw.item_id
      LIMIT 1
    ) rr ON true
    WHERE d.genre_id = $1 AND d.date >= $2::date AND d.date < ($3::date + INTERVAL '1 month') AND d.model_version = $4 AND d.rank BETWEEN 1 AND 80
    ORDER BY d.date, d.rank
"""

if old not in text:
    raise SystemExit("rank route SQL pattern not found")

path.write_text(text.replace(old, new, 1))
