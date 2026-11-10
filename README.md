# Деканат 24/7

Концепт личного кабинета студента вымышленного университета «Меридиан» для конкурса MGIMO AI Challenge 2026, номинация «Вайб-кодинг».

> **Не официальный сервис. Все данные вымышлены.**

**Демо:** https://5-35-126-36.sslip.io — тестовые аккаунты `student1`, `student2`, `teacher`, `dean`. Пароль — в комментарии к конкурсной работе.

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

Проверки: `npm test` (юнит-тесты), `npm run test:e2e` (Playwright в установленном Chrome; нужны запущенная база и свежий сид).

## Лицензии сторонних материалов

| Что | Лицензия |
|---|---|
| Next.js, React, Tailwind CSS | MIT |
| Drizzle ORM | Apache-2.0 |
| drizzle-kit, node-postgres (`pg`), `@node-rs/argon2`, Zod | MIT |
| Lucide (иконки) | ISC |
| Шрифты Golos Text и PT Serif (через Fontsource) | SIL Open Font License 1.1 |
| `pdf-lib`, `@pdf-lib/fontkit` (PDF справок), `qrcode` (QR-код проверки) | MIT |
| embedded-postgres (только для разработки), Vitest | MIT |
| Playwright (только для тестов) | Apache-2.0 |
| PostgreSQL (образ в проде) | PostgreSQL License |
| Caddy (HTTPS-прокси в проде) | Apache-2.0 |

Файлы PT Serif для PDF лежат в `assets/fonts/` вместе с текстом лицензии `OFL.txt`.

Логотип «Деканат 24/7» нарисован для проекта и не связан с логотипами реальных вузов.
