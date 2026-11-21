// Запись демо-видео для жюри: сценарий проходится в браузере автоматически, как e2e-тест.
// Каждая часть (телефон студентки, преподаватель, деканат…) пишется отдельно: кадры экрана — через
// screencast Chrome в полном разрешении. Рядом — parts.json: время кадров, подписи, нажатия и «наезды».
// Курсор, касания и наезды рисует монтаж (scripts/compose-demo.py), поэтому на самой странице ничего лишнего.
//
// Запуск: npm run build, затем SITE_URL=<адрес прода> npx next start -p 3100,
// затем npx tsx scripts/record-demo.ts <папка для роликов>. После записи — npm run db:seed:
// сценарий меняет локальную базу (справка, балл, объявление, вопрос в деканат).
// Пароль тестовых аккаунтов — из .env, в коде его нет.
import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium, type Locator, type Page } from "@playwright/test";
import { Pool } from "pg";

const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3100";
const OUT = resolve(process.argv[2] ?? "demo-video");
const ONLY = process.argv[3]?.split(",");
const PHONE = { width: 360, height: 780 };
const DESKTOP = { width: 1280, height: 720 };

type Box = { x: number; y: number; w: number; h: number };
type Caption = { at: number; text: string };
type Tap = Box & { at: number };
type Focus = Box & { from: number; to: number; zoom: number };
type Frame = { file: string; at: number };
type Part = {
  name: string;
  kind: "phone" | "desktop";
  scale: number;
  frames: Frame[];
  start: number;
  end: number;
  captions: Caption[];
  taps: Tap[];
  focus: Focus[];
};
// С фильтром частей (третий аргумент) остальные берутся из прошлой записи: можно переснять одну сцену.
const saved = join(OUT, "parts.json");
const parts: Part[] = ONLY && existsSync(saved) ? JSON.parse(readFileSync(saved, "utf8")) : [];
const ORDER = ["1-student", "2-certificate", "3-teacher", "4-dean", "5-student", "6-dean-answer", "7-student-answer", "8-a11y", "9-security"];
function save(p: Part) {
  const i = parts.findIndex((x) => x.name === p.name);
  if (i >= 0) parts[i] = p;
  else parts.push(p);
  parts.sort((a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name));
  writeFileSync(saved, JSON.stringify(parts, null, 2));
}

async function query<T>(text: string, values: unknown[] = []): Promise<T[]> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    return (await pool.query(text, values)).rows as T[];
  } finally {
    await pool.end();
  }
}

const pause = (page: Page, ms: number) => page.waitForTimeout(ms);

/** Что делает сцена: подписи, нажатия, наезды. Время — от начала записи части, в секундах. */
type Rec = {
  cap: (text: string) => void;
  start: () => void;
  tap: (target: Locator, wait?: number) => Promise<void>;
  type: (field: Locator, text: string, delay?: number) => Promise<void>;
  focusOn: (target: Locator, zoom?: number) => Promise<() => void>;
};

// Служебное, чего не должно быть в кадре: кнопка «Путеводитель» (она для жюри на сайте) и полосы прокрутки.
const CLEAN_CSS = `.float-layer.rounded-full{display:none!important}
html{scrollbar-width:none}::-webkit-scrollbar{display:none}`;

