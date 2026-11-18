// Запись демо-видео для жюри: сценарий проходится в браузере автоматически, как e2e-тест.
// Каждая часть (телефон студента, преподаватель, деканат…) пишется отдельно: кадры экрана через
// screencast Chrome в полном разрешении (запись видео Playwright сохраняет страницу в CSS-пикселях — мелко),
// рядом — parts.json с временем кадров и подписями. Склейка с подписями — scripts/compose-demo.py (JOURNAL, этап 36).
//
// Запуск: npm run build, затем SITE_URL=<адрес прода> npx next start -p 3100,
// затем npx tsx scripts/record-demo.ts <папка для роликов>. После записи — npm run db:seed:
// сценарий меняет локальную базу (справка, балл, объявление).
// Пароль тестовых аккаунтов — из .env, в коде его нет.
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium, type Browser, type Locator, type Page } from "@playwright/test";
import { Pool } from "pg";

const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3100";
const OUT = resolve(process.argv[2] ?? "demo-video");
const PHONE = { width: 360, height: 780 };
const DESKTOP = { width: 1280, height: 720 };

type Caption = { at: number; text: string };
type Frame = { file: string; at: number };
type Part = { name: string; kind: "phone" | "desktop"; frames: Frame[]; end: number; captions: Caption[] };
const parts: Part[] = [];

async function query<T>(text: string, values: unknown[] = []): Promise<T[]> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    return (await pool.query(text, values)).rows as T[];
  } finally {
    await pool.end();
  }
}

const pause = (page: Page, ms: number) => page.waitForTimeout(ms);

/** Ролик одной части: свой контекст браузера, своё видео и свои подписи. */
async function part(browser: Browser, name: string, kind: Part["kind"], run: (page: Page, cap: (text: string) => void) => Promise<void>) {
  const size = kind === "phone" ? PHONE : DESKTOP;
  const scale = kind === "phone" ? 2 : 1.5;
  const context = await browser.newContext({
    viewport: size,
    deviceScaleFactor: scale,
    isMobile: kind === "phone",
    hasTouch: kind === "phone",
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    colorScheme: "light",
  });
  const page = await context.newPage();
  const dir = join(OUT, name);
  mkdirSync(dir, { recursive: true });
  const t0 = Date.now() / 1000;
  const frames: Frame[] = [];
  const cdp = await context.newCDPSession(page);
  cdp.on("Page.screencastFrame", (f) => {
    const file = join(dir, `${String(frames.length).padStart(5, "0")}.jpg`);
    writeFileSync(file, Buffer.from(f.data, "base64"));
    frames.push({ file, at: (f.metadata.timestamp ?? Date.now() / 1000) - t0 });
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, everyNthFrame: 1 });
  const captions: Caption[] = [];
  await run(page, (text) => captions.push({ at: Date.now() / 1000 - t0, text }));
  await pause(page, 1200);
  const end = Date.now() / 1000 - t0;
  await cdp.send("Page.stopScreencast").catch(() => {});
  await context.close();
  parts.push({ name, kind, frames, end, captions });
  console.log(`${name}: ${end.toFixed(0)} с, кадров ${frames.length}`);
}

/** Нажатие с подсветкой: в записи нет курсора, поэтому зритель видит, куда нажали. */
async function tap(page: Page, target: Locator, wait = 900) {
  await target.scrollIntoViewIfNeeded();
  await target.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const ring = document.createElement("div");
    Object.assign(ring.style, {
      position: "fixed",
      left: `${box.left - 4}px`,
      top: `${box.top - 4}px`,
      width: `${box.width + 8}px`,
      height: `${box.height + 8}px`,
      border: "3px solid #e0a100",
      borderRadius: "10px",
      zIndex: "2147483647",
      pointerEvents: "none",
      boxShadow: "0 0 0 6px rgba(224,161,0,.25)",
    });
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), 700);
  });
  await pause(page, 650);
  await target.click();
  await pause(page, wait);
}

async function type(page: Page, field: Locator, text: string) {
  await tap(page, field, 200);
  await field.pressSequentially(text, { delay: 55 });
  await pause(page, 500);
}

/** Плавная прокрутка страницы вниз — чтобы на видео было видно, что ниже. */
async function scroll(page: Page, px: number, ms = 2200) {
  // Строкой, а не функцией: tsx добавляет в функции служебный __name, которого нет в браузере.
  await page.evaluate(`new Promise((done) => {
    const start = window.scrollY, t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ${ms});
      window.scrollTo(0, start + ${px} * (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2));
      if (k < 1) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  })`);
  await pause(page, 600);
}

async function login(page: Page, who: string, slow = true) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Логин").waitFor();
  await pause(page, slow ? 1200 : 300);
  if (slow) {
    await type(page, page.getByLabel("Логин"), who);
    await tap(page, page.getByLabel("Пароль"), 200);
    await page.getByLabel("Пароль").pressSequentially(process.env.SEED_PASSWORD!, { delay: 40 });
  } else {
    await page.getByLabel("Логин").fill(who);
    await page.getByLabel("Пароль").fill(process.env.SEED_PASSWORD!);
  }
  await tap(page, page.getByRole("button", { name: "Войти" }), 300);
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.waitForLoadState("networkidle");
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  await pause(page, 900);
}

