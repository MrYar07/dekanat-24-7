import { expect, test } from "@playwright/test";
import { login, query } from "./helpers";

test.describe("путь к цели", () => {
  test("ход из плана проверяется калькулятором: с этим баллом цель есть, на балл меньше — нет", async ({ page }) => {
    await login(page, "student1");
    await page.goto("/grades");
    await page.getByRole("link", { name: "Путь к цели" }).click();
    await expect(page).toHaveURL("/grades/goal");

    // Ближайшая цель Алины — грант 25%: по среднему баллу не хватает меньше балла.
    const goal = page.getByRole("region", { name: "Цель", exact: true });
    await expect(goal).toContainText("Грант 25%");
    await expect(goal).toContainText("Не хватает");
    await expect(page.getByText(/на \d+ балл(а|ов)? выше/).first()).toBeVisible();

    // Берём ход «экзамен по международным финансам» и число из него.
    const move = page.getByRole("listitem").filter({ hasText: "Международные финансы: экзамен" });
    const need = Number((await move.textContent())!.match(/экзамен — (\d+) и больше/)![1]);
    expect(need).toBeGreaterThan(50);
    expect(need).toBeLessThanOrEqual(100);

    await page.getByRole("link", { name: "Проверить свой вариант в калькуляторе" }).click();
    await expect(page).toHaveURL("/grades/what-if");
    const summary = page.getByLabel("Рейтинг в сценарии", { exact: true });
    const exam = page.getByRole("region", { name: "Международные финансы" }).getByRole("slider", { name: "Экзамен" });
    await exam.focus();
    await page.keyboard.press("Home");
    for (let i = 0; i < need - 1; i++) await page.keyboard.press("ArrowRight");
    await expect(exam).toHaveValue(String(need - 1));
    await expect(summary).not.toContainText("грант 25%");
    await page.keyboard.press("ArrowRight");
    await expect(exam).toHaveValue(String(need));
    await expect(summary).toContainText("Хватит на: грант 25%");
  });

  test("достигнутая цель показывает запас, далёкая — что одного хода не хватит", async ({ page, browser }) => {
    await login(page, "student1");
    await page.goto("/grades/goal?goal=scholarship");
    const goal = page.getByRole("region", { name: "Цель", exact: true });
    await expect(goal).toContainText("Повышенная стипендия");
    await expect(goal).toContainText("есть");
    await expect(goal).toContainText("Запас");
    await expect(page.getByText("Как не потерять")).toBeVisible();
    await expect(page.getByText("Или один сильный ход")).toHaveCount(0);

    const other = await (await browser.newContext()).newPage();
    await login(other, "student2");
    await other.goto("/grades/goal");
    await expect(other.getByRole("region", { name: "Цель", exact: true })).toContainText("Повышенная стипендия");
    await expect(other.getByText("Одного хода не хватит")).toBeVisible();
    // Гранты — только для платной формы: у Матвея таких целей нет.
    await expect(other.getByRole("link", { name: /Грант/ })).toHaveCount(0);
    await other.context().close();
  });
});

test.describe("светофор по дисциплинам", () => {
  test("дисциплина на грани оценки помечена, причина написана словами", async ({ page }) => {
    await login(page, "student2");
    await page.goto("/grades");
    // Посещаемость в демо считается по прошедшим дням недели, поэтому точные десятые меняются от понедельника к пятнице.
    await expect(page.getByText(/^Внимания требу(ет|ют) \d из 6/)).toBeVisible();
    const english = page.getByRole("region", { name: "Английский язык" });
    await expect(english).toContainText("обрати внимание");
    await expect(english).toContainText(/До «удовлетворительно» всего 0,\d балла/);
    await expect(page.getByRole("region", { name: "Региональные конфликты" })).toContainText("спокойно");
  });
});

test.describe("сводка деканата", () => {
  test("число сэкономленных походов сходится с базой", async ({ page }) => {
    const [{ instant }] = await query<{ instant: string }>("select count(*) as instant from issued_documents");
    const [{ closed }] = await query<{ closed: string }>(
      `select count(*) as closed from requests r join document_types t on t.id = r.type_id
       where not t.instant and r.status in ('ready', 'issued')`,
    );
    const saved = Number(instant) * 3 + Number(closed) * 2;

    await login(page, "dean");
    const link = page.getByRole("link", { name: /Походов в деканат не понадобилось/ });
    await expect(link).toContainText(String(saved));
    await link.click();
    await expect(page).toHaveURL("/staff/stats");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Сводка");
    const tiles = page.getByRole("region", { name: "Главные числа" });
    await expect(tiles).toContainText(`Походов в деканат не понадобилось${saved}`);
    await expect(tiles).toContainText(`Справок выдано сразу${Number(instant)}`);
    await expect(page.getByRole("list", { name: "Заявки по видам документов" }).getByRole("listitem").first()).toBeVisible();
  });

  test("сводка закрыта для преподавателя и студента", async ({ page, browser }) => {
    await login(page, "teacher");
    await page.goto("/staff/stats");
    await expect(page).toHaveURL("/staff");
    await expect(page.getByRole("heading", { name: "Сводка" })).toHaveCount(0);

    const student = await (await browser.newContext()).newPage();
    await login(student, "student1");
    await student.goto("/staff/stats");
    await expect(student).toHaveURL("/");
    await student.context().close();
  });
});
