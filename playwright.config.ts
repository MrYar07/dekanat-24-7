import "dotenv/config";
import { defineConfig } from "@playwright/test";

// Сквозные тесты против локального dev-сервера и локальной базы с сидом.
// Браузер — установленный Google Chrome (channel: "chrome"), отдельно ничего не скачиваем.
// Запуск: npm run db:start, npm run db:seed, npm run dev, затем npm run test:e2e.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  // Dev-сервер собирает страницу при первом заходе после правок кода: это бывает дольше стандартных 5 с,
  // и тогда первая же проверка падает, хотя страница рабочая (так однажды упал сценарий 7 путеводителя).
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    channel: "chrome",
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
