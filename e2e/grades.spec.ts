import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe("из чего мой рейтинг", () => {
  test("разбор открывается из «Успеваемости» и сходится с рейтингом на ней", async ({ page }) => {
    await login(page, "student1");
    await page.goto("/grades");
    // Рейтинг на «Успеваемости» — крупное число в карточке рейтинга.
    const rating = (await page.getByLabel("Рейтинг", { exact: true }).locator("p.font-serif").first().textContent())!.trim();
    expect(rating).toMatch(/^\d{2,3},\d$/);

    await page.getByRole("link", { name: "Из чего он складывается" }).click();
    await expect(page).toHaveURL("/grades/rating");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Из чего мой рейтинг");

    // Итог разбора — то же число, что на «Успеваемости».
    await expect(page.getByLabel("Итог", { exact: true }).locator("dd").last()).toHaveText(rating);
    for (const step of ["Шаг 1. Балл каждой дисциплины", "Шаг 2. Средний балл", "Шаг 3. Бонус активности"]) {
      await expect(page.getByText(step)).toBeVisible();
    }
    // У каждой из шести дисциплин — три части и график срезов с подписью для экранного диктора.
    await expect(page.getByText(/^Работа в триместре · 40%$/)).toHaveCount(6);
    await expect(page.getByRole("img", { name: /^Макроэкономика: ср\. 1 — 86, ср\. 2 — 92$/ })).toBeVisible();
    await expect(page.getByRole("img", { name: /^Прогноз рейтинга по срезам/ })).toBeVisible();
  });
});
