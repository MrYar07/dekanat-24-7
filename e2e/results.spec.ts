import { expect, test } from "@playwright/test";
import { login, query } from "./helpers";

// Активность и бонус: преподаватель выставляет, студент получает уведомление о бонусе, чужой курс — 404.

test.describe("активность и бонус", () => {
  test("бонус доходит до студента; неверная активность не сохраняется", async ({ page, browser }) => {
    const [course] = await query<{ id: string; discipline: string }>(
      `select c.id, d.name as discipline from courses c join users u on u.id = c.teacher_id join groups g on g.id = c.group_id
         join disciplines d on d.id = c.discipline_id join terms t on t.id = c.term_id
       where u.login = 'teacher' and g.name = 'ГЭ-24-1' and t.is_current`,
    );
    const [alina] = await query<{ id: string }>("select id from users where login = 'student1'");
    const [before] = await query<{ activity: number | null; bonus: number }>(
      "select activity, bonus from course_results where course_id = $1 and student_id = $2",
      [course.id, alina.id],
    );
    const started = new Date();
    try {
      await login(page, "teacher");
      await page.goto(`/staff/courses/${course.id}`);
      await page.getByRole("link", { name: "Активность и бонус" }).click();
      await expect(page).toHaveURL(`/staff/courses/${course.id}/results`);

      const row = page.getByRole("listitem").filter({ hasText: "Северова Алина Игоревна" });
      await row.getByLabel("Активность, 0–100").fill("150");
      await page.getByRole("button", { name: "Сохранить" }).click();
      await expect(page.getByRole("status")).toContainText("Активность — целое число от 0 до 100");

      await row.getByLabel("Активность, 0–100").fill("90");
      await row.getByText("+3", { exact: true }).click();
      await page.getByRole("button", { name: "Сохранить" }).click();
      await expect(page.getByRole("status")).toContainText("О бонусе студенту ушло уведомление");
      // После сохранения значения остались на месте.
      await expect(row.getByLabel("Активность, 0–100")).toHaveValue("90");

      const student = await (await browser.newContext()).newPage();
      await login(student, "student1");
      await student.goto("/notifications?kind=score");
      await expect(student.getByText(`Бонус за успехи: ${course.discipline}`).first()).toBeVisible();
      await student.context().close();
    } finally {
      await query("update course_results set activity = $3, bonus = $4 where course_id = $1 and student_id = $2", [
        course.id,
        alina.id,
        before?.activity ?? null,
        before?.bonus ?? 0,
      ]);
      await query("delete from notifications where user_id = $1 and title like 'Бонус за успехи:%' and created_at >= $2", [
        alina.id,
        started,
      ]);
    }
  });

  test("чужой курс — 404", async ({ page }) => {
    const [foreign] = await query<{ id: string }>(
      `select c.id from courses c join users u on u.id = c.teacher_id where u.login <> 'teacher' limit 1`,
    );
    await login(page, "teacher");
    expect((await page.goto(`/staff/courses/${foreign.id}/results`))?.status()).toBe(404);
    expect((await page.goto("/staff/courses/not-a-uuid/results"))?.status()).toBe(404);
  });
});
