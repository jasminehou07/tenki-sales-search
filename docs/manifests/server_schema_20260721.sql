--
-- PostgreSQL database dump
--

\restrict cXVJM239zFyzeMq8bVlP3ncZJv5xdOjd8LfXoD1bSA261TlvU4NszdTY9t7f70V

-- Dumped from database version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: dashboard_genre_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboard_genre_daily (
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
    source_kind text DEFAULT 'model'::text NOT NULL,
    model_version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dashboard_genre_daily_source_kind CHECK ((source_kind = ANY (ARRAY['known_tenki'::text, 'model'::text, 'hybrid'::text])))
);


--
-- Name: dashboard_genre_rank_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboard_genre_rank_daily (
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
    source_kind text DEFAULT 'model'::text NOT NULL,
    model_version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dashboard_genre_rank_daily_rank CHECK (((rank >= 1) AND (rank <= 80))),
    CONSTRAINT dashboard_genre_rank_daily_source_kind CHECK ((source_kind = ANY (ARRAY['known_tenki'::text, 'model'::text, 'hybrid'::text])))
);


--
-- Name: dashboard_rank_rows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboard_rank_rows (
    date date,
    genre_id bigint,
    rank integer,
    shop_id bigint,
    source text,
    sales numeric,
    sales_low numeric,
    sales_high numeric,
    lower_rank integer,
    upper_rank integer,
    lower_sales numeric,
    upper_sales numeric,
    item_id bigint
);


--
-- Name: dashboard_shop_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboard_shop_daily (
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
    source_kind text DEFAULT 'model'::text NOT NULL,
    model_version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dashboard_shop_daily_source_kind CHECK ((source_kind = ANY (ARRAY['known_tenki'::text, 'model'::text, 'hybrid'::text])))
);


