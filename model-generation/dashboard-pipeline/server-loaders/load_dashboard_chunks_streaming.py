from __future__ import annotations

import argparse
import io
import os
from pathlib import Path

import pandas as pd
import psycopg

DATABASE_URL = os.environ.get('DATABASE_URL')
DATA = Path('/opt/tenki-dashboard/site-data/data')
PARQUET_OUT = Path('/opt/tenki-dashboard/parquet')
MODEL_VERSION = os.environ.get('MODEL_VERSION', 'github-pages-current')


def num(s, default=0):
    return pd.to_numeric(s, errors='coerce').fillna(default)


def maybe_int(s):
    return pd.to_numeric(s, errors='coerce').astype('Int64')


def copy_df(cur, table, cols, df):
    if df.empty:
        return
    buf = io.StringIO()
    df.to_csv(buf, index=False, header=False, na_rep='')
    buf.seek(0)
    with cur.copy(f"COPY {table} ({', '.join(cols)}) FROM STDIN WITH (FORMAT CSV, NULL '')") as cp:
        cp.write(buf.getvalue())


def load_options(conn):
    options = pd.read_csv(DATA / 'filter_options.csv')
    genres = options[options['type'].eq('genre')].copy()
    genres_out = pd.DataFrame({
        'genre_id': num(genres['id']).astype('int64'),
        'genre_name_ja': '',
        'genre_name_en': genres['label'].astype(str),
        'genre_group': '',
        'dropdown_sales_yen': num(genres['sales']),
        'active': True,
    }).drop_duplicates('genre_id')
    shops = pd.read_csv(DATA / 'shop_options.csv')
    shops_out = pd.DataFrame({
        'shop_id': num(shops['id']).astype('int64'),
        'shop_label': shops['label'].astype(str),
        'shop_group': '',
        'dropdown_sales_yen': num(shops['sales']),
        'active': True,
    }).drop_duplicates('shop_id')
    with conn.cursor() as cur:
        cur.execute('TRUNCATE genres, shops')
        copy_df(cur, 'genres', list(genres_out.columns), genres_out)
        copy_df(cur, 'shops', list(shops_out.columns), shops_out)
    conn.commit()
    print(f'options: {len(genres_out):,} genres, {len(shops_out):,} shops', flush=True)


def load_genre_daily(conn):
    out_dir = PARQUET_OUT / 'dashboard_genre_daily'
    out_dir.mkdir(parents=True, exist_ok=True)
    with conn.cursor() as cur:
        cur.execute('DELETE FROM dashboard_genre_daily WHERE model_version = %s', (MODEL_VERSION,))
    conn.commit()
    total = 0
    cols = ['date','genre_id','estimated_sales_yen','sales_low_95','sales_high_95','estimated_units','units_low_95','units_high_95','known_sales_yen','known_units','known_page_views','source_kind','model_version']
    for path in sorted((DATA / 'rank-summary-by-month').glob('*.csv')):
        df = pd.read_csv(path)
        df = df[df['genre'].astype(str).ne('all')].copy()
        if df.empty:
            continue
        out = pd.DataFrame({
            'date': pd.to_datetime(df['date']).dt.date,
            'genre_id': num(df['genre']).astype('int64'),
            'estimated_sales_yen': num(df['sales']),
            'sales_low_95': num(df['sales_low']),
            'sales_high_95': num(df['sales_high']),
            'estimated_units': num(df['units']),
            'units_low_95': num(df['units_low']),
            'units_high_95': num(df['units_high']),
            'known_sales_yen': None,
            'known_units': None,
            'known_page_views': None,
            'source_kind': 'model',
            'model_version': MODEL_VERSION,
        })
        out.to_parquet(out_dir / path.name.replace('.csv', '.parquet'), index=False)
        with conn.cursor() as cur:
            copy_df(cur, 'dashboard_genre_daily', cols, out)
        conn.commit()
        total += len(out)
    print(f'genre daily: {total:,}', flush=True)


def load_rank_daily(conn):
    out_dir = PARQUET_OUT / 'dashboard_genre_rank_daily'
    out_dir.mkdir(parents=True, exist_ok=True)
    with conn.cursor() as cur:
        cur.execute('DELETE FROM dashboard_genre_rank_daily WHERE model_version = %s', (MODEL_VERSION,))
    conn.commit()
    total = 0
    cols = ['date','genre_id','rank','shop_id','estimated_sales_yen','sales_low_95','sales_high_95','estimated_units','units_low_95','units_high_95','known_sales_yen','known_units','source_kind','model_version']
    files = sorted((DATA / 'ranked-shops-by-genre').glob('*/*.csv'))
    for i, path in enumerate(files, 1):
        df = pd.read_csv(path)
        if df.empty:
            continue
        df = df[df['rank'].between(1, 80)].copy()
        if df.empty:
            continue
        source = df['source'].astype(str).str.lower()
        out = pd.DataFrame({
            'date': pd.to_datetime(df['date']).dt.date,
            'genre_id': num(df['genre']).astype('int64'),
            'rank': num(df['rank']).astype('int64'),
            'shop_id': maybe_int(df.get('shop')),
            'estimated_sales_yen': num(df['sales']),
            'sales_low_95': num(df['sales_low']),
            'sales_high_95': num(df['sales_high']),
            'estimated_units': None,
            'units_low_95': None,
            'units_high_95': None,
            'known_sales_yen': None,
            'known_units': None,
            'source_kind': source.map(lambda v: 'known_tenki' if 'actual' in v or 'known' in v else 'model'),
            'model_version': MODEL_VERSION,
        })
        genre_dir = out_dir / path.parent.name
        genre_dir.mkdir(parents=True, exist_ok=True)
        out.to_parquet(genre_dir / path.name.replace('.csv', '.parquet'), index=False)
        with conn.cursor() as cur:
            copy_df(cur, 'dashboard_genre_rank_daily', cols, out)
        conn.commit()
        total += len(out)
        if i % 500 == 0 or i == len(files):
            print(f'rank daily files {i:,}/{len(files):,}; rows {total:,}', flush=True)
    print(f'rank daily: {total:,}', flush=True)


