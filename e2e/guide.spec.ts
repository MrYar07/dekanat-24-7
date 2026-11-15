import { createHash, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { login, query, requestIdOf } from "./helpers";

test.describe("путеводитель для жюри", () => {
  test("сценарий 3: шаги передаются между студентом и деканатом без повторного входа", async ({ page }) => {
    await login(page, "student1");
    await page.getByRole("button", { name: /Путеводитель/ }).click();
    await page.getByRole("button", { name: /Справка с печатью/ }).click();

    // Первый шаг — за Матвеем: путеводитель предлагает стать им и сразу открывает нужную страницу.
    const bar = page.getByRole("region", { name: "Путеводитель: текущий шаг" });
    await expect(bar).toContainText("Сценарий 3 из 8 · шаг 1 из 3");
    await expect(bar).toContainText("Дальше — Матвей");
    await bar.getByRole("button", { name: "Продолжить как Матвей" }).click();
    await expect(page).toHaveURL("/requests/new/scholarship");
    await expect(bar).toContainText("Заказать справку о размере стипендии");

    await bar.getByRole("button", { name: "Дальше" }).click();
    await expect(bar).toContainText("шаг 2 из 3");
    await bar.getByRole("button", { name: "Продолжить как деканат" }).click();
    await expect(page).toHaveURL("/staff");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Заявки студентов");
    await expect(bar).toContainText("Новая заявка — внизу очереди");

    // Последний шаг: «Готово» отмечает сценарий пройденным и открывает список.
    await bar.getByRole("button", { name: "Дальше" }).click();
    await bar.getByRole("button", { name: "Продолжить как Матвей" }).click();
    await expect(page).toHaveURL("/notifications");
    await bar.getByRole("button", { name: "Готово" }).click();
    await expect(page.getByText("пройдено 1 из 8")).toBeVisible();
  });

  test("сценарий 7: та же страница заявки под другим студентом — «Такой страницы нет»", async ({ page }) => {
    const id = await requestIdOf("student1", "recredit");
    await login(page, "student1");
    await page.getByRole("button", { name: /Путеводитель/ }).click();
    await page.getByRole("button", { name: /Разделение данных/ }).click();
    const bar = page.getByRole("region", { name: "Путеводитель: текущий шаг" });
    await bar.getByRole("link", { name: "Открыть страницу" }).click();
    await expect(page).toHaveURL("/requests");
    await bar.getByRole("button", { name: "Дальше" }).click();

    // Пока заявка не открыта, переключаться не на чем.
    await expect(bar).toContainText("Сначала нужно открыть заявку Алины");
    await expect(bar.getByRole("button", { name: /Открыть эту страницу как/ })).toHaveCount(0);

    await page.goto(`/requests/${id}`);
    await bar.getByRole("button", { name: "Открыть эту страницу как Матвей" }).click();
    await expect(page).toHaveURL(`/requests/${id}`);
    await expect(page.getByRole("heading", { name: "Такой страницы нет" })).toBeVisible();
    await expect(bar).toContainText("Заявка Алины для Матвея не существует");
  });

  test("«Смотреть как» переключает роль, прогресс сохраняется", async ({ page }) => {
    await login(page, "dean");
    await page.getByRole("button", { name: /Путеводитель/ }).click();
    await page.getByRole("button", { name: /Преподаватель/ }).click();
    await expect(page).toHaveURL("/staff");
    await expect(page.getByRole("link", { name: /Английский язык.*МП-23-2/ })).toBeVisible();

    await page.getByRole("button", { name: /Путеводитель/ }).click();
    await page.getByRole("button", { name: /Алина/ }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("navigation", { name: "Разделы кабинета" })).toBeVisible();
  });

  test("после переключения на той же странице видны данные нового студента, а не прежнего", async ({ page }) => {
    await login(page, "student1");
    await page.goto("/grades");
    const rating = page.getByLabel("Рейтинг", { exact: true }).locator("[data-value]").first();
    const shown = rating.locator("[aria-hidden=true]").first();
    const alina = (await rating.getAttribute("data-value"))!;
    await expect(shown).toHaveText(alina);

    // Сценарий 4 начинается на «Успеваемости» Матвея: адрес тот же, человек другой.
    await page.getByRole("button", { name: /Путеводитель/ }).click();
    await page.getByRole("button", { name: /Живые оценки/ }).click();
    await page.getByRole("button", { name: "Продолжить как Матвей" }).click();
    await expect(page.getByRole("region", { name: "Путеводитель: текущий шаг" })).toContainText("Карточка «Английский язык»");
    const matvey = (await rating.getAttribute("data-value"))!;
    expect(matvey).not.toBe(alina);
    await expect(shown).toHaveText(matvey);
    // Разницы «с прошлого раза» нет: это другой человек, а не изменение рейтинга.
    await expect(rating).not.toContainText("▼");
  });

  test("не демо-аккаунту путеводитель и переключатель не показываются", async ({ browser }) => {
    // Сессия преподавателя, под которым нельзя войти по паролю: создаём её напрямую в базе.
    const token = randomBytes(32).toString("base64url");
    await query(
      `insert into sessions (token_hash, user_id, expires_at)
       select $1, id, now() + interval '5 minutes' from users where login = 't-lazareva'`,
      [createHash("sha256").update(token).digest("hex")],
    );
    const context = await browser.newContext();
    try {
      await context.addCookies([{ name: "d247_session", value: token, url: "http://localhost:3000" }]);
      const page = await context.newPage();
      await page.goto("/staff");
      await expect(page.getByRole("link", { name: /Макроэкономика/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /Путеводитель/ })).toHaveCount(0);
    } finally {
      await context.close();
      await query("delete from sessions where token_hash = $1", [createHash("sha256").update(token).digest("hex")]);
    }
  });
});

test.describe("оформление", () => {
  test("тема переключается кнопкой и сохраняется после перезагрузки", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/login");
    const html = page.locator("html");
    const paper = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(await paper()).toBe("rgb(247, 243, 234)");

    await page.getByRole("button", { name: "Сменить тему: светлая или тёмная" }).click();
    await expect(html).toHaveAttribute("data-theme", "dark");
    expect(await paper()).toBe("rgb(22, 20, 15)");
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "dark");

    // Выбор сильнее системной темы — в обе стороны.
    await page.emulateMedia({ colorScheme: "dark" });
    await page.getByRole("button", { name: "Сменить тему: светлая или тёмная" }).click();
    await expect(html).toHaveAttribute("data-theme", "light");
    expect(await paper()).toBe("rgb(247, 243, 234)");
  });

  test("«Как в системе» в профиле возвращает тему системы", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await login(page, "student2");
    await page.goto("/profile");
    await page.getByText("Светлая", { exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByText("Как в системе", { exact: true }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(22, 20, 15)");
  });

  test("манифест и значки открыты без входа", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest", { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    const manifest = await res.json();
    expect(manifest.display).toBe("standalone");
    for (const icon of manifest.icons) {
      const img = await request.get(icon.src, { maxRedirects: 0 });
      expect(img.status(), icon.src).toBe(200);
      expect(img.headers()["content-type"]).toBe("image/png");
    }
  });
});