--
-- Name: dashboard_shop_genre_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboard_shop_genre_daily (
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
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: event_daily_features; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_daily_features (
    date date NOT NULL,
    genre_id bigint NOT NULL,
    event_name text NOT NULL,
    event_count integer DEFAULT 1 NOT NULL,
    intensity numeric DEFAULT 1.0 NOT NULL,
    days_from_start integer,
    days_to_end integer,
    sales_lift_factor numeric,
    units_lift_factor numeric
);


--
-- Name: genres; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.genres (
    genre_id bigint NOT NULL,
    genre_name_ja text,
    genre_name_en text,
    genre_group text,
    dropdown_sales_yen numeric DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: model_validation_holdout_predictions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_validation_holdout_predictions (
    model_version text,
    model_name text,
    entity_type text,
    entity_group text,
    created_at timestamp with time zone,
    validation_date date,
    genre_id bigint,
    shop_id bigint,
    item_id bigint,
    rank integer,
    actual_sales numeric,
    predicted_sales numeric
);


--
-- Name: model_validation_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_validation_metrics (
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
    evaluated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mv_dashboard_all_genres_daily; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.mv_dashboard_all_genres_daily AS
 SELECT date,
    model_version,
    sum(estimated_sales_yen) AS estimated_sales_yen,
    sum(sales_low_95) AS sales_low_95,
    sum(sales_high_95) AS sales_high_95,
    sum(estimated_units) AS estimated_units,
    sum(units_low_95) AS units_low_95,
    sum(units_high_95) AS units_high_95
   FROM public.dashboard_genre_daily
  GROUP BY date, model_version
  WITH NO DATA;


--
-- Name: mv_dashboard_all_shops_daily; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.mv_dashboard_all_shops_daily AS
 SELECT date,
    model_version,
    sum(estimated_sales_yen) AS estimated_sales_yen,
    sum(sales_low_95) AS sales_low_95,
    sum(sales_high_95) AS sales_high_95,
    sum(estimated_units) AS estimated_units,
    sum(units_low_95) AS units_low_95,
    sum(units_high_95) AS units_high_95
   FROM public.dashboard_shop_daily
  GROUP BY date, model_version
  WITH NO DATA;


--
-- Name: promotion_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotion_events (
    event_id bigint NOT NULL,
    event_name text NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    intensity numeric DEFAULT 1.0 NOT NULL,
    CONSTRAINT promotion_events_valid_range CHECK ((end_at >= start_at))
);


--
-- Name: promotion_events_event_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promotion_events_event_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promotion_events_event_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promotion_events_event_id_seq OWNED BY public.promotion_events.event_id;


--
-- Name: raw_genre_rankings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raw_genre_rankings (
    date date NOT NULL,
    shop_id bigint NOT NULL,
    item_id bigint NOT NULL,
    rank integer NOT NULL,
    price_yen bigint,
    genre_id bigint NOT NULL,
    source_file text,
    loaded_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: raw_genre_sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raw_genre_sales (
    shop_id bigint NOT NULL,
    item_id bigint NOT NULL,
    date date NOT NULL,
    shop_genre bigint,
    item_genre bigint NOT NULL,
    sales_yen bigint DEFAULT 0 NOT NULL,
    units_sold bigint DEFAULT 0 NOT NULL,
    page_views bigint DEFAULT 0 NOT NULL,
    unique_visitors bigint DEFAULT 0 NOT NULL,
    conversion_rate numeric,
    access_count bigint,
    order_count bigint,
    source_file text,
    loaded_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: shops; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shops (
    shop_id bigint NOT NULL,
    shop_label text,
    shop_group text,
    dropdown_sales_yen numeric DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: tmp_validation_predictions; Type: TABLE; Schema: public; Owner: -
--

CREATE UNLOGGED TABLE public.tmp_validation_predictions (
    date date,
    genre_id bigint,
    rank integer,
    actual_sales numeric,
    train_rows bigint,
    validation_group text,
    predicted_sales numeric
);


--
-- Name: tmp_validation_rank_actuals; Type: TABLE; Schema: public; Owner: -
--

CREATE UNLOGGED TABLE public.tmp_validation_rank_actuals (
    date date,
    genre_id bigint,
    rank integer,
    shop_id bigint,
    item_id bigint,
    actual_sales numeric,
    genre_group text,
    is_holdout boolean
);


--
-- Name: promotion_events event_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_events ALTER COLUMN event_id SET DEFAULT nextval('public.promotion_events_event_id_seq'::regclass);


--
-- Name: dashboard_genre_daily dashboard_genre_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_genre_daily
    ADD CONSTRAINT dashboard_genre_daily_pkey PRIMARY KEY (genre_id, date, model_version);


--
-- Name: dashboard_genre_rank_daily dashboard_genre_rank_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_genre_rank_daily
    ADD CONSTRAINT dashboard_genre_rank_daily_pkey PRIMARY KEY (genre_id, date, rank, model_version);


--
-- Name: dashboard_shop_daily dashboard_shop_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_shop_daily
    ADD CONSTRAINT dashboard_shop_daily_pkey PRIMARY KEY (shop_id, date, model_version);


--
-- Name: dashboard_shop_genre_daily dashboard_shop_genre_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_shop_genre_daily
    ADD CONSTRAINT dashboard_shop_genre_daily_pkey PRIMARY KEY (shop_id, genre_id, date, model_version);


--
-- Name: event_daily_features event_daily_features_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_daily_features
    ADD CONSTRAINT event_daily_features_pkey PRIMARY KEY (date, genre_id, event_name);


--
-- Name: genres genres_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.genres
    ADD CONSTRAINT genres_pkey PRIMARY KEY (genre_id);


--
-- Name: promotion_events promotion_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_events
    ADD CONSTRAINT promotion_events_pkey PRIMARY KEY (event_id);


--
-- Name: raw_genre_rankings raw_genre_rankings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_genre_rankings
    ADD CONSTRAINT raw_genre_rankings_pkey PRIMARY KEY (genre_id, date, rank, shop_id, item_id);


--
-- Name: raw_genre_sales raw_genre_sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_genre_sales
    ADD CONSTRAINT raw_genre_sales_pkey PRIMARY KEY (item_genre, date, shop_id, item_id);


--
-- Name: shops shops_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_pkey PRIMARY KEY (shop_id);


--
-- Name: idx_api_genre_daily_model_genre_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_genre_daily_model_genre_date ON public.dashboard_genre_daily USING btree (model_version, genre_id, date);


--
-- Name: idx_api_genre_rank_model_genre_date_rank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_genre_rank_model_genre_date_rank ON public.dashboard_genre_rank_daily USING btree (model_version, genre_id, date, rank);


--
-- Name: idx_api_shop_daily_model_shop_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_shop_daily_model_shop_date ON public.dashboard_shop_daily USING btree (model_version, shop_id, date);


--
-- Name: idx_api_shop_genre_model_shop_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_shop_genre_model_shop_date ON public.dashboard_shop_genre_daily USING btree (model_version, shop_id, date);


--
-- Name: idx_dashboard_genre_daily_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboard_genre_daily_date ON public.dashboard_genre_daily USING btree (date);


--
-- Name: idx_dashboard_genre_daily_genre_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboard_genre_daily_genre_date ON public.dashboard_genre_daily USING btree (genre_id, date);


--
-- Name: idx_dashboard_genre_rank_date_rank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboard_genre_rank_date_rank ON public.dashboard_genre_rank_daily USING btree (date, rank);


--
-- Name: idx_dashboard_genre_rank_genre_date_rank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboard_genre_rank_genre_date_rank ON public.dashboard_genre_rank_daily USING btree (genre_id, date, rank);


--
-- Name: idx_dashboard_rank_rows_new_date_rank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboard_rank_rows_new_date_rank ON public.dashboard_rank_rows USING btree (date, rank);


--
-- Name: idx_dashboard_rank_rows_new_date_sales; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboard_rank_rows_new_date_sales ON public.dashboard_rank_rows USING btree (date, sales DESC);


--
-- Name: idx_dashboard_rank_rows_new_genre_date_rank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboard_rank_rows_new_genre_date_rank ON public.dashboard_rank_rows USING btree (genre_id, date, rank);


--
-- Name: idx_dashboard_rank_rows_new_shop_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboard_rank_rows_new_shop_date ON public.dashboard_rank_rows USING btree (shop_id, date);


--
-- Name: idx_dashboard_shop_daily_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboard_shop_daily_date ON public.dashboard_shop_daily USING btree (date);


--
-- Name: idx_dashboard_shop_daily_shop_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboard_shop_daily_shop_date ON public.dashboard_shop_daily USING btree (shop_id, date);


--
-- Name: idx_dashboard_shop_genre_genre_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboard_shop_genre_genre_date ON public.dashboard_shop_genre_daily USING btree (genre_id, date);


--
-- Name: idx_dashboard_shop_genre_shop_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboard_shop_genre_shop_date ON public.dashboard_shop_genre_daily USING btree (shop_id, date);


--
-- Name: idx_event_daily_features_date_genre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_daily_features_date_genre ON public.event_daily_features USING btree (date, genre_id);


--
-- Name: idx_events_range; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_range ON public.promotion_events USING btree (start_at, end_at);


--
-- Name: idx_genres_dropdown_sales; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_genres_dropdown_sales ON public.genres USING btree (dropdown_sales_yen DESC);


--
-- Name: idx_model_validation_metrics_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_model_validation_metrics_unique ON public.model_validation_metrics USING btree (model_version, model_name, entity_type, COALESCE(entity_group, ''::text), COALESCE(genre_id, (0)::bigint), COALESCE(shop_id, (0)::bigint), COALESCE(event_name, ''::text), metric_name);


--
-- Name: idx_mv_dashboard_all_genres_daily_pk; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_mv_dashboard_all_genres_daily_pk ON public.mv_dashboard_all_genres_daily USING btree (date, model_version);


--
-- Name: idx_mv_dashboard_all_shops_daily_pk; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_mv_dashboard_all_shops_daily_pk ON public.mv_dashboard_all_shops_daily USING btree (date, model_version);


--
-- Name: idx_raw_rankings_date_genre_rank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raw_rankings_date_genre_rank ON public.raw_genre_rankings USING btree (date, genre_id, rank);


--
-- Name: idx_raw_rankings_genre_shop_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raw_rankings_genre_shop_date ON public.raw_genre_rankings USING btree (genre_id, shop_id, date);


--
-- Name: idx_raw_rankings_shop_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raw_rankings_shop_date ON public.raw_genre_rankings USING btree (shop_id, date);


--
-- Name: idx_raw_sales_date_genre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raw_sales_date_genre ON public.raw_genre_sales USING btree (date, item_genre);


--
-- Name: idx_raw_sales_genre_date_shop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raw_sales_genre_date_shop ON public.raw_genre_sales USING btree (item_genre, date, shop_id);


--
-- Name: idx_raw_sales_shop_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raw_sales_shop_date ON public.raw_genre_sales USING btree (shop_id, date);


--
-- Name: idx_shops_dropdown_sales; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shops_dropdown_sales ON public.shops USING btree (dropdown_sales_yen DESC);


--
-- Name: model_validation_holdout_predictions_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_validation_holdout_predictions_date_idx ON public.model_validation_holdout_predictions USING btree (validation_date);


--
-- Name: model_validation_holdout_predictions_genre_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_validation_holdout_predictions_genre_date_idx ON public.model_validation_holdout_predictions USING btree (genre_id, validation_date);


--
-- Name: model_validation_holdout_predictions_model_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_validation_holdout_predictions_model_idx ON public.model_validation_holdout_predictions USING btree (model_name, entity_type);


--
-- Name: model_validation_holdout_predictions_shop_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_validation_holdout_predictions_shop_date_idx ON public.model_validation_holdout_predictions USING btree (shop_id, validation_date);


--
-- Name: tmp_validation_rank_actuals_genre_rank_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tmp_validation_rank_actuals_genre_rank_idx ON public.tmp_validation_rank_actuals USING btree (genre_id, rank);


--
-- Name: tmp_validation_rank_actuals_group_rank_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tmp_validation_rank_actuals_group_rank_idx ON public.tmp_validation_rank_actuals USING btree (genre_group, rank);


--
-- PostgreSQL database dump complete
--

\unrestrict cXVJM239zFyzeMq8bVlP3ncZJv5xdOjd8LfXoD1bSA261TlvU4NszdTY9t7f70V
