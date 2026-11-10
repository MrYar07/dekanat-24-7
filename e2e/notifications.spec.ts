import { expect, test } from "@playwright/test";
import { login, query } from "./helpers";

/** Своё тестовое уведомление: тесты не зависят от того, что уже прочитано после прошлых прогонов. */
async function addNotification(login: string, title: string, href = "/grades") {
  const [row] = await query<{ id: string }>(
    `insert into notifications (user_id, kind, title, href) select id, 'score', $2, $3 from users where login = $1 returning id`,
    [login, title, href],
  );
  return row.id;
}

test.describe("уведомления: разделение данных", () => {
  test("чужое уведомление — 404 и остаётся непрочитанным, своё ведёт по ссылке и читается", async ({ page }) => {
    const mark = `e2e ${Date.now()}`;
    try {
      const foreign = await addNotification("student1", `${mark} чужое`);
      const own = await addNotification("student2", `${mark} своё`, "/requests");
      await login(page, "student2");

      const res = await page.request.get(`/notifications/${foreign}`, { maxRedirects: 0 });
      expect(res.status()).toBe(404);
      expect((await page.request.get("/notifications/not-a-uuid", { maxRedirects: 0 })).status()).toBe(404);
      const [still] = await query<{ read_at: Date | null }>("select read_at from notifications where id = $1", [foreign]);
      expect(still.read_at).toBeNull();

      const mine = await page.request.get(`/notifications/${own}`, { maxRedirects: 0 });
      expect(mine.status()).toBe(303);
      expect(mine.headers()["location"]).toBe("/requests");
      const [read] = await query<{ read_at: Date | null }>("select read_at from notifications where id = $1", [own]);
      expect(read.read_at).not.toBeNull();
    } finally {
      await query("delete from notifications where title like $1", [`${mark}%`]);
    }
  });
});

test.describe("уведомления: лента", () => {
  test("новое уведомление появляется без перезагрузки, «Прочитать все» обнуляет счётчик", async ({ page }) => {
    await login(page, "student1");
    await page.goto("/notifications");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Уведомления");
    // Метка в окне: если страница перезагрузится, она пропадёт.
    await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
    await page.goto("/");
    await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));

    const title = `Новый балл: тест ${Date.now()}`;
    try {
      await addNotification("student1", title);
      // Опрос идёт раз в 15 секунд и сразу при возвращении на вкладку — имитируем возвращение.
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      await expect(page.getByRole("status").getByText(title)).toBeVisible({ timeout: 20_000 });
      expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);

      await page.goto("/notifications");
      await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
      await page.getByRole("button", { name: "Прочитать все" }).click();
      await expect(page.getByText("Всё прочитано.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Прочитать все" })).toHaveCount(0);
    } finally {
      await query("delete from notifications where title = $1", [title]);
    }
  });

  test("фильтр по типу", async ({ page }) => {
    await login(page, "student2");
    await page.goto("/notifications?kind=announcement");
    await expect(page.getByRole("link", { name: "Объявления" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Модельная ООН")).toBeVisible();
    await expect(page.getByText("Отмена: Региональные конфликты")).toHaveCount(0);
  });
});
