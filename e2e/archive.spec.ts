import { expect, test } from "@playwright/test";
import { login, query } from "./helpers";

/** id триместров по учебному году и номеру. */
async function termId(academicYear: string, number: number) {
  const [row] = await query<{ id: string }>("select id from terms where academic_year = $1 and number = $2", [academicYear, number]);
  if (!row) throw new Error(`Нет триместра ${number} ${academicYear}: перезапусти сид`);
  return row.id;
}

async function currentTerm() {
  const [row] = await query<{ id: string; academic_year: string }>("select id, academic_year from terms where is_current");
  return row;
}

/** Прошлый учебный год относительно текущего: «2026/27» → «2025/26». */
const yearBefore = (y: string, back = 1) => {
  const start = Number(y.slice(0, 4)) - back;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
};

test.describe("архив и годовой рейтинг", () => {
  test("Алина: прошлый год закрыт, до гранта не хватило; триместр открывается с разбором", async ({ page }) => {
    const { academic_year: current } = await currentTerm();
    const last = yearBefore(current);
    await login(page, "student1");
    await page.goto("/grades");
    await page.getByRole("link", { name: "Архив и годовой рейтинг" }).click();
    await expect(page).toHaveURL("/grades/archive");

    const year = page.getByRole("region", { name: new RegExp(`^${last.replace("/", "\\/")} учебный год`) });
    await expect(year.getByLabel(`Годовой рейтинг ${last}`)).toHaveText("89,6");
    await expect(year).toContainText("Год закрыт, рейтинг итоговый.");
    await expect(year).toContainText("До порога «грант 25%» (90) не хватило 0,4.");
    await expect(year.getByRole("img", { name: /^Средний балл по триместрам/ })).toBeVisible();

    // Текущий год — прогноз, его триместр ведёт на «Успеваемость».
    const now = page.getByRole("region", { name: new RegExp(`^${current.replace("/", "\\/")} учебный год`) });
    await expect(now).toContainText("Годовой рейтинг, прогноз");
    await expect(now.getByText("идёт, прогноз")).toBeVisible();

    await year.getByRole("link", { name: /^1-й триместр/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("1-й триместр");
    await expect(page.getByText(`${last} учебный год · триместр закрыт`)).toBeVisible();
    await expect(page.getByRole("region", { name: "Микроэкономика" })).toContainText("Сессия · 45%");
    await expect(page.getByText("Помощь в проведении Дня первокурсника")).toBeVisible();
  });

  test("Матвей: два года, пересдача снимает 10 баллов и закрывает стипендию", async ({ page }) => {
    const { academic_year: current } = await currentTerm();
    const last = yearBefore(current);
    await login(page, "student2");
    await page.goto("/grades/archive");
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(3);
    await expect(page.getByText(`${yearBefore(current, 2)} учебный год · 1-й курс`)).toBeVisible();

    const year = page.getByRole("region", { name: new RegExp(`^${last.replace("/", "\\/")} учебный год`) });
    await expect(year.getByText("пересдача", { exact: true })).toBeVisible();
    await year.getByRole("link", { name: /^2-й триместр/ }).click();

    const course = page.getByRole("region", { name: "Дипломатическая служба" });
    await expect(course).toContainText("экзамен: 74 − 10 за пересдачу");
    await expect(page.getByText("была пересдача")).toBeVisible();
  });

  test("чужой триместр — 404, текущий — на «Успеваемость»", async ({ page }) => {
    const { id: currentId, academic_year: current } = await currentTerm();
    // Два года назад училась только группа Матвея: у Алины тогда дисциплин не было.
    const foreign = await termId(yearBefore(current, 2), 1);
    await login(page, "student1");
    for (const path of [`/grades/archive/${foreign}`, "/grades/archive/00000000-0000-4000-8000-000000000000", "/grades/archive/not-a-uuid"]) {
      expect((await page.goto(path))?.status(), path).toBe(404);
    }
    await page.goto(`/grades/archive/${currentId}`);
    await expect(page).toHaveURL("/grades");
  });

  test("журнал прошлого триместра закрыт для преподавателя: оценки итоговые", async ({ page }) => {
    const [past] = await query<{ id: string }>(
      `select c.id from courses c join users u on u.id = c.teacher_id join terms t on t.id = c.term_id
       where u.login = 'teacher' and not t.is_current limit 1`,
    );
    expect(past, "у teacher должен быть курс в архиве").toBeTruthy();
    await login(page, "teacher");
    expect((await page.goto(`/staff/courses/${past.id}`))?.status()).toBe(404);
  });
});
