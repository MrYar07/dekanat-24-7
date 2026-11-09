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

Текущий прод: **https://5-35-126-36.sslip.io**. AdminVPS, тариф Micro (2 vCPU, 4 ГБ RAM, 60 ГБ NVMe), Москва, Ubuntu 24.04, без панели управления.

**Ключ деплоя.** Отдельный ключ `~/.ssh/dekanat_deploy` без парольной фразы, чтобы ИИ-агент мог работать с сервером без человека. Основной ключ автора защищён фразой, и агент не может им воспользоваться. В `~/.ssh/config` есть короткое имя:

```
Host dekanat
    HostName 5.35.126.36
    User root
    IdentityFile ~/.ssh/dekanat_deploy
    IdentitiesOnly yes
```

Ключ на сервер добавляется один раз, с паролем root из панели хостера. Пароль вводит человек в своём терминале:

```powershell
ssh-keygen -t ed25519 -N '""' -C dekanat-deploy -f $env:USERPROFILE\.ssh\dekanat_deploy
Get-Content $env:USERPROFILE\.ssh\dekanat_deploy.pub | ssh dekanat "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

После настройки вход по паролю отключён (`/etc/ssh/sshd_config.d/00-dekanat.conf`). Если ключ потерян, остаётся консоль VNC в панели AdminVPS.

## 2. Первичная настройка (один раз)

```bash
ssh dekanat "curl -fsSL https://raw.githubusercontent.com/MrYar07/dekanat-24-7/main/deploy/server-setup.sh | bash"
```

Скрипт ставит Docker из репозитория Ubuntu и настраивает зеркало Docker Hub (на случай блокировки из России). Ещё он добавляет swap 2 ГБ (если у хостера его нет), включает файрвол (22, 80, 443) и автоматические обновления безопасности, клонирует репозиторий в `/opt/dekanat` и ставит ежедневный бэкап базы.

## 3. Секреты (один раз, только на сервере)

```bash
ssh dekanat
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

Каждую ночь в 04:00 МСК cron запускает `deploy/reseed.sh`: даты в сиде считаются от текущего дня, поэтому без пересида расписание и номер недели устаревают. Всё, что за день наделали в демо (заявки, сессии), при этом стирается: проверяющим придётся войти заново. Журнал: `/var/log/dekanat-reseed.log`.

После первого запуска `server-setup.sh` может попросить перезагрузку (обновилось ядро): `ssh dekanat systemctl reboot`.

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
