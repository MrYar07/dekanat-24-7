import { expect, test } from "@playwright/test";
import { login, query } from "./helpers";

// Оценка преподавания: студент отвечает анонимно один раз, преподаватель видит сводку только от 5 ответов.

const courseOf = async (group: string) => {
  const [c] = await query<{ id: string }>(
    `select c.id from courses c join users u on u.id = c.teacher_id join groups g on g.id = c.group_id
       join terms t on t.id = c.term_id
     where u.login = 'teacher' and g.name = $1 and t.is_current`,
    [group],
  );
  return c.id;
};

test.describe("оценка преподавания", () => {
  test("студент оценивает курс, преподаватель видит ответ в сводке, второй раз ответить нельзя", async ({ page, browser }) => {
    const course = await courseOf("ГЭ-24-1");
    const [alina] = await query<{ id: string }>("select id from users where login = 'student1'");
    const comment = `Проверка отзыва ${Date.now()}`;
    try {
      await login(page, "student1");
      await page.goto("/grades");
      await page.getByRole("link", { name: "Оценить курсы триместра" }).click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Оценка преподавания");
      await page.locator(`a[href="/grades/feedback/${course}"]`).click();

      // Без оценок форма не уходит.
      await page.getByRole("button", { name: "Отправить анонимно" }).click();
      await expect(page.getByText("Выбери оценку от 1 до 5")).toHaveCount(3);

      for (const [question, score] of [["Понятно объясняет", "5"], ["Занятия полезны", "4"], ["Справедливо оценивает", "5"]]) {
        await page.getByRole("group", { name: question }).getByText(score, { exact: true }).click();
      }
      await page.getByLabel(/Что стоит сохранить или изменить/).fill(comment);
      await page.getByRole("button", { name: "Отправить анонимно" }).click();
      await expect(page).toHaveURL("/grades/feedback?thanks=1");
      await expect(page.getByText("Спасибо, ответ сохранён.")).toBeVisible();
      await expect(page.locator(`a[href="/grades/feedback/${course}"]`)).toHaveCount(0);

      // Повторно — только «уже оценил».
      await page.goto(`/grades/feedback/${course}`);
      await expect(page.getByText("Ты уже оценил этот курс")).toBeVisible();
      await expect(page.getByRole("button", { name: "Отправить анонимно" })).toHaveCount(0);

      const teacher = await (await browser.newContext()).newPage();
      await login(teacher, "teacher");
      await teacher.goto(`/staff/courses/${course}`);
      await teacher.getByRole("link", { name: "Отзывы", exact: true }).click();
      await expect(teacher.getByRole("heading", { name: /7 ответов из \d+/ })).toBeVisible();
      await expect(teacher.getByText(comment)).toBeVisible();
      // Ни имени, ни логина автора на странице нет.
      await expect(teacher.getByText("Северова")).toHaveCount(0);
      await teacher.context().close();
    } finally {
      await query("delete from course_feedback where comment = $1", [comment]);
      await query("delete from course_feedback_votes where course_id = $1 and student_id = $2", [course, alina.id]);
    }
  });

  test("меньше 5 ответов — сводка скрыта", async ({ page }) => {
    const course = await courseOf("МП-23-2");
    await login(page, "teacher");
    await page.goto(`/staff/courses/${course}/feedback`);
    await expect(page.getByText(/Пока 3 ответа из \d+/)).toBeVisible();
    await expect(page.getByText("из 5")).toHaveCount(0);
    await expect(page.getByText("Спасибо за быстрые ответы на почту.")).toHaveCount(0);
  });

  test("чужой курс — 404 и для студента, и для преподавателя", async ({ page, browser }) => {
    const ge = await courseOf("ГЭ-24-1");
    const [foreign] = await query<{ id: string }>(
      `select c.id from courses c join users u on u.id = c.teacher_id where u.login <> 'teacher' limit 1`,
    );
    // student2 из МП-23-2 открывает курс группы ГЭ-24-1.
    await login(page, "student2");
    expect((await page.goto(`/grades/feedback/${ge}`))?.status()).toBe(404);
    expect((await page.goto("/grades/feedback/not-a-uuid"))?.status()).toBe(404);

    const teacher = await (await browser.newContext()).newPage();
    await login(teacher, "teacher");
    expect((await teacher.goto(`/staff/courses/${foreign.id}/feedback`))?.status()).toBe(404);
    await teacher.context().close();
  });
});
