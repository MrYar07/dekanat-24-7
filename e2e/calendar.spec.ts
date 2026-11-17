import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { login } from "./helpers";

// Свёрнутые строки .ics (продолжение начинается с пробела) склеиваем обратно, чтобы искать текст целиком.
const unfold = (ics: string) => ics.replace(/\r\n /g, "");

async function feedPath(page: Page) {
  const url = await page.getByLabel("Ссылка для подписки").inputValue();
  expect(url).toMatch(/\/calendar\/[A-Za-z0-9_-]{22}\.ics$/);
  return new URL(url).pathname;
}

// Календарь забирает ленту сам, без cookies: request-фикстура — чистый клиент без входа.
async function feed(request: APIRequestContext, path: string) {
  return request.get(path, { maxRedirects: 0 });
}

test.describe("расписание в календаре", () => {
  test("лента по ссылке без входа: пары, перенос и пометки, без имени студента", async ({ page, request }) => {
    await login(page, "student1");
    await page.goto("/schedule");
    await page.getByRole("link", { name: "В календарь на телефоне" }).click();
    await expect(page).toHaveURL("/schedule/calendar");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Расписание в календаре");
    await expect(page.getByRole("link", { name: "Подписаться" })).toHaveAttribute("href", /^webcal:\/\/.+\/calendar\/[A-Za-z0-9_-]{22}\.ics$/);

    const path = await feedPath(page);
    const res = await feed(request, path);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/calendar");
    const ics = unfold(await res.text());
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("X-WR-CALNAME:Расписание ГЭ-24-1 · Меридиан");
    expect(ics.match(/BEGIN:VEVENT/g)!.length).toBeGreaterThan(30);
    expect(ics).toContain("Эконометрика · ");
    expect(ics).toContain("Перенос: было");
    expect(ics).toContain("Преподаватель на методическом совещании");
    expect(ics).toMatch(/SUMMARY:Срез \d · /);
    // В ленте — расписание группы, но не сам студент.
    expect(ics).not.toContain("Северова");
    expect(ics).not.toContain("Алина");

    // «Скачать .ics» — тот же файл, но вложением.
    const download = await feed(request, `${path}?download`);
    expect(download.headers()["content-disposition"]).toContain("attachment");
  });

  test("у второго студента своя лента; после сброса старая ссылка — 404", async ({ page, request }) => {
    await login(page, "student2");
    await page.goto("/schedule/calendar");
    const before = await feedPath(page);
    const ics = unfold(await (await feed(request, before)).text());
    expect(ics).toContain("Расписание МП-23-2");
    expect(ics).not.toContain("ГЭ-24-1");
    expect(ics).toContain("SUMMARY:Отменено: Региональные конфликты");
    expect(ics).toContain("STATUS:CANCELLED");

    await page.getByRole("button", { name: "Сбросить ссылку" }).click();
    await page.getByRole("button", { name: "Да, сбросить" }).click();
    await expect(page.getByRole("region", { name: "Если ссылка ушла не туда" }).getByRole("status")).toContainText(
      "старая ссылка больше не работает",
    );
    await expect.poll(() => feedPath(page)).not.toBe(before);
    const after = await feedPath(page);

    expect((await feed(request, before)).status()).toBe(404);
    expect((await feed(request, after)).status()).toBe(200);
  });

  test("мусорная и неизвестная ссылка — 404, а не страница входа", async ({ request }) => {
    for (const path of ["/calendar/abc.ics", "/calendar/AbCdEfGhIjKlMnOpQrSt_-.ics", "/calendar/AbCdEfGhIjKlMnOpQrSt_-", "/calendar/..%2F..%2Fetc.ics"]) {
      expect((await feed(request, path)).status(), path).toBe(404);
    }
  });
});
