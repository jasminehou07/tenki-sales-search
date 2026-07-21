require('dotenv').config({ path: '/opt/tenki-dashboard/.env' });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const port = Number(process.env.PORT || 3000);
const corsOrigins = new Set((process.env.CORS_ORIGIN || 'https://jasminehou07.github.io').split(',').map((origin) => origin.trim()).filter(Boolean));
const CSV_DATA_ROOT = '/opt/tenki-dashboard/site-data/data';
const SITE_ROOT = process.env.SITE_ROOT || '/opt/tenki-dashboard/site-data';

const pool = new Pool({
  connectionString: process.env.API_DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

app.use(helmet());
app.use(compression());
app.use(cors({
  origin(origin, callback) {
    if (!origin || origin === 'null' || corsOrigins.has(origin)) return callback(null, true);
    return callback(new Error('origin_not_allowed'));
  }
}));
app.use(express.json({ limit: '1mb' }));

function isoDate(value, fallback) {
  if (!value) return fallback;
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return fallback;
  return text;
}

function intParam(value, fallback = null) {
  if (value === undefined || value === null || value === '' || value === 'all') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

async function query(res, sql, params = []) {
  try {
    const { rows } = await pool.query(sql, params);
    res.json({ rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'database_query_failed' });
  }
}

async function latestModelVersion(_tableName) {
  return process.env.MODEL_VERSION || 'github-pages-current';
}

app.get('/health', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT now() AS now');
    res.json({ ok: true, now: rows[0].now });
  } catch (error) {
    res.status(500).json({ ok: false });
  }
});

app.get('/api/options/genres', (_req, res) => query(res, `
  SELECT genre_id, genre_name_ja, genre_name_en, genre_group, dropdown_sales_yen
  FROM genres
  WHERE active = true
  ORDER BY dropdown_sales_yen DESC, genre_name_en NULLS LAST, genre_id
`));

app.get('/api/options/shops', (_req, res) => query(res, `
  SELECT shop_id, COALESCE(shop_label, 'Shop ' || shop_id::text) AS shop_label, shop_group, dropdown_sales_yen
  FROM shops
  WHERE active = true
  ORDER BY dropdown_sales_yen DESC, shop_id
`));

app.get('/api/genre/summary', async (req, res) => {
  const genreId = req.query.genreId === 'all' ? null : intParam(req.query.genreId);
  const start = isoDate(req.query.start, '2017-01-01');
  const end = isoDate(req.query.end, '2026-12-31');
  const modelVersion = req.query.modelVersion || await latestModelVersion('dashboard_genre_daily');
  if (!genreId) {
    return query(res, `
      SELECT COUNT(*) AS days, SUM(estimated_sales_yen) AS estimated_sales_yen,
             SUM(sales_low_95) AS sales_low_95, SUM(sales_high_95) AS sales_high_95,
             SUM(estimated_units) AS estimated_units, SUM(units_low_95) AS units_low_95,
             SUM(units_high_95) AS units_high_95
      FROM mv_dashboard_all_genres_daily
      WHERE date BETWEEN $1 AND $2 AND model_version = $3
    `, [start, end, modelVersion]);
  }
  return query(res, `
    SELECT COUNT(*) AS days, SUM(estimated_sales_yen) AS estimated_sales_yen,
           SUM(sales_low_95) AS sales_low_95, SUM(sales_high_95) AS sales_high_95,
           SUM(estimated_units) AS estimated_units, SUM(units_low_95) AS units_low_95,
           SUM(units_high_95) AS units_high_95, SUM(known_page_views) AS known_page_views
    FROM dashboard_genre_daily
    WHERE genre_id = $1 AND date BETWEEN $2 AND $3 AND model_version = $4
  `, [genreId, start, end, modelVersion]);
});

app.get('/api/genre/trend', async (req, res) => {
  const genreId = req.query.genreId === 'all' ? null : intParam(req.query.genreId);
  const start = isoDate(req.query.start, '2017-01-01');
  const end = isoDate(req.query.end, '2026-12-31');
  const modelVersion = req.query.modelVersion || await latestModelVersion('dashboard_genre_daily');
  if (!genreId) {
    return query(res, `
      SELECT date, estimated_sales_yen, sales_low_95, sales_high_95, estimated_units
      FROM mv_dashboard_all_genres_daily
      WHERE date BETWEEN $1 AND $2 AND model_version = $3
      ORDER BY date
    `, [start, end, modelVersion]);
  }
  return query(res, `
    SELECT date, estimated_sales_yen, sales_low_95, sales_high_95, estimated_units, source_kind
    FROM dashboard_genre_daily
    WHERE genre_id = $1 AND date BETWEEN $2 AND $3 AND model_version = $4
    ORDER BY date
  `, [genreId, start, end, modelVersion]);
});

app.get('/api/genre/ranks', async (req, res) => {
  const genreId = intParam(req.query.genreId);
  const start = isoDate(req.query.start, '2017-01-01');
  const end = isoDate(req.query.end, '2026-12-31');
  const modelVersion = req.query.modelVersion || await latestModelVersion('dashboard_genre_rank_daily');
  if (!genreId) return res.status(400).json({ error: 'genreId_required' });
  return query(res, `
    SELECT rank,
           MAX(shop_id) FILTER (WHERE source_kind IN ('known_tenki', 'hybrid')) AS known_shop_id,
           SUM(estimated_sales_yen) AS estimated_sales_yen,
           SUM(sales_low_95) AS sales_low_95,
           SUM(sales_high_95) AS sales_high_95,
           SUM(estimated_units) AS estimated_units,
           CASE WHEN BOOL_OR(source_kind IN ('known_tenki', 'hybrid')) THEN 'known_tenki' ELSE 'model' END AS source_kind
    FROM dashboard_genre_rank_daily
    WHERE genre_id = $1 AND date BETWEEN $2 AND $3 AND model_version = $4 AND rank BETWEEN 1 AND 20
    GROUP BY rank
    ORDER BY rank
  `, [genreId, start, end, modelVersion]);
});



app.get('/api/genre/rank-rows', async (req, res) => {
  const genreParam = String(req.query.genreId || 'all');
  const genreId = genreParam === 'all' ? null : intParam(genreParam);
  const start = isoDate(req.query.start, '2017-01-01');
  const end = isoDate(req.query.end, '2026-12-31');
  const limit = Math.min(Math.max(intParam(req.query.limit, 80) || 80, 1), 80);
  if (genreParam !== 'all' && !genreId) return res.status(400).json({ error: 'genreId_required' });

  const aggregate = String(req.query.aggregate || '') === '1';

  if (aggregate && !genreId) {
    return query(res, `
      WITH candidates AS (
        SELECT
          genre_id,
          shop_id,
          item_id,
          rank,
          sales,
          sales_low,
          sales_high,
          source
        FROM dashboard_rank_rows
        WHERE date BETWEEN $1::date AND $2::date
          AND rank BETWEEN 1 AND 80
          AND sales > 0
          AND shop_id IS NOT NULL
          AND item_id IS NOT NULL
        ORDER BY sales DESC NULLS LAST, rank ASC, genre_id ASC, shop_id ASC, item_id ASC
        LIMIT LEAST(GREATEST((($2::date - $1::date + 1) * $3 * 20), 5000), 200000)
      ), item_totals AS (
        SELECT
          genre_id,
          shop_id,
          item_id,
          MIN(rank) AS source_rank,
          SUM(sales) AS sales,
          SUM(COALESCE(sales_low, sales)) AS sales_low,
          SUM(COALESCE(sales_high, sales)) AS sales_high,
          CASE WHEN BOOL_AND(source IN ('actual', 'known_tenki', 'hybrid')) THEN 'actual' ELSE 'estimated' END AS source
        FROM candidates
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

app.get('/api/genre/rank-projection', async (req, res) => {
  const genreId = intParam(req.query.genreId);
  const rank = intParam(req.query.rank, 1);
  const start = isoDate(req.query.start, '2017-01-01');
  const end = isoDate(req.query.end, '2026-12-31');
  const modelVersion = req.query.modelVersion || await latestModelVersion('dashboard_genre_rank_daily');
  if (!genreId) return res.status(400).json({ error: 'genreId_required' });
  return query(res, `
    SELECT date, rank, shop_id, estimated_sales_yen, sales_low_95, sales_high_95, source_kind
    FROM dashboard_genre_rank_daily
    WHERE genre_id = $1 AND rank = $2 AND date BETWEEN $3 AND $4 AND model_version = $5
    ORDER BY date
  `, [genreId, rank, start, end, modelVersion]);
});


app.get('/api/shop/daily', async (req, res) => {
  const shopId = req.query.shopId === 'all' ? null : intParam(req.query.shopId);
  const start = isoDate(req.query.start, '2017-01-01');
  const end = isoDate(req.query.end, '2026-12-31');
  const modelVersion = req.query.modelVersion || await latestModelVersion('dashboard_shop_daily');
  if (!shopId) {
    return query(res, `
      SELECT date::text AS date,
             'all'::text AS shop,
             'all'::text AS genre,
             estimated_sales_yen::text AS predicted_sales,
             sales_low_95::text AS predicted_sales_low,
             sales_high_95::text AS predicted_sales_high,
             estimated_units::text AS predicted_units,
             units_low_95::text AS predicted_units_low,
             units_high_95::text AS predicted_units_high,
             '0'::text AS predicted_page_views,
             '0'::text AS predicted_page_views_low,
             '0'::text AS predicted_page_views_high
      FROM mv_dashboard_all_shops_daily
      WHERE date BETWEEN $1::date AND $2::date AND model_version = $3
      ORDER BY date
    `, [start, end, modelVersion]);
  }
  return query(res, `
    SELECT date::text AS date,
           shop_id::text AS shop,
           'all'::text AS genre,
           estimated_sales_yen::text AS predicted_sales,
           sales_low_95::text AS predicted_sales_low,
           sales_high_95::text AS predicted_sales_high,
           estimated_units::text AS predicted_units,
           units_low_95::text AS predicted_units_low,
           units_high_95::text AS predicted_units_high,
           '0'::text AS predicted_page_views,
           '0'::text AS predicted_page_views_low,
           '0'::text AS predicted_page_views_high
    FROM dashboard_shop_daily
    WHERE shop_id = $1 AND date BETWEEN $2::date AND $3::date AND model_version = $4
    ORDER BY date
  `, [shopId, start, end, modelVersion]);
});

app.get('/api/shop/genre-daily', async (req, res) => {
  const shopId = req.query.shopId === 'all' ? null : intParam(req.query.shopId);
  const start = isoDate(req.query.start, '2017-01-01');
  const end = isoDate(req.query.end, '2026-12-31');
  const aggregate = String(req.query.aggregate || '') === '1';
  const modelVersion = req.query.modelVersion || await latestModelVersion('dashboard_shop_genre_daily');
  if (!shopId) {
    if (aggregate) {
      return query(res, `
        SELECT $1::date::text AS date,
               shop_id::text AS shop,
               'all'::text AS genre,
               SUM(estimated_sales_yen)::text AS predicted_sales,
               SUM(sales_low_95)::text AS predicted_sales_low,
               SUM(sales_high_95)::text AS predicted_sales_high,
               SUM(estimated_units)::text AS predicted_units,
               SUM(units_low_95)::text AS predicted_units_low,
               SUM(units_high_95)::text AS predicted_units_high,
               '0'::text AS predicted_page_views,
               '0'::text AS predicted_page_views_low,
               '0'::text AS predicted_page_views_high
        FROM dashboard_shop_daily
        WHERE date BETWEEN $1::date AND $2::date AND model_version = $3
        GROUP BY shop_id
        ORDER BY SUM(estimated_sales_yen) DESC, shop_id
      `, [start, end, modelVersion]);
    }
    return query(res, `
      SELECT date::text AS date,
             shop_id::text AS shop,
             'all'::text AS genre,
             estimated_sales_yen::text AS predicted_sales,
             sales_low_95::text AS predicted_sales_low,
             sales_high_95::text AS predicted_sales_high,
             estimated_units::text AS predicted_units,
             units_low_95::text AS predicted_units_low,
             units_high_95::text AS predicted_units_high,
             '0'::text AS predicted_page_views,
             '0'::text AS predicted_page_views_low,
             '0'::text AS predicted_page_views_high
      FROM dashboard_shop_daily
      WHERE date BETWEEN $1::date AND $2::date AND model_version = $3
      ORDER BY date, shop_id
    `, [start, end, modelVersion]);
  }
  if (aggregate) {
    return query(res, `
      SELECT $2::date::text AS date,
             shop_id::text AS shop,
             genre_id::text AS genre,
             SUM(estimated_sales_yen)::text AS predicted_sales,
             SUM(sales_low_95)::text AS predicted_sales_low,
             SUM(sales_high_95)::text AS predicted_sales_high,
             SUM(estimated_units)::text AS predicted_units,
             SUM(units_low_95)::text AS predicted_units_low,
             SUM(units_high_95)::text AS predicted_units_high,
             '0'::text AS predicted_page_views,
             '0'::text AS predicted_page_views_low,
             '0'::text AS predicted_page_views_high
      FROM dashboard_shop_genre_daily
      WHERE shop_id = $1 AND date BETWEEN $2::date AND $3::date AND model_version = $4
      GROUP BY shop_id, genre_id
      ORDER BY SUM(estimated_sales_yen) DESC, genre_id
    `, [shopId, start, end, modelVersion]);
  }
  return query(res, `
    SELECT date::text AS date,
           shop_id::text AS shop,
           genre_id::text AS genre,
           estimated_sales_yen::text AS predicted_sales,
           sales_low_95::text AS predicted_sales_low,
           sales_high_95::text AS predicted_sales_high,
           estimated_units::text AS predicted_units,
           units_low_95::text AS predicted_units_low,
           units_high_95::text AS predicted_units_high,
           '0'::text AS predicted_page_views,
           '0'::text AS predicted_page_views_low,
           '0'::text AS predicted_page_views_high
    FROM dashboard_shop_genre_daily
    WHERE shop_id = $1 AND date BETWEEN $2::date AND $3::date AND model_version = $4
    ORDER BY date, genre_id
  `, [shopId, start, end, modelVersion]);
});

app.get('/api/shop/summary', async (req, res) => {
  const shopId = req.query.shopId === 'all' ? null : intParam(req.query.shopId);
  const start = isoDate(req.query.start, '2017-01-01');
  const end = isoDate(req.query.end, '2026-12-31');
  const modelVersion = req.query.modelVersion || await latestModelVersion('dashboard_shop_daily');
  if (!shopId) {
    return query(res, `
      SELECT COUNT(*) AS days, SUM(estimated_sales_yen) AS estimated_sales_yen,
             SUM(sales_low_95) AS sales_low_95, SUM(sales_high_95) AS sales_high_95,
             SUM(estimated_units) AS estimated_units, SUM(units_low_95) AS units_low_95,
             SUM(units_high_95) AS units_high_95
      FROM mv_dashboard_all_shops_daily
      WHERE date BETWEEN $1 AND $2 AND model_version = $3
    `, [start, end, modelVersion]);
  }
  return query(res, `
    SELECT COUNT(*) AS days, SUM(estimated_sales_yen) AS estimated_sales_yen,
           SUM(sales_low_95) AS sales_low_95, SUM(sales_high_95) AS sales_high_95,
           SUM(estimated_units) AS estimated_units, SUM(units_low_95) AS units_low_95,
           SUM(units_high_95) AS units_high_95
    FROM dashboard_shop_daily
    WHERE shop_id = $1 AND date BETWEEN $2 AND $3 AND model_version = $4
  `, [shopId, start, end, modelVersion]);
});

app.get('/api/shop/genres', async (req, res) => {
  const shopId = intParam(req.query.shopId);
  const start = isoDate(req.query.start, '2017-01-01');
  const end = isoDate(req.query.end, '2026-12-31');
  const modelVersion = req.query.modelVersion || await latestModelVersion('dashboard_shop_genre_daily');
  if (!shopId) return res.status(400).json({ error: 'shopId_required' });
  return query(res, `
    SELECT sg.genre_id, g.genre_name_ja, g.genre_name_en,
           SUM(sg.estimated_sales_yen) AS estimated_sales_yen,
           SUM(sg.sales_low_95) AS sales_low_95,
           SUM(sg.sales_high_95) AS sales_high_95,
           SUM(sg.estimated_units) AS estimated_units
    FROM dashboard_shop_genre_daily sg
    LEFT JOIN genres g ON g.genre_id = sg.genre_id
    WHERE sg.shop_id = $1 AND sg.date BETWEEN $2 AND $3 AND sg.model_version = $4
    GROUP BY sg.genre_id, g.genre_name_ja, g.genre_name_en
    ORDER BY estimated_sales_yen DESC
    LIMIT 20
  `, [shopId, start, end, modelVersion]);
});




app.get('/api/top-items', async (req, res) => {
  const start = isoDate(req.query.start, '2017-01-01');
  const end = isoDate(req.query.end, '2026-12-31');
  const genreId = req.query.genreId === 'all' ? null : intParam(req.query.genreId);
  const shopId = req.query.shopId === 'all' ? null : intParam(req.query.shopId);
  const limit = Math.min(Math.max(intParam(req.query.limit, 25) || 25, 1), 5000);
  const where = ['date BETWEEN $1::date AND $2::date', 'rank BETWEEN 1 AND 80', 'sales > 0', 'shop_id IS NOT NULL', 'item_id IS NOT NULL'];
  const params = [start, end];
  if (genreId) {
    params.push(genreId);
    where.push(`genre_id = $${params.length}`);
  }
  if (shopId) {
    params.push(shopId);
    where.push(`shop_id = $${params.length}`);
  }
  params.push(limit);
  return query(res, `
    WITH item_totals AS (
      SELECT
        shop_id,
        item_id,
        genre_id,
        SUM(sales) AS total_item_sales,
        SUM(COALESCE(sales_low, sales)) AS total_item_sales_low,
        SUM(COALESCE(sales_high, sales)) AS total_item_sales_high,
        COUNT(*) AS rank_rows,
        MIN(rank) AS best_rank
      FROM dashboard_rank_rows
      WHERE ${where.join(' AND ')}
      GROUP BY shop_id, item_id, genre_id
    ), grand_total AS (
      SELECT SUM(total_item_sales) AS total_sales FROM item_totals
    )
    SELECT
      shop_id::text AS shop,
      genre_id::text AS genre,
      item_id::text AS item,
      total_item_sales::text AS sales,
      total_item_sales_low::text AS sales_low,
      total_item_sales_high::text AS sales_high,
      '0'::text AS units,
      rank_rows::text AS rank_rows,
      best_rank::text AS best_rank,
      CASE WHEN gt.total_sales > 0 THEN (total_item_sales / gt.total_sales)::text ELSE '0' END AS sales_share
    FROM item_totals
    CROSS JOIN grand_total gt
    ORDER BY total_item_sales DESC, best_rank ASC, shop_id ASC, item_id ASC
    LIMIT $${params.length}
  `, params);
});

app.get('/api/top-shops', async (req, res) => {
  const start = isoDate(req.query.start, '2017-01-01');
  const end = isoDate(req.query.end, '2026-12-31');
  const genreId = req.query.genreId === 'all' ? null : intParam(req.query.genreId);
  const shopId = req.query.shopId === 'all' ? null : intParam(req.query.shopId);
  const limit = Math.min(Math.max(intParam(req.query.limit, 25) || 25, 1), 100);
  const where = ['date BETWEEN $1::date AND $2::date', 'rank BETWEEN 1 AND 80', 'sales > 0', 'shop_id IS NOT NULL'];
  const params = [start, end];
  if (genreId) {
    params.push(genreId);
    where.push(`genre_id = $${params.length}`);
  }
  if (shopId) {
    params.push(shopId);
    where.push(`shop_id = $${params.length}`);
  }
  params.push(limit);
  return query(res, `
    WITH base AS (
      SELECT shop_id, item_id, sales, rank, date
      FROM dashboard_rank_rows
      WHERE ${where.join(' AND ')}
    ), shop_totals AS (
      SELECT
        shop_id,
        SUM(sales) AS total_shop_sales,
        COUNT(*) AS known_rows
      FROM base
      GROUP BY shop_id
    ), top_items AS (
      SELECT
        shop_id,
        item_id,
        sales,
        rank,
        ROW_NUMBER() OVER (
          PARTITION BY shop_id
          ORDER BY sales DESC NULLS LAST, rank ASC, date DESC, item_id ASC
        ) AS item_rank
      FROM base
      WHERE item_id IS NOT NULL
    ), grand_total AS (
      SELECT SUM(total_shop_sales) AS total_sales FROM shop_totals
    )
    SELECT st.shop_id::text AS shop,
           st.total_shop_sales::text AS total_shop_sales,
           CASE WHEN gt.total_sales > 0 THEN (st.total_shop_sales / gt.total_sales)::text ELSE '0' END AS sales_share,
           st.known_rows::text AS known_rows,
           COALESCE(ti.item_id::text, '') AS top_item
    FROM shop_totals st
    CROSS JOIN grand_total gt
    LEFT JOIN top_items ti ON ti.shop_id = st.shop_id AND ti.item_rank = 1
    ORDER BY st.total_shop_sales DESC, st.shop_id
    LIMIT $${params.length}
  `, params);
});

app.get('/api/events', (req, res) => {
  const start = isoDate(req.query.start, '2017-01-01');
  const end = isoDate(req.query.end, '2026-12-31');
  return query(res, `
    SELECT event_name, MIN(start_at)::date AS first_start_date, MAX(end_at)::date AS last_end_date,
           COUNT(*) AS event_occurrences, AVG(intensity) AS avg_intensity
    FROM promotion_events
    WHERE event_name NOT IN ('fashionthesale', 'fathers-day')
      AND start_at::date <= $2 AND end_at::date >= $1
    GROUP BY event_name
    ORDER BY avg_intensity DESC, event_name
  `, [start, end]);
});

app.get('/api/metrics/wmape', (req, res) => {
  const modelAliases = {
    genre_sales: 'Genre sales model',
    genre: 'Genre sales model',
    total_sales: 'Genre sales model',
    sales: 'Genre sales model',
    shop_sales: 'Shop sales model',
    shop: 'Shop sales model',
    units: 'Units sold model',
    units_sold: 'Units sold model'
  };
  const requestedModel = req.query.modelName || 'Genre sales model';
  const modelName = modelAliases[String(requestedModel).toLowerCase()] || requestedModel;
  const entityType = req.query.entityType || 'genre';
  const genreId = intParam(req.query.genreId);
  const shopId = intParam(req.query.shopId);
  return query(res, `
    SELECT metric_value AS wmape, sample_size, evaluated_at
    FROM model_validation_metrics
    WHERE model_name = $1 AND entity_type = $2 AND metric_name = 'WMAPE'
      AND ($3::bigint IS NULL OR genre_id = $3)
      AND ($4::bigint IS NULL OR shop_id = $4)
    ORDER BY evaluated_at DESC
    LIMIT 1
  `, [modelName, entityType, genreId, shopId]);
});



app.get('/api/model-validation', (req, res) => {
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
});

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function sendCsv(res, rows, columns) {
  const header = columns.map((col) => col.name).join(',');
  const body = rows.map((row) => columns.map((col) => csvEscape(row[col.key])).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.send(body ? `${header}\n${body}\n` : `${header}\n`);
}

async function csvQuery(res, sql, params, columns) {
  try {
    const { rows } = await pool.query(sql, params);
    sendCsv(res, rows, columns);
  } catch (error) {
    console.error(error);
    res.status(500).send('database_query_failed\n');
  }
}

function monthBounds(month) {
  const text = String(month || '');
  if (!/^\d{4}-\d{2}$/.test(text)) return null;
  return { start: `${text}-01`, end: `${text}-01` };
}

const estimateColumns = [
  { name: 'date', key: 'date' },
  { name: 'shop', key: 'shop' },
  { name: 'genre', key: 'genre' },
  { name: 'predicted_sales', key: 'predicted_sales' },
  { name: 'predicted_sales_low', key: 'predicted_sales_low' },
  { name: 'predicted_sales_high', key: 'predicted_sales_high' },
  { name: 'predicted_units', key: 'predicted_units' },
  { name: 'predicted_units_low', key: 'predicted_units_low' },
  { name: 'predicted_units_high', key: 'predicted_units_high' },
  { name: 'predicted_page_views', key: 'predicted_page_views' },
  { name: 'predicted_page_views_low', key: 'predicted_page_views_low' },
  { name: 'predicted_page_views_high', key: 'predicted_page_views_high' },
];

const rankSummaryColumns = [
  { name: 'date', key: 'date' },
  { name: 'genre', key: 'genre' },
  { name: 'sales', key: 'sales' },
  { name: 'sales_low', key: 'sales_low' },
  { name: 'sales_high', key: 'sales_high' },
  { name: 'units', key: 'units' },
  { name: 'units_low', key: 'units_low' },
  { name: 'units_high', key: 'units_high' },
  { name: 'avg_price', key: 'avg_price' },
];

const rankColumns = [
  { name: 'date', key: 'date' },
  { name: 'genre', key: 'genre' },
  { name: 'rank', key: 'rank' },
  { name: 'shop', key: 'shop' },
  { name: 'source', key: 'source' },
  { name: 'sales', key: 'sales' },
  { name: 'sales_low', key: 'sales_low' },
  { name: 'sales_high', key: 'sales_high' },
  { name: 'lower_rank', key: 'lower_rank' },
  { name: 'upper_rank', key: 'upper_rank' },
  { name: 'lower_sales', key: 'lower_sales' },
  { name: 'upper_sales', key: 'upper_sales' },
  { name: 'item', key: 'item' },
];

app.get('/api/data/filter_options.csv', async (_req, res) => {
  const modelVersion = await latestModelVersion('dashboard_genre_daily');
  return csvQuery(res, `
    WITH date_rows AS (
      SELECT 'date'::text AS type, date::text AS id, date::text AS label, SUM(estimated_sales_yen) AS sales
      FROM mv_dashboard_all_genres_daily
      WHERE model_version = $1
      GROUP BY date
    ), genre_rows AS (
      SELECT 'genre'::text AS type, genre_id::text AS id,
             COALESCE(genre_name_ja, '') || CASE WHEN genre_name_en IS NULL OR genre_name_en = '' THEN '' ELSE ' / ' || genre_name_en END AS label,
             dropdown_sales_yen AS sales
      FROM genres
      WHERE active = true
    )
    SELECT type, id, label, ROUND(sales)::text AS sales
    FROM (SELECT * FROM date_rows UNION ALL SELECT * FROM genre_rows) rows
    ORDER BY CASE WHEN type = 'date' THEN 0 ELSE 1 END, sales::numeric DESC, label
  `, [modelVersion], [
    { name: 'type', key: 'type' }, { name: 'id', key: 'id' }, { name: 'label', key: 'label' }, { name: 'sales', key: 'sales' }
  ]);
});

app.get('/api/data/shop_options.csv', (_req, res) => csvQuery(res, `
  SELECT shop_id::text AS id, COALESCE(shop_label, 'Shop ' || shop_id::text) AS label,
         ROUND(dropdown_sales_yen)::text AS sales, ''::text AS units, ''::text AS page_views
  FROM shops
  WHERE active = true
  ORDER BY dropdown_sales_yen DESC, shop_id
`, [], [
  { name: 'id', key: 'id' }, { name: 'label', key: 'label' }, { name: 'sales', key: 'sales' },
  { name: 'units', key: 'units' }, { name: 'page_views', key: 'page_views' }
]));

app.get('/api/data/rank-summary-by-month/:month.csv', async (req, res) => {
  const bounds = monthBounds(req.params.month);
  if (!bounds) return res.status(400).send('bad_month\n');
  const modelVersion = await latestModelVersion('dashboard_genre_daily');
  return csvQuery(res, `
    WITH genre_rows AS (
      SELECT date::text AS date, genre_id::text AS genre,
             estimated_sales_yen AS sales, sales_low_95 AS sales_low, sales_high_95 AS sales_high,
             estimated_units AS units, units_low_95 AS units_low, units_high_95 AS units_high,
             CASE WHEN estimated_units > 0 THEN estimated_sales_yen / estimated_units ELSE 0 END AS avg_price
      FROM dashboard_genre_daily
      WHERE date >= $1::date AND date < ($2::date + INTERVAL '1 month') AND model_version = $3
    ), all_rows AS (
      SELECT date::text AS date, 'all'::text AS genre,
             estimated_sales_yen AS sales, sales_low_95 AS sales_low, sales_high_95 AS sales_high,
             estimated_units AS units, units_low_95 AS units_low, units_high_95 AS units_high,
             CASE WHEN estimated_units > 0 THEN estimated_sales_yen / estimated_units ELSE 0 END AS avg_price
      FROM mv_dashboard_all_genres_daily
      WHERE date >= $1::date AND date < ($2::date + INTERVAL '1 month') AND model_version = $3
    )
    SELECT date, genre, sales::text, sales_low::text, sales_high::text, units::text, units_low::text, units_high::text, avg_price::text
    FROM (SELECT * FROM all_rows UNION ALL SELECT * FROM genre_rows) rows
    ORDER BY date, genre
  `, [bounds.start, bounds.end, modelVersion], rankSummaryColumns);
});

app.get('/api/data/trend-estimates-by-month/:month.csv', async (req, res) => {
  const bounds = monthBounds(req.params.month);
  if (!bounds) return res.status(400).send('bad_month\n');
  const modelVersion = await latestModelVersion('dashboard_genre_daily');
  return csvQuery(res, `
    WITH genre_rows AS (
      SELECT date::text AS date, ''::text AS shop, genre_id::text AS genre,
             estimated_sales_yen AS predicted_sales, sales_low_95 AS predicted_sales_low, sales_high_95 AS predicted_sales_high,
             estimated_units AS predicted_units, units_low_95 AS predicted_units_low, units_high_95 AS predicted_units_high,
             0 AS predicted_page_views, 0 AS predicted_page_views_low, 0 AS predicted_page_views_high
      FROM dashboard_genre_daily
      WHERE date >= $1::date AND date < ($2::date + INTERVAL '1 month') AND model_version = $3
    ), all_rows AS (
      SELECT date::text AS date, ''::text AS shop, 'all'::text AS genre,
             estimated_sales_yen AS predicted_sales, sales_low_95 AS predicted_sales_low, sales_high_95 AS predicted_sales_high,
             estimated_units AS predicted_units, units_low_95 AS predicted_units_low, units_high_95 AS predicted_units_high,
             0 AS predicted_page_views, 0 AS predicted_page_views_low, 0 AS predicted_page_views_high
      FROM mv_dashboard_all_genres_daily
      WHERE date >= $1::date AND date < ($2::date + INTERVAL '1 month') AND model_version = $3
    )
    SELECT date, shop, genre, predicted_sales::text, predicted_sales_low::text, predicted_sales_high::text,
           predicted_units::text, predicted_units_low::text, predicted_units_high::text,
           predicted_page_views::text, predicted_page_views_low::text, predicted_page_views_high::text
    FROM (SELECT * FROM all_rows UNION ALL SELECT * FROM genre_rows) rows
    ORDER BY date, genre
  `, [bounds.start, bounds.end, modelVersion], estimateColumns);
});

app.get('/api/data/ranked-shops-by-genre/:genre/:month.csv', async (req, res) => {
  const bounds = monthBounds(req.params.month);
  const genreParam = String(req.params.genre || '');
  if (!bounds || !/^(all|all-items|\d+)$/.test(genreParam)) return res.status(400).send('bad_request\n');

  const csvPath = path.join(CSV_DATA_ROOT, 'ranked-shops-by-genre', genreParam, `${req.params.month}.csv`);
  if (csvPath.startsWith(CSV_DATA_ROOT) && fs.existsSync(csvPath)) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.sendFile(csvPath);
  }

  const genreId = intParam(req.params.genre);
  if (!genreId) return res.status(400).send('bad_request\n');
  const modelVersion = await latestModelVersion('dashboard_genre_rank_daily');
  return csvQuery(res, `
    SELECT d.date::text AS date, d.genre_id::text AS genre, d.rank::text AS rank,
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
  `, [genreId, bounds.start, bounds.end, modelVersion], rankColumns);
});

app.get('/api/data/shop-summary-by-month/:month.csv', async (req, res) => {
  const bounds = monthBounds(req.params.month);
  if (!bounds) return res.status(400).send('bad_month\n');
  const modelVersion = await latestModelVersion('dashboard_shop_daily');
  return csvQuery(res, `
    WITH shop_rows AS (
      SELECT date::text AS date, shop_id::text AS shop, 'all'::text AS genre,
             estimated_sales_yen AS predicted_sales, sales_low_95 AS predicted_sales_low, sales_high_95 AS predicted_sales_high,
             estimated_units AS predicted_units, units_low_95 AS predicted_units_low, units_high_95 AS predicted_units_high,
             0 AS predicted_page_views, 0 AS predicted_page_views_low, 0 AS predicted_page_views_high
      FROM dashboard_shop_daily
      WHERE date >= $1::date AND date < ($2::date + INTERVAL '1 month') AND model_version = $3
    ), all_rows AS (
      SELECT date::text AS date, 'all'::text AS shop, 'all'::text AS genre,
             estimated_sales_yen AS predicted_sales, sales_low_95 AS predicted_sales_low, sales_high_95 AS predicted_sales_high,
             estimated_units AS predicted_units, units_low_95 AS predicted_units_low, units_high_95 AS predicted_units_high,
             0 AS predicted_page_views, 0 AS predicted_page_views_low, 0 AS predicted_page_views_high
      FROM mv_dashboard_all_shops_daily
      WHERE date >= $1::date AND date < ($2::date + INTERVAL '1 month') AND model_version = $3
    )
    SELECT date, shop, genre, predicted_sales::text, predicted_sales_low::text, predicted_sales_high::text,
           predicted_units::text, predicted_units_low::text, predicted_units_high::text,
           predicted_page_views::text, predicted_page_views_low::text, predicted_page_views_high::text
    FROM (SELECT * FROM all_rows UNION ALL SELECT * FROM shop_rows) rows
    ORDER BY date, shop
  `, [bounds.start, bounds.end, modelVersion], estimateColumns);
});

app.get('/api/data/shop-estimates-by-month/:month.csv', async (req, res) => {
  const bounds = monthBounds(req.params.month);
  if (!bounds) return res.status(400).send('bad_month\n');
  const modelVersion = await latestModelVersion('dashboard_shop_genre_daily');
  return csvQuery(res, `
    SELECT date::text AS date, shop_id::text AS shop, genre_id::text AS genre,
           estimated_sales_yen::text AS predicted_sales, sales_low_95::text AS predicted_sales_low, sales_high_95::text AS predicted_sales_high,
           estimated_units::text AS predicted_units, units_low_95::text AS predicted_units_low, units_high_95::text AS predicted_units_high,
           '0'::text AS predicted_page_views, '0'::text AS predicted_page_views_low, '0'::text AS predicted_page_views_high
    FROM dashboard_shop_genre_daily
    WHERE date >= $1::date AND date < ($2::date + INTERVAL '1 month') AND model_version = $3
    ORDER BY date, shop_id, genre_id
  `, [bounds.start, bounds.end, modelVersion], estimateColumns);
});

app.get('/api/data/by-month/:month.csv', async (req, res) => {
  const bounds = monthBounds(req.params.month);
  if (!bounds) return res.status(400).send('bad_month\n');
  return csvQuery(res, `
    SELECT date::text AS date, shop_id::text AS shop, item_genre::text AS genre,
           SUM(COALESCE(sales_yen, 0))::text AS sales,
           SUM(COALESCE(units_sold, 0))::text AS units,
           SUM(COALESCE(page_views, 0))::text AS page_views
    FROM raw_genre_sales
    WHERE date >= $1::date AND date < ($2::date + INTERVAL '1 month')
    GROUP BY date, shop_id, item_genre
    ORDER BY date, shop_id, item_genre
  `, [bounds.start, bounds.end], [
    { name: 'date', key: 'date' }, { name: 'shop', key: 'shop' }, { name: 'genre', key: 'genre' },
    { name: 'sales', key: 'sales' }, { name: 'units', key: 'units' }, { name: 'page_views', key: 'page_views' }
  ]);
});

app.get('/api/data/items-by-month/:month.csv', async (req, res) => {
  const bounds = monthBounds(req.params.month);
  if (!bounds) return res.status(400).send('bad_month\n');
  return csvQuery(res, `
    SELECT date::text AS date, shop_id::text AS shop, item_genre::text AS genre, item_id::text AS item,
           SUM(COALESCE(sales_yen, 0))::text AS sales,
           SUM(COALESCE(units_sold, 0))::text AS units
    FROM raw_genre_sales
    WHERE date >= $1::date AND date < ($2::date + INTERVAL '1 month')
    GROUP BY date, shop_id, item_genre, item_id
    ORDER BY SUM(COALESCE(units_sold, 0)) DESC, SUM(COALESCE(sales_yen, 0)) DESC
    LIMIT 50000
  `, [bounds.start, bounds.end], [
    { name: 'date', key: 'date' }, { name: 'shop', key: 'shop' }, { name: 'genre', key: 'genre' },
    { name: 'item', key: 'item' }, { name: 'sales', key: 'sales' }, { name: 'units', key: 'units' }
  ]);
});


app.get('/api/data/top-items.csv', async (req, res) => {
  const start = isoDate(req.query.start, '2017-01-01');
  const end = isoDate(req.query.end, '2026-12-31');
  const genreId = req.query.genre === 'all' ? null : intParam(req.query.genre);
  const shopId = req.query.shop === 'all' ? null : intParam(req.query.shop);
  const limit = Math.min(Math.max(intParam(req.query.limit, 50) || 50, 1), 200);
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
  return csvQuery(res, `
    SELECT item_id::text AS item, shop_id::text AS shop, item_genre::text AS genre,
           SUM(sales_yen)::text AS sales,
           SUM(units_sold)::text AS units,
           SUM(page_views)::text AS page_views,
           COUNT(DISTINCT date)::text AS days
    FROM raw_genre_sales
    WHERE ${where.join(' AND ')}
    GROUP BY item_id, shop_id, item_genre
    HAVING SUM(units_sold) > 0 OR SUM(sales_yen) > 0
    ORDER BY SUM(units_sold) DESC, SUM(sales_yen) DESC
    LIMIT $${params.length}
  `, params, [
    { name: 'item', key: 'item' }, { name: 'shop', key: 'shop' }, { name: 'genre', key: 'genre' },
    { name: 'sales', key: 'sales' }, { name: 'units', key: 'units' }, { name: 'page_views', key: 'page_views' },
    { name: 'days', key: 'days' }
  ]);
});

app.get('/api/data/all-time/rank_summary_monthly.csv', async (_req, res) => {
  const modelVersion = await latestModelVersion('dashboard_genre_daily');
  return csvQuery(res, `
    WITH genre_rows AS (
      SELECT date_trunc('month', date)::date::text AS date, genre_id::text AS genre,
             SUM(estimated_sales_yen) AS sales, SUM(sales_low_95) AS sales_low, SUM(sales_high_95) AS sales_high,
             SUM(estimated_units) AS units, SUM(units_low_95) AS units_low, SUM(units_high_95) AS units_high,
             CASE WHEN SUM(estimated_units) > 0 THEN SUM(estimated_sales_yen) / SUM(estimated_units) ELSE 0 END AS avg_price
      FROM dashboard_genre_daily
      WHERE model_version = $1
      GROUP BY 1, 2
    ), all_rows AS (
      SELECT date_trunc('month', date)::date::text AS date, 'all'::text AS genre,
             SUM(estimated_sales_yen) AS sales, SUM(sales_low_95) AS sales_low, SUM(sales_high_95) AS sales_high,
             SUM(estimated_units) AS units, SUM(units_low_95) AS units_low, SUM(units_high_95) AS units_high,
             CASE WHEN SUM(estimated_units) > 0 THEN SUM(estimated_sales_yen) / SUM(estimated_units) ELSE 0 END AS avg_price
      FROM mv_dashboard_all_genres_daily
      WHERE model_version = $1
      GROUP BY 1
    )
    SELECT date, genre, sales::text, sales_low::text, sales_high::text, units::text, units_low::text, units_high::text, avg_price::text
    FROM (SELECT * FROM all_rows UNION ALL SELECT * FROM genre_rows) rows
    ORDER BY date, genre
  `, [modelVersion], rankSummaryColumns);
});

app.get('/api/data/all-time/trend_estimates_monthly.csv', async (_req, res) => {
  const modelVersion = await latestModelVersion('dashboard_genre_daily');
  return csvQuery(res, `
    SELECT date_trunc('month', date)::date::text AS date, ''::text AS shop, genre_id::text AS genre,
           SUM(estimated_sales_yen)::text AS predicted_sales, SUM(sales_low_95)::text AS predicted_sales_low, SUM(sales_high_95)::text AS predicted_sales_high,
           SUM(estimated_units)::text AS predicted_units, SUM(units_low_95)::text AS predicted_units_low, SUM(units_high_95)::text AS predicted_units_high,
           '0'::text AS predicted_page_views, '0'::text AS predicted_page_views_low, '0'::text AS predicted_page_views_high
    FROM dashboard_genre_daily
    WHERE model_version = $1
    GROUP BY 1, 3
    ORDER BY date, genre
  `, [modelVersion], estimateColumns);
});

app.get('/api/data/all-time/shop_summary_monthly.csv', async (_req, res) => {
  const modelVersion = await latestModelVersion('dashboard_shop_daily');
  return csvQuery(res, `
    SELECT date_trunc('month', date)::date::text AS date, shop_id::text AS shop, 'all'::text AS genre,
           SUM(estimated_sales_yen)::text AS predicted_sales, SUM(sales_low_95)::text AS predicted_sales_low, SUM(sales_high_95)::text AS predicted_sales_high,
           SUM(estimated_units)::text AS predicted_units, SUM(units_low_95)::text AS predicted_units_low, SUM(units_high_95)::text AS predicted_units_high,
           '0'::text AS predicted_page_views, '0'::text AS predicted_page_views_low, '0'::text AS predicted_page_views_high
    FROM dashboard_shop_daily
    WHERE model_version = $1
    GROUP BY 1, 2
    ORDER BY date, shop
  `, [modelVersion], estimateColumns);
});

app.get('/api/data/all-time/shop_estimates_monthly.csv', async (_req, res) => {
  const modelVersion = await latestModelVersion('dashboard_shop_genre_daily');
  return csvQuery(res, `
    SELECT date_trunc('month', date)::date::text AS date, shop_id::text AS shop, genre_id::text AS genre,
           SUM(estimated_sales_yen)::text AS predicted_sales, SUM(sales_low_95)::text AS predicted_sales_low, SUM(sales_high_95)::text AS predicted_sales_high,
           SUM(estimated_units)::text AS predicted_units, SUM(units_low_95)::text AS predicted_units_low, SUM(units_high_95)::text AS predicted_units_high,
           '0'::text AS predicted_page_views, '0'::text AS predicted_page_views_low, '0'::text AS predicted_page_views_high
    FROM dashboard_shop_genre_daily
    WHERE model_version = $1
    GROUP BY 1, 2, 3
    ORDER BY date, shop, genre
  `, [modelVersion], estimateColumns);
});

app.get('/api/data/all-time/ranked_shops_latest.csv', async (_req, res) => {
  const csvPath = path.join(CSV_DATA_ROOT, 'all-time', 'ranked_shops_latest.csv');
  if (csvPath.startsWith(CSV_DATA_ROOT) && fs.existsSync(csvPath)) {
    res.type('text/csv');
    return res.sendFile(csvPath);
  }

  const modelVersion = await latestModelVersion('dashboard_genre_rank_daily');
  return csvQuery(res, `
    WITH latest AS (SELECT MAX(date) AS date FROM dashboard_genre_rank_daily WHERE model_version = $1)
    SELECT r.date::text AS date, r.genre_id::text AS genre, r.rank::text AS rank,
           COALESCE(r.shop_id::text, '') AS shop,
           CASE WHEN r.source_kind IN ('known_tenki', 'hybrid') THEN 'known_tenki' ELSE 'estimated' END AS source,
           r.estimated_sales_yen::text AS sales, r.sales_low_95::text AS sales_low, r.sales_high_95::text AS sales_high,
           ''::text AS lower_rank, ''::text AS upper_rank, ''::text AS lower_sales, ''::text AS upper_sales
    FROM dashboard_genre_rank_daily r, latest
    WHERE r.model_version = $1 AND r.date = latest.date AND r.rank BETWEEN 1 AND 80
    ORDER BY r.genre_id, r.rank
  `, [modelVersion], rankColumns);
});

app.use('/api/data', express.static('/opt/tenki-dashboard/site-data/data', {
  setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=300')
}));

app.use(express.static(SITE_ROOT, {
  setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=300')
}));

app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  return res.sendFile(path.join(SITE_ROOT, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`TENKI dashboard server listening on 0.0.0.0:${port}`);
});
