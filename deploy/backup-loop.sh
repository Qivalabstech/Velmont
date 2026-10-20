#!/bin/sh
# Nightly backup: database dump + product photos. Keeps the last $KEEP_DAYS days.
set -e
while true; do
  STAMP=$(date +%Y-%m-%d_%H%M)
  echo "[backup] $STAMP starting"
  pg_dump -h db -U velmont -d velmont --no-owner | gzip > /backups/velmont-db-$STAMP.sql.gz && echo "[backup] database saved"
  tar -czf /backups/velmont-uploads-$STAMP.tar.gz -C /uploads . 2>/dev/null && echo "[backup] photos saved"
  find /backups -name 'velmont-*' -mtime +${KEEP_DAYS:-14} -delete
  sleep 86400
done
