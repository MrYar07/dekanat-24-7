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

test.describe("калькулятор «а если…»", () => {
  test("экзамен на 100 поднимает рейтинг, пересдача возвращает его обратно, сброс всё убирает", async ({ page }) => {
    await login(page, "student1");
    await page.goto("/grades");
    await page.getByRole("link", { name: "А если…" }).click();
    await expect(page).toHaveURL("/grades/what-if");

    const summary = page.getByLabel("Рейтинг в сценарии", { exact: true });
    await expect(summary).toContainText("рейтинг сейчас");
    const macro = page.getByRole("region", { name: "Макроэкономика" });
    await expect(macro).toContainText("91,5");

    // Ползунок управляется с клавиатуры: End — 100 баллов за экзамен.
    await macro.getByRole("slider", { name: "Экзамен" }).focus();
    await page.keyboard.press("End");
    // Сессия весит 45%: 100 вместо прогноза 90 — это +4,5 к дисциплине и +0,75 к рейтингу из шести дисциплин.
    await expect(macro).toContainText("было 91,5, +4,5");
    await expect(summary).toContainText(/\+0,[78]/);

    // Одна пересдача снимает 10 баллов: 100 превращается в 90, то есть в прежний прогноз.
    await macro.getByText("одна", { exact: true }).click();
    await expect(macro).toContainText("в зачёт пойдёт 90,0");
    await expect(summary).toContainText("±0,0");

    await page.getByRole("button", { name: "Сбросить" }).click();
    await expect(summary).toContainText("рейтинг сейчас");
    await expect(macro.getByText("одна", { exact: true })).toHaveCount(0);
  });

  test("слабый срез отнимает автомат по зачёту", async ({ page }) => {
    await login(page, "student1");
    await page.goto("/grades/what-if");
    const english = page.getByRole("region", { name: "Английский язык" });
    await expect(english).toContainText("автомат");

    await english.getByRole("slider", { name: "Срез 3" }).focus();
    await page.keyboard.press("Home");
    // Срезы 94, 91 и 0 — среднее 61,7: ниже 75, автомата нет, появляется ползунок зачёта с потолком.
    await expect(english).toContainText("Без автомата за зачёт ставят не больше 74.");
    await expect(english.getByRole("slider", { name: "Зачёт" })).toBeVisible();
  });
});

