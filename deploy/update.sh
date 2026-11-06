#!/usr/bin/env bash
# Выкатить свежую версию: обновить файлы деплоя, скачать образы, применить миграции, перезапустить.
# Запуск: /opt/dekanat/deploy/update.sh
# Тело в функции: bash дочитывает скрипт по ходу, а git pull может заменить этот файл прямо во время работы.
set -euo pipefail

main() {
  cd "$(dirname "$0")"
  git -C .. pull --ff-only
  docker compose --profile tools pull
  docker compose up -d db
  docker compose run --rm tools db:migrate
  docker compose up -d --remove-orphans
  docker image prune -f
  docker compose ps
}

main "$@"
exit
