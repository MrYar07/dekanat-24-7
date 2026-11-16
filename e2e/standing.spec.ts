import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe("место на курсе", () => {
  test("видно место и диапазоны, но ни фамилий, ни чужих баллов", async ({ page }) => {
    await login(page, "student1");
    await page.goto("/grades");
    const block = page.getByRole("region", { name: "Место на курсе" });
    await expect(block).toContainText(/\d+-е место/);
    await expect(block).toContainText("из 9 на 2-м курсе");

    // Диапазоны: студентов в сумме столько же, сколько на курсе, свой отмечен.
    const bins = block.getByRole("list", { name: "Сколько студентов в каждом диапазоне рейтинга" }).getByRole("listitem");
    const texts = await bins.allTextContents();
    const counted = texts.reduce((n, t) => n + Number(t.match(/: (\d+) студ/)![1]), 0);
    expect(counted).toBe(9);
    expect(texts.filter((t) => t.includes("ты здесь"))).toHaveLength(1);

    // Ни одной фамилии одногруппника на странице.
    for (const name of ["Абрамова", "Булатов", "Воронина", "Тарасов"]) {
      await expect(page.getByText(name)).toHaveCount(0);
    }
  });

  test("у второго студента — свой курс", async ({ page }) => {
    await login(page, "student2");
    await page.goto("/grades");
    await expect(page.getByRole("region", { name: "Место на курсе" })).toContainText("из 8 на 3-м курсе");
  });
});
