#!/usr/bin/env bash
# Ежедневный дамп базы (cron из server-setup.sh). Храним 14 последних.
set -euo pipefail
cd "$(dirname "$0")"

file="backups/dekanat-$(date +%F).sql.gz"
docker compose exec -T db pg_dump -U dekanat dekanat | gzip > "$file"
find backups -name 'dekanat-*.sql.gz' -mtime +14 -delete
echo "$(date -Is) backup ok: $file"
