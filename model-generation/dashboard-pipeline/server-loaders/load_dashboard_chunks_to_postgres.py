from __future__ import annotations

import io
import os
from pathlib import Path

import pandas as pd
import psycopg

DATABASE_URL = os.environ.get("DATABASE_URL")
DATA = Path('/opt/tenki-dashboard/site-data/data')
PARQUET_OUT = Path('/opt/tenki-dashboard/parquet')
MODEL_VERSION = os.environ.get('MODEL_VERSION', 'github-pages-current')


def copy_dataframe(cur, table: str, columns: list[str], df: pd.DataFrame) -> None:
    if df.empty:
        return
    buf = io.StringIO()
    df.to_csv(buf, index=False, header=False, na_rep='')
    buf.seek(0)
    with cur.copy(f"COPY {table} ({', '.join(columns)}) FROM STDIN WITH (FORMAT CSV, NULL '')") as copy:
        copy.write(buf.getvalue())


def numeric(series, default=0):
    return pd.to_numeric(series, errors='coerce').fillna(default)


def load_options(conn):
    options = pd.read_csv(DATA / 'filter_options.csv')
    genres = options[options['type'].eq('genre')].copy()
    # Labels are already human-readable in the existing dashboard; store them as English labels for now.
    genres_out = pd.DataFrame({
        'genre_id': numeric(genres['id']).astype('int64'),
        'genre_name_ja': '',
        'genre_name_en': genres['label'].astype(str),
        'genre_group': '',
        'dropdown_sales_yen': numeric(genres['sales']),
        'active': True,
    }).drop_duplicates('genre_id')

    shops = pd.read_csv(DATA / 'shop_options.csv')
    shops_out = pd.DataFrame({
        'shop_id': numeric(shops['id']).astype('int64'),
        'shop_label': shops['label'].astype(str),
        'shop_group': '',
        'dropdown_sales_yen': numeric(shops['sales']),
        'active': True,
    }).drop_duplicates('shop_id')

    with conn.cursor() as cur:
        cur.execute('TRUNCATE genres, shops')
        copy_dataframe(cur, 'genres', list(genres_out.columns), genres_out)
        copy_dataframe(cur, 'shops', list(shops_out.columns), shops_out)
    conn.commit()
    print(f'genres loaded: {len(genres_out):,}; shops loaded: {len(shops_out):,}', flush=True)


def load_genre_daily(conn):
    frames = []
    for path in sorted((DATA / 'rank-summary-by-month').glob('*.csv')):
        df = pd.read_csv(path)
        df = df[df['genre'].astype(str).ne('all')].copy()
        if df.empty:
            continue
        frames.append(pd.DataFrame({
            'date': pd.to_datetime(df['date']).dt.date,
            'genre_id': numeric(df['genre']).astype('int64'),
            'estimated_sales_yen': numeric(df['sales']),
            'sales_low_95': numeric(df['sales_low']),
            'sales_high_95': numeric(df['sales_high']),
            'estimated_units': numeric(df['units']),
            'units_low_95': numeric(df['units_low']),
            'units_high_95': numeric(df['units_high']),
            'known_sales_yen': None,
            'known_units': None,
            'known_page_views': None,
            'source_kind': 'model',
            'model_version': MODEL_VERSION,
        }))
    out = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
    PARQUET_OUT.mkdir(parents=True, exist_ok=True)
    if not out.empty:
        out.to_parquet(PARQUET_OUT / 'dashboard_genre_daily.parquet', index=False)
    with conn.cursor() as cur:
        cur.execute('DELETE FROM dashboard_genre_daily WHERE model_version = %s', (MODEL_VERSION,))
        copy_dataframe(cur, 'dashboard_genre_daily', list(out.columns), out)
    conn.commit()
    print(f'dashboard_genre_daily loaded: {len(out):,}', flush=True)