async function main() {
  if (!process.env.SEED_PASSWORD) throw new Error("Нет SEED_PASSWORD в .env");
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome" });
  const announcement = "Консультация перед третьим срезом";
  let studyRequest = "";

  // 1. Студент с телефона: вход, «Сегодня», расписание, оценки, справка за минуту, уведомления.
  await part(browser, "1-student", "phone", async (page, cap) => {
    cap("Вход по логину и паролю. Студентка Алина, 2 курс — данные вымышленные");
    await login(page, "student1");
    await settle(page);
    cap("«Сегодня» — главное на одном экране: следующая пара, переносы, новые баллы");
    await pause(page, 2500);
    await scroll(page, 700, 3500);
    cap("Ниже — ведомость с рейтингом, статусы справок и объявления деканата");
    await scroll(page, 900, 3500);
    await pause(page, 1200);

    cap("Расписание на неделю: аудитория, преподаватель, переносы выделены");
    await tap(page, page.getByRole("link", { name: "Расписание" }).filter({ visible: true }).first());
    await settle(page);
    await scroll(page, 600, 3000);
    await pause(page, 1200);

    cap("Успеваемость: прогноз рейтинга и что нужно для «отлично» по каждой дисциплине");
    await tap(page, page.getByRole("link", { name: /Оценки|Успеваемость/ }).filter({ visible: true }).first());
    await settle(page);
    await pause(page, 1500);
    await scroll(page, 1500, 5000);
    await pause(page, 1500);

    cap("«Спроси деканат»: вопрос своими словами — ответ из своих данных или готовая форма");
    await tap(page, page.getByRole("link", { name: "Спроси деканат" }).filter({ visible: true }).first());
    await settle(page);
    await type(page, page.getByLabel("Вопрос"), "нужна справка в военкомат");
    await tap(page, page.getByRole("button", { name: "Спросить" }));
    await settle(page);
    await pause(page, 1500);
    await tap(page, page.getByRole("link", { name: "Открыть заполненную форму" }));
    await settle(page);
    cap("Справка за минуту: назначение уже выбрано, PDF с QR-кодом формируется сразу");
    await pause(page, 1500);
    await tap(page, page.getByRole("button", { name: "Сформировать PDF" }));
    await page.waitForURL(/\/requests\/[0-9a-f-]{36}/);
    await settle(page);
    studyRequest = page.url().match(/requests\/([0-9a-f-]{36})/)![1];
    await pause(page, 2500);
    await scroll(page, 400, 2000);
    await pause(page, 1500);

    const [{ code }] = await query<{ code: string }>("select code from issued_documents where request_id = $1", [studyRequest]);
    cap("По QR-коду любой проверит справку без входа: ФИО скрыто, видно только «действительна»");
    await page.goto(`${BASE}/verify/${code}`);
    await settle(page);
    await pause(page, 3500);
  });

  // 2. Преподаватель: балл за срез — студент видит сразу.
  await part(browser, "2-teacher", "desktop", async (page, cap) => {
    cap("Кабинет преподавателя: свои курсы и группы");
    await login(page, "teacher", false);
    await settle(page);
    await pause(page, 1500);
    await tap(page, page.getByRole("link", { name: /ГЭ-24-1/ }).first());
    await settle(page);
    cap("Балл за срез: студент сразу получает уведомление, рейтинг пересчитывается");
    const field = page.getByLabel("Жукова Ева Дмитриевна, балл за срез 2");
    await type(page, field, "81");
    await tap(page, page.getByRole("button", { name: "Сохранить срез 2" }), 1800);
    cap("Анонимная оценка преподавания: сводка открывается только от 5 ответов");
    await tap(page, page.getByRole("link", { name: "Отзывы" }));
    await settle(page);
    await pause(page, 2000);
    await scroll(page, 500, 2500);
    await pause(page, 1500);
  });

  // 3. Деканат: сводка и объявление группе.
  await part(browser, "3-dean", "desktop", async (page, cap) => {
    cap("Деканат: сводка — сколько походов в деканат сэкономил кабинет");
    await login(page, "dean", false);
    await page.goto(`${BASE}/staff/stats`);
    await settle(page);
    await pause(page, 2000);
    await scroll(page, 500, 2500);
    await pause(page, 1200);
    cap("Объявление группе: у студентов на главной и в уведомлениях, опечатку можно исправить");
    await page.goto(`${BASE}/staff/announcements`);
    await settle(page);
    await page.getByLabel("Кому").selectOption({ label: "Группа ГЭ-24-1" });
    await pause(page, 600);
    await type(page, page.getByLabel("Заголовок"), announcement);
    await type(page, page.getByLabel("Текст"), "Четверг, 16:40, ауд. 218. Разберём задания прошлого года.");
    await tap(page, page.getByRole("button", { name: "Опубликовать" }), 2500);
  });

  // 4. Снова студент: объявление уже на главной.
  await part(browser, "4-student", "phone", async (page, cap) => {
    await login(page, "student1", false);
    await settle(page);
    cap("Объявление уже у студента в уведомлениях и на главной — без чатов и почты");
    await pause(page, 1500);
    await scroll(page, 900, 2500);
    await pause(page, 1500);
    await tap(page, page.getByRole("link", { name: /Уведомления/ }).filter({ visible: true }).first());
    await settle(page);
    await pause(page, 3500);
  });

  // 5. Безопасность: другой студент открывает чужую справку по прямой ссылке.
  await part(browser, "5-security", "phone", async (page, cap) => {
    cap("Безопасность: другой студент вставляет ссылку на чужую справку…");
    await login(page, "student2", false);
    await settle(page);
    await pause(page, 1000);
    await page.goto(`${BASE}/requests/${studyRequest}`);
    await page.getByRole("heading", { name: "Такой страницы нет" }).waitFor();
    cap("…и получает «Такой страницы нет»: чужие данные для него не существуют");
    await pause(page, 3500);
  });

  await browser.close();
  writeFileSync(join(OUT, "parts.json"), JSON.stringify(parts, null, 2));
  console.log(`Готово: ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
