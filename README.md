# Деканат 24/7

Концепт личного кабинета студента вымышленного университета «Меридиан» для конкурса MGIMO AI Challenge 2026, номинация «Вайб-кодинг».

> **Не официальный сервис. Все данные вымышлены.**

- Что строим: [docs/PRD.md](docs/PRD.md)
- Как устроено: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Как выкатить на сервер: [docs/DEPLOY.md](docs/DEPLOY.md)
- Как создавалось с ИИ: [docs/process/JOURNAL.md](docs/process/JOURNAL.md)

## Запуск

```bash
cp .env.example .env    # и задать пароли
npm install
npm run db:start        # в отдельном терминале
npm run db:migrate && npm run db:seed
npm run dev
```

## Лицензии сторонних материалов

| Что | Лицензия |
|---|---|
| Next.js, React, Tailwind CSS | MIT |
| Drizzle ORM | Apache-2.0 |
| drizzle-kit, node-postgres (`pg`), `@node-rs/argon2`, Zod | MIT |
| Lucide (иконки) | ISC |
| Шрифты Golos Text и PT Serif (через Fontsource) | SIL Open Font License 1.1 |
| embedded-postgres (только для разработки), Vitest | MIT |
| PostgreSQL (образ в проде) | PostgreSQL License |
| Caddy (HTTPS-прокси в проде) | Apache-2.0 |

Логотип «Деканат 24/7» нарисован для проекта и не связан с логотипами реальных вузов.
