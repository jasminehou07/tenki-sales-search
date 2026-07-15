-- TENKI dashboard PostgreSQL schema
-- Run as the postgres superuser first, then connect to tenki_dashboard.

CREATE DATABASE tenki_dashboard;

\connect tenki_dashboard

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Raw TENKI inputs copied from /root/genre-ranking/*.parquet.
CREATE TABLE IF NOT EXISTS raw_genre_rankings (
  date date NOT NULL,
  shop_id bigint NOT NULL,
  item_id bigint NOT NULL,
  rank integer NOT NULL,
  price_yen bigint,
  genre_id bigint NOT NULL,
  source_file text,
  loaded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (genre_id, date, rank, shop_id, item_id)
);

-- Raw TENKI inputs copied from /root/genre-sales/*.parquet.
CREATE TABLE IF NOT EXISTS raw_genre_sales (
  shop_id bigint NOT NULL,
  item_id bigint NOT NULL,
  date date NOT NULL,
  shop_genre bigint,
  item_genre bigint NOT NULL,
  sales_yen bigint NOT NULL DEFAULT 0,
  units_sold bigint NOT NULL DEFAULT 0,
  page_views bigint NOT NULL DEFAULT 0,
  unique_visitors bigint NOT NULL DEFAULT 0,
  conversion_rate numeric,
  access_count bigint,
  order_count bigint,
  source_file text,
  loaded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_genre, date, shop_id, item_id)
);

CREATE TABLE IF NOT EXISTS promotion_events (
  event_id bigserial PRIMARY KEY,
  event_name text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  intensity numeric NOT NULL DEFAULT 1.0,
  CONSTRAINT promotion_events_valid_range CHECK (end_at >= start_at)
);

-- One row per genre/day/promotion after event feature generation.
CREATE TABLE IF NOT EXISTS event_daily_features (
  date date NOT NULL,
  genre_id bigint,
  event_name text NOT NULL,
  event_count integer NOT NULL DEFAULT 1,
  intensity numeric NOT NULL DEFAULT 1.0,
  days_from_start integer,
  days_to_end integer,
  sales_lift_factor numeric,
  units_lift_factor numeric,
  PRIMARY KEY (date, genre_id, event_name)
);

-- Dashboard-ready model output for the top metric cards and sales trend chart.
CREATE TABLE IF NOT EXISTS dashboard_genre_daily (
  date date NOT NULL,
  genre_id bigint NOT NULL,
  estimated_sales_yen numeric NOT NULL,
  sales_low_95 numeric NOT NULL,
  sales_high_95 numeric NOT NULL,
  estimated_units numeric NOT NULL,
  units_low_95 numeric NOT NULL,
  units_high_95 numeric NOT NULL,
  known_sales_yen numeric,
  known_units numeric,
  known_page_views bigint,
  source_kind text NOT NULL DEFAULT 'model',
  model_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (genre_id, date, model_version),
  CONSTRAINT dashboard_genre_daily_source_kind
    CHECK (source_kind IN ('known_tenki', 'model', 'hybrid'))
);

-- Dashboard-ready rank 1-80 output.
-- The website can query rank <= 20, but the model should write all 80 ranks here.
CREATE TABLE IF NOT EXISTS dashboard_genre_rank_daily (
  date date NOT NULL,
  genre_id bigint NOT NULL,
  rank integer NOT NULL,
  shop_id bigint,
  estimated_sales_yen numeric NOT NULL,
  sales_low_95 numeric NOT NULL,
  sales_high_95 numeric NOT NULL,
  estimated_units numeric,
  units_low_95 numeric,
  units_high_95 numeric,
  known_sales_yen numeric,
  known_units numeric,
  source_kind text NOT NULL DEFAULT 'model',
  model_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (genre_id, date, rank, model_version),
  CONSTRAINT dashboard_genre_rank_daily_rank CHECK (rank BETWEEN 1 AND 80),
  CONSTRAINT dashboard_genre_rank_daily_source_kind
    CHECK (source_kind IN ('known_tenki', 'model', 'hybrid'))
);

-- Dashboard-ready rank rows used by the JSON Sales by Rank endpoint.
-- This preserves item/shop identity from the generated rank output so the
-- browser does not need to download monthly CSV chunks.
CREATE TABLE IF NOT EXISTS dashboard_rank_rows (
  date date NOT NULL,
  genre_id bigint NOT NULL,
  rank integer NOT NULL,
  shop_id bigint,
  source text NOT NULL,
  sales numeric,
  sales_low numeric,
  sales_high numeric,
  lower_rank integer,
  upper_rank integer,
  lower_sales numeric,
  upper_sales numeric,
  item_id bigint
);

-- Dashboard-ready shop tab output.
CREATE TABLE IF NOT EXISTS dashboard_shop_daily (
  date date NOT NULL,
  shop_id bigint NOT NULL,
  estimated_sales_yen numeric NOT NULL,
  sales_low_95 numeric NOT NULL,
  sales_high_95 numeric NOT NULL,
  estimated_units numeric NOT NULL,
  units_low_95 numeric NOT NULL,
  units_high_95 numeric NOT NULL,
  known_sales_yen numeric,
  known_units numeric,
  source_kind text NOT NULL DEFAULT 'model',
  model_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shop_id, date, model_version),
  CONSTRAINT dashboard_shop_daily_source_kind
    CHECK (source_kind IN ('known_tenki', 'model', 'hybrid'))
);

-- By-shop breakdown. This is "Sales by Genre" inside a selected shop.
CREATE TABLE IF NOT EXISTS dashboard_shop_genre_daily (
  date date NOT NULL,
  shop_id bigint NOT NULL,
  genre_id bigint NOT NULL,
  estimated_sales_yen numeric NOT NULL,
  sales_low_95 numeric NOT NULL,
  sales_high_95 numeric NOT NULL,
  estimated_units numeric NOT NULL,
  units_low_95 numeric NOT NULL,
  units_high_95 numeric NOT NULL,
  model_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shop_id, genre_id, date, model_version)
);

-- Validation metrics shown as WMAPE under chart titles.
CREATE TABLE IF NOT EXISTS model_validation_metrics (
  model_version text NOT NULL,
  model_name text NOT NULL,
  entity_type text NOT NULL,
  entity_group text,
  genre_id bigint,
  shop_id bigint,
  event_name text,
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  sample_size integer NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS genres (
  genre_id bigint PRIMARY KEY,
  genre_name_ja text,
  genre_name_en text,
  genre_group text,
  dropdown_sales_yen numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS shops (
  shop_id bigint PRIMARY KEY,
  shop_label text,
  shop_group text,
  dropdown_sales_yen numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);

-- Indexes for import validation and model training.
CREATE INDEX IF NOT EXISTS idx_raw_rankings_date_genre_rank
  ON raw_genre_rankings (date, genre_id, rank);

CREATE INDEX IF NOT EXISTS idx_raw_rankings_genre_shop_date
  ON raw_genre_rankings (genre_id, shop_id, date);

CREATE INDEX IF NOT EXISTS idx_raw_rankings_shop_date
  ON raw_genre_rankings (shop_id, date);

CREATE INDEX IF NOT EXISTS idx_raw_sales_date_genre
  ON raw_genre_sales (date, item_genre);

CREATE INDEX IF NOT EXISTS idx_raw_sales_genre_date_shop
  ON raw_genre_sales (item_genre, date, shop_id);

CREATE INDEX IF NOT EXISTS idx_raw_sales_shop_date
  ON raw_genre_sales (shop_id, date);

CREATE INDEX IF NOT EXISTS idx_events_range
  ON promotion_events (start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_event_daily_features_date_genre
  ON event_daily_features (date, genre_id);

-- Indexes specific to dashboard filters.
CREATE INDEX IF NOT EXISTS idx_dashboard_genre_daily_date
  ON dashboard_genre_daily (date);

CREATE INDEX IF NOT EXISTS idx_dashboard_genre_daily_genre_date
  ON dashboard_genre_daily (genre_id, date);

CREATE INDEX IF NOT EXISTS idx_dashboard_genre_rank_genre_date_rank
  ON dashboard_genre_rank_daily (genre_id, date, rank);

CREATE INDEX IF NOT EXISTS idx_dashboard_genre_rank_date_rank
  ON dashboard_genre_rank_daily (date, rank);

CREATE INDEX IF NOT EXISTS idx_dashboard_rank_rows_genre_date_rank
  ON dashboard_rank_rows (genre_id, date, rank);

CREATE INDEX IF NOT EXISTS idx_dashboard_rank_rows_date_sales
  ON dashboard_rank_rows (date, sales DESC);

CREATE INDEX IF NOT EXISTS idx_dashboard_rank_rows_date_rank
  ON dashboard_rank_rows (date, rank);

CREATE INDEX IF NOT EXISTS idx_dashboard_shop_daily_shop_date
  ON dashboard_shop_daily (shop_id, date);

CREATE INDEX IF NOT EXISTS idx_dashboard_shop_daily_date
  ON dashboard_shop_daily (date);

CREATE INDEX IF NOT EXISTS idx_dashboard_shop_genre_shop_date
  ON dashboard_shop_genre_daily (shop_id, date);

CREATE INDEX IF NOT EXISTS idx_dashboard_shop_genre_genre_date
  ON dashboard_shop_genre_daily (genre_id, date);

CREATE INDEX IF NOT EXISTS idx_genres_dropdown_sales
  ON genres (dropdown_sales_yen DESC);

CREATE INDEX IF NOT EXISTS idx_shops_dropdown_sales
  ON shops (dropdown_sales_yen DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_model_validation_metrics_unique
  ON model_validation_metrics (
    model_version,
    model_name,
    entity_type,
    COALESCE(entity_group, ''),
    COALESCE(genre_id, 0),
    COALESCE(shop_id, 0),
    COALESCE(event_name, ''),
    metric_name
  );

-- Fast all-genres/all-shops rollups. Refresh after model output loads.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_all_genres_daily AS
SELECT
  date,
  model_version,
  SUM(estimated_sales_yen) AS estimated_sales_yen,
  SUM(sales_low_95) AS sales_low_95,
  SUM(sales_high_95) AS sales_high_95,
  SUM(estimated_units) AS estimated_units,
  SUM(units_low_95) AS units_low_95,
  SUM(units_high_95) AS units_high_95
FROM dashboard_genre_daily
GROUP BY date, model_version;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dashboard_all_genres_daily_pk
  ON mv_dashboard_all_genres_daily (date, model_version);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_all_shops_daily AS
SELECT
  date,
  model_version,
  SUM(estimated_sales_yen) AS estimated_sales_yen,
  SUM(sales_low_95) AS sales_low_95,
  SUM(sales_high_95) AS sales_high_95,
  SUM(estimated_units) AS estimated_units,
  SUM(units_low_95) AS units_low_95,
  SUM(units_high_95) AS units_high_95
FROM dashboard_shop_daily
GROUP BY date, model_version;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dashboard_all_shops_daily_pk
  ON mv_dashboard_all_shops_daily (date, model_version);

-- Grants for the Node API user. Create the user with a generated password first:
-- CREATE USER tenki_api WITH PASSWORD 'replace-with-server-generated-password';
GRANT CONNECT ON DATABASE tenki_dashboard TO tenki_api;
GRANT USAGE ON SCHEMA public TO tenki_api;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO tenki_api;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO tenki_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO tenki_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO tenki_api;