async function part(name: string, kind: Part["kind"], run: (page: Page, r: Rec) => Promise<void>) {
  if (ONLY && !ONLY.includes(name)) return;
  const size = kind === "phone" ? PHONE : DESKTOP;
  const scale = kind === "phone" ? 2 : 1.5;
  // Свой Chrome на каждую часть: без --force-device-scale-factor screencast отдаёт кадры в CSS-пикселях,
  // и телефон 360×780 на видео растягивается и мылится.
  const browser = await chromium.launch({ channel: "chrome", args: [`--force-device-scale-factor=${scale}`] });
  const context = await browser.newContext({
    viewport: size,
    deviceScaleFactor: scale,
    isMobile: kind === "phone",
    hasTouch: kind === "phone",
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    colorScheme: "light",
  });
  await context.addInitScript(`(() => {
    const add = () => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(CLEAN_CSS)}; document.head.appendChild(s); };
    if (document.head) add(); else document.addEventListener('DOMContentLoaded', add);
  })()`);
  const page = await context.newPage();
  const dir = join(OUT, name);
  mkdirSync(dir, { recursive: true });
  const t0 = Date.now() / 1000;
  const now = () => Date.now() / 1000 - t0;
  const frames: Frame[] = [];
  const cdp = await context.newCDPSession(page);
  cdp.on("Page.screencastFrame", (f) => {
    const file = join(dir, `${String(frames.length).padStart(5, "0")}.jpg`);
    writeFileSync(file, Buffer.from(f.data, "base64"));
    frames.push({ file, at: (f.metadata.timestamp ?? Date.now() / 1000) - t0 });
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  // Без maxWidth/maxHeight Chrome отдаёт кадры в CSS-пикселях (360×780), и телефон на видео мылится.
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 92,
    everyNthFrame: 1,
    maxWidth: size.width * scale,
    maxHeight: size.height * scale,
  });

  const captions: Caption[] = [];
  const taps: Tap[] = [];
  const focus: Focus[] = [];
  let start = 0;

  const box = async (target: Locator): Promise<Box> => {
    const b = await target.boundingBox();
    if (!b) throw new Error("Элемент не виден");
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  };
  const rec: Rec = {
    cap: (text) => captions.push({ at: now(), text }),
    start: () => {
      start = now();
    },
    // Курсор (или палец) на монтаже подъезжает к цели за ~0,7 с до нажатия, поэтому перед кликом пауза.
    tap: async (target, wait = 1100) => {
      await target.scrollIntoViewIfNeeded();
      await pause(page, 250);
      const b = await box(target);
      await pause(page, 750);
      taps.push({ ...b, at: now() });
      await target.click();
      await pause(page, wait);
    },
    type: async (field, text, delay = 70) => {
      await rec.tap(field, 250);
      await field.pressSequentially(text, { delay });
      await pause(page, 700);
    },
    // Наезд камеры на область (только на компьютере): возвращает функцию «отъехать».
    focusOn: async (target, zoom = 1.45) => {
      await target.scrollIntoViewIfNeeded();
      const b = await box(target);
      const f: Focus = { ...b, from: now(), to: now(), zoom };
      focus.push(f);
      await pause(page, 900);
      return () => {
        f.to = now();
      };
    },
  };

  await run(page, rec);
  await pause(page, 1500);
  const end = now();
  await cdp.send("Page.stopScreencast").catch(() => {});
  await context.close();
  await browser.close();
  save({ name, kind, scale, frames, start, end, captions, taps, focus });
  console.log(`${name}: ${(end - start).toFixed(0)} с в кадре, кадров ${frames.length}`);
}

async function login(page: Page, r: Rec | null, who: string) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Логин").waitFor();
  if (r) {
    await pause(page, 1400);
    await r.type(page.getByLabel("Логин"), who, 90);
    await r.tap(page.getByLabel("Пароль"), 200);
    await page.getByLabel("Пароль").pressSequentially(process.env.SEED_PASSWORD!, { delay: 60 });
    await pause(page, 500);
    await r.tap(page.getByRole("button", { name: "Войти" }), 300);
  } else {
    await page.getByLabel("Логин").fill(who);
    await page.getByLabel("Пароль").fill(process.env.SEED_PASSWORD!);
    await page.getByRole("button", { name: "Войти" }).click();
  }
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.waitForLoadState("networkidle");
}

async function settle(page: Page, ms = 1000) {
  await page.waitForLoadState("networkidle");
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  await pause(page, ms);
}

/** Плавная прокрутка: на видео видно, что ниже, и глаз успевает. */
async function scroll(page: Page, px: number, ms = 2600) {
  // Строкой, а не функцией: tsx добавляет в функции служебный __name, которого нет в браузере.
  await page.evaluate(`new Promise((done) => {
    const start = window.scrollY, t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ${ms});
      window.scrollTo(0, start + ${px} * (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2));
      if (k < 1) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  })`);
  await pause(page, 700);
}

const visible = (page: Page, name: string | RegExp) => page.getByRole("link", { name }).filter({ visible: true }).first();

