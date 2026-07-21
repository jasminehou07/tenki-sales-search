COPY (
  SELECT
    date::VARCHAR AS date,
    shop::BIGINT AS shop,
    item_genre::BIGINT AS genre,
    item::BIGINT AS item,
    SUM(sales)::BIGINT AS sales,
    SUM(sales_items)::BIGINT AS units
  FROM read_parquet('/Users/jasminehou/Downloads/tenki/data files/genre-sales/*.parquet')
  WHERE sales > 0 OR sales_items > 0
  GROUP BY date, shop, item_genre, item
  ORDER BY date, sales DESC, units DESC
) TO '/Users/jasminehou/Documents/Codex/2026-06-02/my-boss-wants-me-to-create/work/item_sales_daily.csv'
WITH (HEADER, DELIMITER ',');
