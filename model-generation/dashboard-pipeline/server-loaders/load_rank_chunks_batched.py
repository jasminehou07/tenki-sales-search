from __future__ import annotations

import io
import os
from pathlib import Path

import pandas as pd
import psycopg

DATABASE_URL = os.environ.get('DATABASE_URL')
DATA = Path('/opt/tenki-dashboard/site-data/data/ranked-shops-by-genre')
PARQUET_OUT = Path('/opt/tenki-dashboard/parquet/dashboard_genre_rank_daily_batches')
MODEL_VERSION = os.environ.get('MODEL_VERSION', 'github-pages-current')
BATCH_SIZE = int(os.environ.get('RANK_BATCH_SIZE', '500'))

COLS = ['date','genre_id','rank','shop_id','estimated_sales_yen','sales_low_95','sales_high_95','estimated_units','units_low_95','units_high_95','known_sales_yen','known_units','source_kind','model_version']


def num(s, default=0):
    return pd.to_numeric(s, errors='coerce').fillna(default)


def maybe_int(s):
    return pd.to_numeric(s, errors='coerce').astype('Int64')


def copy_df(cur, table, cols, df):
    buf = io.StringIO()
    df.to_csv(buf, index=False, header=False, na_rep='')
    buf.seek(0)
    with cur.copy(f"COPY {table} ({', '.join(cols)}) FROM STDIN WITH (FORMAT CSV, NULL '')") as cp:
        cp.write(buf.getvalue())


def transform(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    if df.empty:
        return pd.DataFrame(columns=COLS)
    df = df[df['rank'].between(1, 80)].copy()
    if df.empty:
        return pd.DataFrame(columns=COLS)
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
    return out.drop_duplicates(['genre_id', 'date', 'rank', 'model_version'], keep='first')


def main():
    if not DATABASE_URL:
        raise SystemExit('DATABASE_URL is required')
    PARQUET_OUT.mkdir(parents=True, exist_ok=True)
    files = sorted(DATA.glob('*/*.csv'))
    total = 0
    with psycopg.connect(DATABASE_URL, autocommit=False) as conn:
        with conn.cursor() as cur:
            cur.execute('DELETE FROM dashboard_genre_rank_daily WHERE model_version = %s', (MODEL_VERSION,))
        conn.commit()
        for batch_no, start in enumerate(range(0, len(files), BATCH_SIZE), 1):
            batch_files = files[start:start+BATCH_SIZE]
            frames = [transform(path) for path in batch_files]
            out = pd.concat([f for f in frames if not f.empty], ignore_index=True) if frames else pd.DataFrame(columns=COLS)
            if out.empty:
                continue
            out.to_parquet(PARQUET_OUT / f'batch_{batch_no:04d}.parquet', index=False)
            with conn.cursor() as cur:
                copy_df(cur, 'dashboard_genre_rank_daily', COLS, out)
            conn.commit()
            total += len(out)
            print(f'batch {batch_no:,}: files {min(start+BATCH_SIZE, len(files)):,}/{len(files):,}; rows {total:,}', flush=True)
    print(f'done rank rows: {total:,}', flush=True)

if __name__ == '__main__':
    main()