def load_rank_daily(conn):
    frames = []
    for path in sorted((DATA / 'ranked-shops-by-genre').glob('*/*.csv')):
        df = pd.read_csv(path)
        if df.empty:
            continue
        df = df[df['rank'].between(1, 80)].copy()
        if df.empty:
            continue
        source = df['source'].astype(str).str.lower()
        frames.append(pd.DataFrame({
            'date': pd.to_datetime(df['date']).dt.date,
            'genre_id': numeric(df['genre']).astype('int64'),
            'rank': numeric(df['rank']).astype('int64'),
            'shop_id': pd.to_numeric(df.get('shop'), errors='coerce'),
            'estimated_sales_yen': numeric(df['sales']),
            'sales_low_95': numeric(df['sales_low']),
            'sales_high_95': numeric(df['sales_high']),
            'estimated_units': None,
            'units_low_95': None,
            'units_high_95': None,
            'known_sales_yen': None,
            'known_units': None,
            'source_kind': source.map(lambda s: 'known_tenki' if 'actual' in s or 'known' in s else 'model'),
            'model_version': MODEL_VERSION,
        }))
    out = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
    if not out.empty:
        out.to_parquet(PARQUET_OUT / 'dashboard_genre_rank_daily.parquet', index=False)
    with conn.cursor() as cur:
        cur.execute('DELETE FROM dashboard_genre_rank_daily WHERE model_version = %s', (MODEL_VERSION,))
        copy_dataframe(cur, 'dashboard_genre_rank_daily', list(out.columns), out)
    conn.commit()
    print(f'dashboard_genre_rank_daily loaded: {len(out):,}', flush=True)


def load_shop_daily(conn):
    frames = []
    for path in sorted((DATA / 'shop-summary-by-month').glob('*.csv')):
        df = pd.read_csv(path)
        df = df[df['genre'].astype(str).eq('all')].copy()
        if df.empty:
            continue
        frames.append(pd.DataFrame({
            'date': pd.to_datetime(df['date']).dt.date,
            'shop_id': numeric(df['shop']).astype('int64'),
            'estimated_sales_yen': numeric(df['predicted_sales']),
            'sales_low_95': numeric(df['predicted_sales_low']),
            'sales_high_95': numeric(df['predicted_sales_high']),
            'estimated_units': numeric(df['predicted_units']),
            'units_low_95': numeric(df['predicted_units_low']),
            'units_high_95': numeric(df['predicted_units_high']),
            'known_sales_yen': None,
            'known_units': None,
            'source_kind': 'model',
            'model_version': MODEL_VERSION,
        }))
    out = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
    if not out.empty:
        out.to_parquet(PARQUET_OUT / 'dashboard_shop_daily.parquet', index=False)
    with conn.cursor() as cur:
        cur.execute('DELETE FROM dashboard_shop_daily WHERE model_version = %s', (MODEL_VERSION,))
        copy_dataframe(cur, 'dashboard_shop_daily', list(out.columns), out)
    conn.commit()
    print(f'dashboard_shop_daily loaded: {len(out):,}', flush=True)


def load_shop_genre_daily(conn):
    frames = []
    for path in sorted((DATA / 'shop-estimates-by-month').glob('*.csv')):
        df = pd.read_csv(path)
        df = df[df['genre'].astype(str).ne('all')].copy()
        if df.empty:
            continue
        frames.append(pd.DataFrame({
            'date': pd.to_datetime(df['date']).dt.date,
            'shop_id': numeric(df['shop']).astype('int64'),
            'genre_id': numeric(df['genre']).astype('int64'),
            'estimated_sales_yen': numeric(df['predicted_sales']),
            'sales_low_95': numeric(df['predicted_sales_low']),
            'sales_high_95': numeric(df['predicted_sales_high']),
            'estimated_units': numeric(df['predicted_units']),
            'units_low_95': numeric(df['predicted_units_low']),
            'units_high_95': numeric(df['predicted_units_high']),
            'model_version': MODEL_VERSION,
        }))
    out = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
    if not out.empty:
        out.to_parquet(PARQUET_OUT / 'dashboard_shop_genre_daily.parquet', index=False)
    with conn.cursor() as cur:
        cur.execute('DELETE FROM dashboard_shop_genre_daily WHERE model_version = %s', (MODEL_VERSION,))
        copy_dataframe(cur, 'dashboard_shop_genre_daily', list(out.columns), out)
    conn.commit()
    print(f'dashboard_shop_genre_daily loaded: {len(out):,}', flush=True)


def refresh_views(conn):
    with conn.cursor() as cur:
        cur.execute('REFRESH MATERIALIZED VIEW mv_dashboard_all_genres_daily')
        cur.execute('REFRESH MATERIALIZED VIEW mv_dashboard_all_shops_daily')
    conn.commit()
    print('materialized views refreshed', flush=True)


def main():
    if not DATABASE_URL:
        raise SystemExit('DATABASE_URL is required')
    with psycopg.connect(DATABASE_URL, autocommit=False) as conn:
        load_options(conn)
        load_genre_daily(conn)
        load_rank_daily(conn)
        load_shop_daily(conn)
        load_shop_genre_daily(conn)
        refresh_views(conn)


if __name__ == '__main__':
    main()
