import { expect, test } from "@playwright/test";
import { login, query } from "./helpers";

// Посещаемость у преподавателя: отметка доходит до студента, чужой курс — 404,
// отметить можно только пару, которая уже началась.

test.describe("посещаемость у преподавателя", () => {
  test("пропуск на последней паре: уведомление студенту, потом отметку можно вернуть", async ({ page, browser }) => {
    const [course] = await query<{ id: string; discipline: string }>(
      `select c.id, d.name as discipline from courses c
         join users u on u.id = c.teacher_id join groups g on g.id = c.group_id
         join disciplines d on d.id = c.discipline_id join terms t on t.id = c.term_id
       where u.login = 'teacher' and g.name = 'ГЭ-24-1' and t.is_current`,
    );
    const [alina] = await query<{ id: string }>("select id from users where login = 'student1'");

    await login(page, "teacher");
    await page.goto("/staff");
    await page.locator(`a[href="/staff/courses/${course.id}/attendance"]`).click();
    await expect(page).toHaveURL(`/staff/courses/${course.id}/attendance`);
    await expect(page.getByRole("link", { name: "Посещаемость", exact: true })).toHaveAttribute("aria-current", "page");
    const lessonChip = page.getByRole("navigation", { name: "Пара" }).locator('[aria-current="page"]');
    await expect(lessonChip).toContainText("Последняя");
    // Пара из ссылки активного чипа: «2026-11-18.<id слота>».
    const lessonHref = (await lessonChip.getAttribute("href"))!;
    const [lessonDate, lessonSlot] = new URL(lessonHref, page.url()).searchParams.get("lesson")!.split(".");

    // Какая отметка стояла у Алины — чтобы вернуть её в конце.
    const row = page.getByRole("listitem").filter({ hasText: "Северова Алина Игоревна" });
    const group = row.getByRole("group", { name: "Северова Алина Игоревна" });
    const before = await group.locator("input:checked").getAttribute("value").catch(() => null);

    await group.getByText("пропуск", { exact: true }).click();
    await page.getByRole("button", { name: "Сохранить отметки" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Сохранено" })).toContainText("уведомление о пропуске");

    const student = await (await browser.newContext()).newPage();
    await login(student, "student1");
    await student.goto("/notifications");
    await expect(student.getByText(`Пропуск: ${course.discipline}`).first()).toBeVisible();
    await student.context().close();

    // Вернуть как было: «Остальные были» не трогает уже отмеченных, поэтому ставим явно.
    await page.goto(lessonHref);
    if (before) {
      const label = { present: "был", absent: "пропуск", excused: "уважит." }[before as "present"]!;
      await group.getByText(label, { exact: true }).click();
      await page.getByRole("button", { name: "Сохранить отметки" }).click();
      await expect(page.getByRole("status").filter({ hasText: /Сохранено|Изменений нет/ })).toBeVisible();
    } else {
      await query("delete from attendance where student_id = $1 and slot_id = $2 and date = $3", [alina.id, lessonSlot, lessonDate]);
    }
  });

  test("«Остальные были» отмечает только тех, у кого нет отметки", async ({ page }) => {
    const [course] = await query<{ id: string }>(
      `select c.id from courses c join users u on u.id = c.teacher_id join terms t on t.id = c.term_id
       where u.login = 'teacher' and t.is_current limit 1`,
    );
    await login(page, "teacher");
    await page.goto(`/staff/courses/${course.id}/attendance`);
    const rows = page.getByRole("list").last().getByRole("listitem");
    const first = rows.first().getByRole("group");
    await first.getByText("уважит.", { exact: true }).click();
    const all = page.getByRole("button", { name: "Остальные были" });
    if (await all.isEnabled()) await all.click();
    await expect(page.getByText("Отмечены все")).toBeVisible();
    // Отметка, поставленная руками, осталась.
    await expect(first.locator("input:checked")).toHaveAttribute("value", "excused");
    // Ничего не сохраняем: уходим со страницы, база не меняется.
  });

  test("чужой курс — 404, мусорная или будущая пара — показывается последняя", async ({ page }) => {
    const [foreign] = await query<{ id: string }>(
      `select c.id from courses c join users u on u.id = c.teacher_id where u.login <> 'teacher' limit 1`,
    );
    const [own] = await query<{ id: string; slot: string }>(
      `select c.id, s.id as slot from courses c join users u on u.id = c.teacher_id join terms t on t.id = c.term_id
         join timetable_slots s on s.course_id = c.id
       where u.login = 'teacher' and t.is_current limit 1`,
    );
    await login(page, "teacher");
    expect((await page.goto(`/staff/courses/${foreign.id}/attendance`))?.status()).toBe(404);
    expect((await page.goto("/staff/courses/not-a-uuid/attendance"))?.status()).toBe(404);

    for (const lesson of ["мусор", `2099-01-05.${own.slot}`]) {
      await page.goto(`/staff/courses/${own.id}/attendance?lesson=${encodeURIComponent(lesson)}`);
      await expect(page.getByRole("navigation", { name: "Пара" }).locator('[aria-current="page"]')).toContainText("Последняя");
    }
  });
});
