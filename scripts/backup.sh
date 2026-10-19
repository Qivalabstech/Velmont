#!/bin/bash
# Manual backup when running without Docker. Usage: npm run backup
set -euo pipefail
source .env 2>/dev/null || true
DIR="${BACKUP_DIR:-./storage/backups}"; mkdir -p "$DIR"
STAMP=$(date +%Y-%m-%d_%H%M)
pg_dump "$DATABASE_URL" --no-owner | gzip > "$DIR/velmont-db-$STAMP.sql.gz"
tar -czf "$DIR/velmont-uploads-$STAMP.tar.gz" -C "${UPLOAD_DIR:-./storage/uploads}" . 2>/dev/null || true
find "$DIR" -name 'velmont-*' -mtime +14 -delete
echo "Backup saved to $DIR ($STAMP)"