async function main() {
  if (!process.env.SEED_PASSWORD) throw new Error("Нет SEED_PASSWORD в .env");
  mkdirSync(OUT, { recursive: true });
  const announcement = "Консультация перед третьим срезом";
  const question = "можно ли сдать курсовую позже";
  let studyRequest = "";

  // 1. Утро студентки: вход, «Сегодня», расписание, успеваемость.
  await part("1-student", "phone", async (page, r) => {
    r.cap("Вход по логину и паролю — как в любом кабинете вуза");
    await login(page, r, "student1");
    await settle(page, 600);
    r.cap("«Сегодня»: следующая пара, переносы и новые баллы — на одном экране");
    await pause(page, 3200);
    await scroll(page, 650, 3200);
    r.cap("Ниже — ведомость с рейтингом, статусы справок и объявления деканата");
    await pause(page, 1200);
    await scroll(page, 850, 3400);
    await pause(page, 1600);

    r.cap("Расписание на неделю: аудитория, преподаватель, переносы выделены");
    await r.tap(visible(page, "Расписание"));
    await settle(page);
    await pause(page, 1200);
    await scroll(page, 600, 3200);
    await pause(page, 1500);

    r.cap("Успеваемость: прогноз рейтинга триместра и что даёт каждый порог");
    await r.tap(visible(page, /Оценки|Успеваемость/));
    await settle(page);
    await pause(page, 2600);
    await scroll(page, 700, 3200);
    r.cap("Место на курсе — без фамилий и чужих баллов, только диапазоны");
    await pause(page, 2400);
    await scroll(page, 900, 3600);
    await pause(page, 1800);
  });

  // 2. Справка за минуту: вопрос своими словами → готовая форма → PDF с QR → проверка.
  await part("2-certificate", "phone", async (page, r) => {
    await login(page, null, "student1");
    await page.goto(`${BASE}/ask`);
    await settle(page, 600);
    r.start();
    r.cap("«Спроси деканат»: вопрос своими словами, без поиска нужного раздела");
    await pause(page, 1600);
    await r.type(page.getByLabel("Вопрос", { exact: true }), "нужна справка в военкомат");
    await r.tap(page.getByRole("button", { name: "Спросить" }));
    await settle(page);
    r.cap("Кабинет отвечает из данных студентки и сразу предлагает готовую форму");
    await pause(page, 3200);
    await r.tap(page.getByRole("link", { name: "Открыть заполненную форму" }));
    await settle(page);
    r.cap("Назначение уже выбрано — осталось нажать одну кнопку");
    await pause(page, 2600);
    await r.tap(page.getByRole("button", { name: "Сформировать PDF" }));
    await page.waitForURL(/\/requests\/[0-9a-f-]{36}/);
    await settle(page);
    studyRequest = page.url().match(/requests\/([0-9a-f-]{36})/)![1];
    r.cap("Справка готова за минуту: PDF с печатью и QR-кодом, без очереди");
    await pause(page, 3400);
    await scroll(page, 420, 2400);
    await pause(page, 1800);

    const [{ code }] = await query<{ code: string }>("select code from issued_documents where request_id = $1", [studyRequest]);
    r.cap("По QR-коду любой проверит подлинность — без входа и без лишних данных");
    await page.goto(`${BASE}/verify/${code}`);
    await settle(page);
    await pause(page, 4200);
  });

  // 3. Преподаватель: балл за срез — студент видит сразу.
  await part("3-teacher", "desktop", async (page, r) => {
    await login(page, null, "teacher");
    await settle(page, 500);
    r.start();
    r.cap("Кабинет преподавателя: свои курсы и группы, ничего лишнего");
    await pause(page, 2600);
    await r.tap(page.getByRole("link", { name: /ГЭ-24-1/ }).first());
    await settle(page);
    r.cap("Балл за срез — в одно поле, Enter переводит к следующему студенту");
    const field = page.getByLabel("Жукова Ева Дмитриевна, балл за срез 2");
    // Наезд на строку целиком — фамилия и поле балла вместе.
    const back = await r.focusOn(field.locator("xpath=ancestor::li[1]"), 1.3);
    await r.type(page.getByLabel("Жукова Ева Дмитриевна, балл за срез 2"), "81", 160);
    back();
    await pause(page, 600);
    r.cap("Сохранил — и студентка сразу получает уведомление, рейтинг пересчитан");
    await r.tap(page.getByRole("button", { name: "Сохранить срез 2" }), 2400);
    r.cap("Анонимные отзывы о преподавании: сводка — только от 5 ответов");
    await r.tap(page.getByRole("link", { name: "Отзывы" }));
    await settle(page);
    await pause(page, 2400);
    await scroll(page, 500, 2800);
    await pause(page, 1800);
  });

  // 4. Деканат: сводка и объявление группе.
  await part("4-dean", "desktop", async (page, r) => {
    await login(page, null, "dean");
    await page.goto(`${BASE}/staff/stats`);
    await settle(page, 600);
    r.start();
    r.cap("Деканат видит, сколько походов в деканат сэкономил кабинет");
    await pause(page, 3400);
    await scroll(page, 500, 3000);
    await pause(page, 1600);
    r.cap("Объявление группе — у студентов на главной и в уведомлениях");
    await r.tap(visible(page, "Объявления"));
    await settle(page);
    await page.getByLabel("Кому").selectOption({ label: "Группа ГЭ-24-1" });
    await pause(page, 700);
    const back = await r.focusOn(page.getByLabel("Заголовок"), 1.35);
    await r.type(page.getByLabel("Заголовок"), announcement, 45);
    await r.type(page.getByLabel("Текст"), "Четверг, 16:40, ауд. 218. Разберём задания прошлого года.", 30);
    back();
    await pause(page, 500);
    await r.tap(page.getByRole("button", { name: "Опубликовать" }), 2800);
  });

  // 5. Студентка: объявление уже на главной, вопрос сотруднику деканата.
  await part("5-student", "phone", async (page, r) => {
    await login(page, null, "student1");
    await settle(page, 600);
    r.start();
    r.cap("Объявление уже у студентки — без чатов, почты и пересылок");
    await pause(page, 1400);
    await scroll(page, 900, 3000);
    await pause(page, 1800);
    await r.tap(visible(page, /Уведомления/));
    await settle(page);
    await pause(page, 2400);

    r.cap("Чего нет в данных, кабинет не выдумывает — вопрос уходит человеку");
    await r.tap(visible(page, "Спроси деканат"));
    await settle(page);
    await r.type(page.getByLabel("Вопрос", { exact: true }), question, 60);
    await r.tap(page.getByRole("button", { name: "Спросить" }));
    await settle(page);
    await pause(page, 2200);
    await r.tap(page.getByRole("link", { name: "Написать в деканат" }));
    await settle(page);
    await page.getByLabel("Тема").selectOption("Учёба и оценки");
    await pause(page, 900);
    await r.tap(page.getByRole("button", { name: "Отправить в деканат" }));
    await page.waitForURL(/\/ask\/[0-9a-f-]{36}/);
    await settle(page);
    r.cap("Вопрос в очереди деканата, статус виден студентке");
    await pause(page, 3000);
  });

  // 6. Деканат отвечает: готовый ответ по теме вставляется одной кнопкой.
  await part("6-dean-answer", "desktop", async (page, r) => {
    await login(page, null, "dean");
    await settle(page, 600);
    r.start();
    r.cap("У деканата вопросы стоят в одной очереди с заявками на справки");
    await pause(page, 3400);
    await r.tap(page.getByRole("link", { name: new RegExp(question) }));
    await settle(page);
    r.cap("Готовые ответы на частые вопросы: вставить, поправить, отправить");
    const back = await r.focusOn(page.getByRole("group", { name: "Готовые ответы" }), 1.3);
    await r.tap(page.getByRole("group", { name: "Готовые ответы" }).getByRole("button").first(), 1800);
    back();
    await r.tap(page.getByRole("button", { name: "Ответить" }));
    await page.getByText("Ответ отправлен.").waitFor();
    await pause(page, 2600);
  });

  // 7. Ответ приходит студентке уведомлением.
  await part("7-student-answer", "phone", async (page, r) => {
    await login(page, null, "student1");
    await settle(page, 600);
    r.start();
    r.cap("Ответ приходит уведомлением — идти в деканат не нужно");
    await pause(page, 1200);
    await r.tap(visible(page, /Уведомления/));
    await settle(page);
    await pause(page, 1600);
    await r.tap(page.getByRole("link", { name: /Деканат ответил/ }).first());
    await settle(page);
    await pause(page, 3800);
  });

  // 8. Версия для слабовидящих.
  await part("8-a11y", "phone", async (page, r) => {
    await login(page, null, "student1");
    await settle(page, 600);
    r.start();
    r.cap("Версия для слабовидящих — одной кнопкой в шапке");
    await pause(page, 1400);
    await r.tap(page.getByRole("button", { name: "Версия для слабовидящих" }).filter({ visible: true }).first(), 1400);
    r.cap("Крупный шрифт, контрастные цвета, увеличенные интервалы");
    // Сами переключатели скрыты, нажимается подпись вокруг них.
    await r.tap(page.getByLabel("Шрифт очень крупный").locator("xpath=.."), 1200);
    await r.tap(page.getByLabel("Цвета: белым по чёрному").locator("xpath=.."), 1600);
    await r.tap(page.getByRole("button", { name: "Скрыть настройки" }), 1200);
    r.cap("Ничего не уезжает вбок даже на узком экране — проверено на 320 px");
    await scroll(page, 700, 3400);
    await pause(page, 2400);
  });

  // 9. Безопасность: другой студент открывает чужую справку по прямой ссылке.
  await part("9-security", "phone", async (page, r) => {
    if (!studyRequest) {
      const [row] = await query<{ id: string }>(
        "select d.request_id as id from issued_documents d join users u on u.id = d.student_id where u.login = 'student1' order by d.issued_at desc limit 1",
      );
      studyRequest = row.id;
    }
    await login(page, null, "student2");
    await settle(page, 600);
    r.start();
    r.cap("Безопасность: другой студент вставляет ссылку на чужую справку…");
    await pause(page, 1800);
    await page.goto(`${BASE}/requests/${studyRequest}`);
    await page.getByRole("heading", { name: "Такой страницы нет" }).waitFor();
    r.cap("…и видит «Такой страницы нет»: чужие данные для него не существуют");
    await pause(page, 4200);
  });

  console.log(`Готово: ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
