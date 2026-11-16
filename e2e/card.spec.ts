import { expect, test } from "@playwright/test";
import { login, query } from "./helpers";

test.describe("электронный студенческий", () => {
  test("QR ведёт на проверку без входа: фамилия с инициалами, факультет, курс", async ({ page, browser }) => {
    await login(page, "student1");
    await page.goto("/profile");
    await page.getByRole("link", { name: /Электронный студенческий/ }).click();
    await expect(page).toHaveURL("/profile/card");
    const card = page.getByRole("region", { name: "Студенческий билет" });
    await expect(card).toContainText("Северова");
    await expect(card).toContainText("М-24-0417");
    const qr = card.getByRole("img", { name: "QR-код для проверки студенческого" });
    const url = (await qr.getAttribute("data-verify-url"))!;
    expect(url).toMatch(/\/verify\/student\/[A-Za-z0-9_-]{22}$/);

    // Проверяющий открывает ссылку из QR в чистом браузере, без входа.
    const guest = await browser.newPage();
    await guest.goto(new URL(url).pathname);
    await expect(guest.getByRole("heading", { level: 1 })).toHaveText("Студент «Меридиана»");
    await expect(guest.getByRole("img", { name: "Печать: действует" })).toBeVisible();
    await expect(guest.getByText("Северова А. И.")).toBeVisible();
    await expect(guest.getByText("Факультет глобальной экономики")).toBeVisible();
    // Ни имени полностью, ни номера зачётки на публичной странице.
    await expect(guest.getByText("Алина")).toHaveCount(0);
    await expect(guest.getByText("М-24-0417")).toHaveCount(0);
    await guest.close();
  });

  test("код устаревает через две минуты, мусор и неизвестный код — 404", async ({ page }) => {
    await login(page, "student2");
    await page.goto("/profile/card");
    const url = (await page.getByRole("img", { name: "QR-код для проверки студенческого" }).getAttribute("data-verify-url"))!;
    const token = url.split("/").pop()!;
    await query("update student_card_tokens set expires_at = now() - interval '1 second' where token = $1", [token]);

    await page.goto(`/verify/student/${token}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("QR-код устарел");
    await expect(page.getByText("Ветров")).toHaveCount(0);

    for (const bad of ["not-a-token", "A".repeat(22)]) {
      expect((await page.goto(`/verify/student/${bad}`))?.status(), bad).toBe(404);
    }
  });

  test("через минуту на экране новый код", async ({ page }) => {
    await page.clock.install();
    await login(page, "student1");
    await page.goto("/profile/card");
    const qr = page.getByRole("img", { name: "QR-код для проверки студенческого" });
    const first = await qr.getAttribute("data-verify-url");
    await expect(page.getByText(/^Код обновится через \d+ с$/)).toBeVisible();
    // С запасом: часы в браузере стартуют с момента установки, ещё до входа, а код выдан позже.
    await page.clock.fastForward(75_000);
    await expect(qr).not.toHaveAttribute("data-verify-url", first!);
  });
});
