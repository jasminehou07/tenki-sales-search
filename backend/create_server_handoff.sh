#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/opt/tenki-dashboard"
HANDOFF_ROOT="/opt/tenki-dashboard-handoff"
ARCHIVE="/tmp/tenki-dashboard-code-handoff.tgz"
README_SOURCE="/tmp/tenki-dashboard-handoff-README.md"

mkdir -p \
  "$HANDOFF_ROOT/source-current" \
  "$HANDOFF_ROOT/site" \
  "$HANDOFF_ROOT/api" \
  "$HANDOFF_ROOT/scripts" \
  "$HANDOFF_ROOT/sql" \
  "$HANDOFF_ROOT/config" \
  "$HANDOFF_ROOT/data-links"

if [[ -f "$ARCHIVE" ]]; then
  tar -xzf "$ARCHIVE" -C "$HANDOFF_ROOT/source-current"
fi

find "$HANDOFF_ROOT" -name '._*' -type f -delete

if [[ -f "$README_SOURCE" ]]; then
  cp "$README_SOURCE" "$HANDOFF_ROOT/README.md"
elif [[ -f "$HANDOFF_ROOT/source-current/HANDOFF.md" ]]; then
  cp "$HANDOFF_ROOT/source-current/HANDOFF.md" "$HANDOFF_ROOT/README.md"
fi

if [[ -d "$APP_ROOT/site-data" ]]; then
  cp -a "$APP_ROOT/site-data/index.html" "$HANDOFF_ROOT/site/" 2>/dev/null || true
  cp -a "$APP_ROOT/site-data/app.js" "$HANDOFF_ROOT/site/" 2>/dev/null || true
  cp -a "$APP_ROOT/site-data/styles.css" "$HANDOFF_ROOT/site/" 2>/dev/null || true
  cp -a "$APP_ROOT/site-data/scripts" "$HANDOFF_ROOT/site/" 2>/dev/null || true
fi

if [[ -d "$APP_ROOT/api" ]]; then
  cp -a "$APP_ROOT/api/server.js" "$HANDOFF_ROOT/api/" 2>/dev/null || true
  cp -a "$APP_ROOT/api/package.json" "$HANDOFF_ROOT/api/" 2>/dev/null || true
  cp -a "$APP_ROOT/api/package-lock.json" "$HANDOFF_ROOT/api/" 2>/dev/null || true
fi

if [[ -d "$APP_ROOT/scripts" ]]; then
  cp -a "$APP_ROOT/scripts/." "$HANDOFF_ROOT/scripts/"
fi

if [[ -d "$HANDOFF_ROOT/source-current/backend" ]]; then
  cp -a "$HANDOFF_ROOT/source-current/backend/"*.sql "$HANDOFF_ROOT/sql/" 2>/dev/null || true
  cp -a "$HANDOFF_ROOT/source-current/backend/env.template" "$HANDOFF_ROOT/config/env.template" 2>/dev/null || true
fi

if [[ -f "$APP_ROOT/.env" ]]; then
  sed -E 's/(PASSWORD|PASS|KEY|SECRET|TOKEN|DATABASE_URL)=.*/\1=<redacted>/I' "$APP_ROOT/.env" > "$HANDOFF_ROOT/config/env.current.redacted"
fi

if [[ -d "$APP_ROOT/parquet" ]]; then
  ln -sfn "$APP_ROOT/parquet" "$HANDOFF_ROOT/data-links/parquet"
fi

if [[ -d "$APP_ROOT/site-data/data" ]]; then
  ln -sfn "$APP_ROOT/site-data/data" "$HANDOFF_ROOT/data-links/generated-csv"
  ln -sfn "$APP_ROOT/site-data/data" "$HANDOFF_ROOT/data-links/legacy-site-data"
fi

for raw_dir in events genre-ranking genre-sales; do
  if [[ -d "/root/$raw_dir" ]]; then
    ln -sfn "/root/$raw_dir" "$HANDOFF_ROOT/data-links/$raw_dir"
  fi
done

for raw_dir in genre-ranking2 genre-ranking3 genre-sales2 genre-sales3; do
  if [[ -d "/root/$raw_dir" ]]; then
    ln -sfn "/root/$raw_dir" "$HANDOFF_ROOT/data-links/$raw_dir"
  fi
done

if [[ -d "/root/TENKI" ]]; then
  ln -sfn "/root/TENKI" "$HANDOFF_ROOT/data-links/root-tenki"
fi

date -u +"%Y-%m-%dT%H:%M:%SZ" > "$HANDOFF_ROOT/last_refreshed_utc.txt"

echo "Created handoff folder at $HANDOFF_ROOT"
