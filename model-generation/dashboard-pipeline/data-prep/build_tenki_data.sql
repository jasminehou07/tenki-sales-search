COPY (
  WITH daily AS (
    SELECT
      date::VARCHAR AS date,
      shop::BIGINT AS shop,
      item_genre::BIGINT AS genre,
      SUM(sales)::BIGINT AS sales,
      SUM(sales_items)::BIGINT AS units,
      SUM(sales_number)::BIGINT AS orders,
      SUM(pv)::BIGINT AS page_views,
      SUM(uv)::BIGINT AS visitors,
      SUM(acc)::BIGINT AS carts,
      SUM(reviews_posted)::BIGINT AS reviews_posted,
      CASE
        WHEN SUM(reviews_total) > 0
        THEN ROUND(SUM(reviews_rating * reviews_total) / SUM(reviews_total), 2)
        ELSE NULL
      END AS avg_rating,
      SUM(reviews_total)::BIGINT AS review_count
    FROM read_parquet('/Users/jasminehou/Downloads/tenki/data files/genre-sales/*.parquet')
    GROUP BY date, shop, item_genre
  )
  SELECT *
  FROM daily
  ORDER BY date, shop, genre
) TO '/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/outputs/data/sales_daily.csv'
WITH (HEADER, DELIMITER ',');

COPY (
  SELECT
    'date' AS type,
    date::VARCHAR AS id,
    date::VARCHAR AS label,
    SUM(sales)::BIGINT AS sales
  FROM read_parquet('/Users/jasminehou/Downloads/tenki/data files/genre-sales/*.parquet')
  GROUP BY date
  UNION ALL
  SELECT
    'shop' AS type,
    shop::VARCHAR AS id,
    'Shop ' || shop::VARCHAR AS label,
    SUM(sales)::BIGINT AS sales
  FROM read_parquet('/Users/jasminehou/Downloads/tenki/data files/genre-sales/*.parquet')
  GROUP BY shop
  UNION ALL
  SELECT
    'genre' AS type,
    item_genre::VARCHAR AS id,
    'Product genre ' || item_genre::VARCHAR AS label,
    SUM(sales)::BIGINT AS sales
  FROM read_parquet('/Users/jasminehou/Downloads/tenki/data files/genre-sales/*.parquet')
  GROUP BY item_genre
  ORDER BY type, sales DESC
) TO '/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/outputs/data/filter_options.csv'
WITH (HEADER, DELIMITER ',');

COPY (
  SELECT
    name,
    start::DATE::VARCHAR AS start_date,
    "end"::DATE::VARCHAR AS end_date
  FROM read_parquet('/Users/jasminehou/Downloads/tenki/data files/events/events.parquet')
  ORDER BY start
) TO '/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/outputs/data/events.csv'
WITH (HEADER, DELIMITER ',');