def load_shop_daily(conn):
    out_dir = PARQUET_OUT / 'dashboard_shop_daily'
    out_dir.mkdir(parents=True, exist_ok=True)
    with conn.cursor() as cur:
        cur.execute('DELETE FROM dashboard_shop_daily WHERE model_version = %s', (MODEL_VERSION,))
    conn.commit()
    total = 0
    cols = ['date','shop_id','estimated_sales_yen','sales_low_95','sales_high_95','estimated_units','units_low_95','units_high_95','known_sales_yen','known_units','source_kind','model_version']
    for path in sorted((DATA / 'shop-summary-by-month').glob('*.csv')):
        df = pd.read_csv(path)
        df = df[df['genre'].astype(str).eq('all')].copy()
        if df.empty:
            continue
        out = pd.DataFrame({
            'date': pd.to_datetime(df['date']).dt.date,
            'shop_id': num(df['shop']).astype('int64'),
            'estimated_sales_yen': num(df['predicted_sales']),
            'sales_low_95': num(df['predicted_sales_low']),
            'sales_high_95': num(df['predicted_sales_high']),
            'estimated_units': num(df['predicted_units']),
            'units_low_95': num(df['predicted_units_low']),
            'units_high_95': num(df['predicted_units_high']),
            'known_sales_yen': None,
            'known_units': None,
            'source_kind': 'model',
            'model_version': MODEL_VERSION,
        })
        out.to_parquet(out_dir / path.name.replace('.csv', '.parquet'), index=False)
        with conn.cursor() as cur:
            copy_df(cur, 'dashboard_shop_daily', cols, out)
        conn.commit()
        total += len(out)
    print(f'shop daily: {total:,}', flush=True)


def load_shop_genre_daily(conn):
    out_dir = PARQUET_OUT / 'dashboard_shop_genre_daily'
    out_dir.mkdir(parents=True, exist_ok=True)
    with conn.cursor() as cur:
        cur.execute('DELETE FROM dashboard_shop_genre_daily WHERE model_version = %s', (MODEL_VERSION,))
    conn.commit()
    total = 0
    cols = ['date','shop_id','genre_id','estimated_sales_yen','sales_low_95','sales_high_95','estimated_units','units_low_95','units_high_95','model_version']
    for i, path in enumerate(sorted((DATA / 'shop-estimates-by-month').glob('*.csv')), 1):
        df = pd.read_csv(path)
        df = df[df['genre'].astype(str).ne('all')].copy()
        if df.empty:
            continue
        out = pd.DataFrame({
            'date': pd.to_datetime(df['date']).dt.date,
            'shop_id': num(df['shop']).astype('int64'),
            'genre_id': num(df['genre']).astype('int64'),
            'estimated_sales_yen': num(df['predicted_sales']),
            'sales_low_95': num(df['predicted_sales_low']),
            'sales_high_95': num(df['predicted_sales_high']),
            'estimated_units': num(df['predicted_units']),
            'units_low_95': num(df['predicted_units_low']),
            'units_high_95': num(df['predicted_units_high']),
            'model_version': MODEL_VERSION,
        })
        out.to_parquet(out_dir / path.name.replace('.csv', '.parquet'), index=False)
        with conn.cursor() as cur:
            copy_df(cur, 'dashboard_shop_genre_daily', cols, out)
        conn.commit()
        total += len(out)
        if i % 20 == 0:
            print(f'shop genre months {i}; rows {total:,}', flush=True)
    print(f'shop genre daily: {total:,}', flush=True)


def refresh(conn):
    with conn.cursor() as cur:
        cur.execute('REFRESH MATERIALIZED VIEW mv_dashboard_all_genres_daily')
        cur.execute('REFRESH MATERIALIZED VIEW mv_dashboard_all_shops_daily')
    conn.commit()
    print('views refreshed', flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--skip-rank', action='store_true')
    parser.add_argument('--only-rank', action='store_true')
    args = parser.parse_args()
    if not DATABASE_URL:
        raise SystemExit('DATABASE_URL is required')
    with psycopg.connect(DATABASE_URL, autocommit=False) as conn:
        if args.only_rank:
            load_rank_daily(conn)
            return
        load_options(conn)
        load_genre_daily(conn)
        if not args.skip_rank:
            load_rank_daily(conn)
        load_shop_daily(conn)
        load_shop_genre_daily(conn)
        refresh(conn)

if __name__ == '__main__':
    main()
