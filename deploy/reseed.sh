#!/usr/bin/env bash
# Ночной пересид демо (cron из server-setup.sh). Даты в сиде считаются от «сегодня»,
# поэтому без пересида расписание и номер недели через пару дней устаревают.
# Заодно демо возвращается к исходному виду: заявки, которые оставили проверяющие, удаляются.
set -euo pipefail
cd "$(dirname "$0")"

docker compose run --rm tools db:seed > /dev/null
echo "$(date -Is) reseed ok"
