# Деплой «Деканата 24/7»

Схема: push в `main` → GitHub Actions проверяет код и собирает два Docker-образа в GHCR → сервер скачивает их и перезапускается.

```
GitHub (код) ──CI──▶ ghcr.io/mryar07/dekanat-24-7        (приложение)
                     ghcr.io/mryar07/dekanat-24-7-tools  (миграции, наполнение базы)
                                │ docker compose pull
                                ▼
VPS (Москва): Caddy :443 ──▶ app :3000 ──▶ PostgreSQL 18
```

Наружу открыт только Caddy: он получает HTTPS-сертификат Let's Encrypt и ставит настоящий IP клиента в `X-Forwarded-For`, на нём держится ограничение попыток входа. Приложение и база доступны только внутри Docker-сети.

## 1. Сервер

- AdminVPS, дата-центр в Москве, **Ubuntu 24.04**, от **2 ГБ RAM** и 20 ГБ диска.
- При заказе добавь свой публичный SSH-ключ. Он лежит в `C:\Users\<ты>\.ssh\id_ed25519.pub`, это одна строка `ssh-ed25519 AAAA…`.
  Если сервер уже выдан с паролем, добавь ключ сам одной командой и один раз введи пароль:
  ```powershell
  type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@IP "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
  ```
- Пароль сервера никому не пересылай, в том числе ИИ: дальше вход только по ключу.

## 2. Первичная настройка (один раз)

```bash
ssh root@IP "curl -fsSL https://raw.githubusercontent.com/MrYar07/dekanat-24-7/main/deploy/server-setup.sh | bash"
```

Скрипт ставит Docker из репозитория Ubuntu и настраивает зеркало Docker Hub (на случай блокировки из России). Ещё он добавляет swap 2 ГБ, включает файрвол (22, 80, 443) и автоматические обновления безопасности, клонирует репозиторий в `/opt/dekanat` и ставит ежедневный бэкап базы.

## 3. Секреты (один раз, только на сервере)

```bash
ssh root@IP
cd /opt/dekanat/deploy && cp .env.example .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 24)/" .env
nano .env    # SITE_ADDRESS=1-2-3-4.sslip.io (IP через дефисы) и SEED_PASSWORD
chmod 600 .env
```

## 4. Запуск

```bash
/opt/dekanat/deploy/update.sh                                  # образы, миграции, старт
docker compose -f /opt/dekanat/deploy/compose.yaml run --rm tools db:seed   # вымышленные данные
```

`db:seed` **пересоздаёт** все данные. Запускать при первом деплое и когда нужно вернуть демо к исходному виду.

## Обновление и откат

- Обновить: `/opt/dekanat/deploy/update.sh` после зелёного CI.
- Откатиться: в `.env` поставить `APP_TAG=sha-<коммит>` и снова запустить `update.sh`.
- Бэкапы: `/opt/dekanat/deploy/backups`, 14 последних дней.
  Восстановить: `gunzip -c backups/dekanat-ДАТА.sql.gz | docker compose exec -T db psql -U dekanat dekanat`.

## Проверка после деплоя

- `https://ADDRESS/login` открывается из России **без VPN**: с мобильного интернета и с домашнего Wi-Fi.
- Сертификат действителен, `http://` перенаправляет на `https://`.
- Заголовки: `curl -sI https://ADDRESS/login` показывает `content-security-policy`, `strict-transport-security`, `x-frame-options: DENY`.
- Вход двумя студентами: у каждого свои данные. Студент на `/staff` возвращается на свою главную.
- `/design-lab` в проде отдаёт 404.

## Если что-то не так

| Симптом | Что смотреть |
|---|---|
| `docker compose pull` не скачивает образ приложения | пакеты в GHCR должны быть публичными: GitHub → профиль → Packages → пакет → Package settings → Change visibility → Public |
| Не скачиваются `postgres` или `caddy` | доступ к Docker Hub; зеркало задано в `/etc/docker/daemon.json` |
| Нет HTTPS | `docker compose logs caddy`: порты 80/443 должны быть открыты, `SITE_ADDRESS` указывать на IP сервера |
| 502 от Caddy | `docker compose logs app`, `docker compose ps`: приложение ждёт здоровую базу |
