#!/usr/bin/env bash
# Первичная настройка чистого Ubuntu 24.04. Запускать один раз от root: bash server-setup.sh
# Пакеты ставим из репозитория Ubuntu: его зеркала доступны из России, download.docker.com — не всегда.
set -euo pipefail

echo "==> Обновления и базовые пакеты"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get -y upgrade
apt-get -y install docker.io docker-compose-v2 git ufw unattended-upgrades curl

echo "==> Зеркало Docker Hub (образы postgres и caddy), если прямой доступ из России закрыт"
mkdir -p /etc/docker
if [ ! -f /etc/docker/daemon.json ]; then
  cat > /etc/docker/daemon.json <<'JSON'
{
  "registry-mirrors": ["https://mirror.gcr.io"],
  "log-driver": "local"
}
JSON
fi
systemctl enable --now docker
systemctl restart docker

echo "==> Swap 2 ГБ (запас памяти для PostgreSQL и Node.js)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Файрвол: только SSH, HTTP, HTTPS"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

echo "==> Автоматические обновления безопасности"
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "==> Код деплоя из публичного репозитория, ежедневный бэкап и пересид демо"
if [ ! -d /opt/dekanat/.git ]; then
  git clone https://github.com/MrYar07/dekanat-24-7.git /opt/dekanat
fi
mkdir -p /opt/dekanat/deploy/backups
cat > /etc/cron.d/dekanat-backup <<'CRON'
30 3 * * * root /opt/dekanat/deploy/backup.sh >> /var/log/dekanat-backup.log 2>&1
CRON
# 01:00 UTC = 04:00 МСК: демо-данные пересоздаются после бэкапа, когда сайтом никто не пользуется.
cat > /etc/cron.d/dekanat-reseed <<'CRON'
0 1 * * * root /opt/dekanat/deploy/reseed.sh >> /var/log/dekanat-reseed.log 2>&1
CRON

echo "Готово. Дальше: создать /opt/dekanat/deploy/.env и запустить update.sh (docs/DEPLOY.md)."
