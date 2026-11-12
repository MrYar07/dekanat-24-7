import { expect, test } from "@playwright/test";
import { login, query } from "./helpers";

/** Ближайшая дата с нужным днём недели (1 — понедельник), не раньше завтра по Москве. */
function nextWeekday(weekday: number) {
  const day = 24 * 3_600_000;
  let t = Date.now() + 3 * 3_600_000 + day;
  while (((new Date(t).getUTCDay() + 6) % 7) + 1 !== weekday) t += day;
  return new Date(t).toISOString().slice(0, 10);
}

test.describe("деканат: объявления", () => {
  test("объявление для группы видят её студенты и не видят другие", async ({ page, browser }) => {
    const title = `Проверка объявления ${Date.now()}`;
    try {
      await login(page, "dean");
      await page.getByRole("link", { name: "Объявления" }).click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Объявления");

      // Пустая форма не публикуется.
      await page.getByRole("button", { name: "Опубликовать" }).click();
      await expect(page.getByText("Нужен заголовок")).toBeVisible();

      await page.getByLabel("Кому").selectOption({ label: "Группа МП-23-2" });
      await page.getByLabel("Заголовок").fill(title);
      await page.getByLabel("Текст").fill("Сбор в ауд. 101 в 16:40.");
      await page.getByRole("button", { name: "Опубликовать" }).click();
      await expect(page.getByRole("status")).toContainText("Уведомление получили 8 студентов");
      await expect(page.getByLabel("Опубликованные").getByText(title)).toBeVisible();
      // После публикации форма пустая.
      await expect(page.getByLabel("Заголовок")).toHaveValue("");

      const inGroup = await (await browser.newContext()).newPage();
      await login(inGroup, "student2");
      await expect(inGroup.getByText(title)).toBeVisible();
      await inGroup.goto("/notifications?kind=announcement");
      await expect(inGroup.getByRole("link", { name: new RegExp(title) })).toBeVisible();
      await inGroup.context().close();

      const outside = await (await browser.newContext()).newPage();
      await login(outside, "student1");
      await expect(outside.getByText(title)).toHaveCount(0);
      await outside.goto("/notifications?kind=announcement");
      await expect(outside.getByText(title)).toHaveCount(0);
      await outside.context().close();
    } finally {
      await query("delete from notifications where title = $1", [title]);
      await query("delete from announcements where title = $1", [title]);
    }
  });
});

test.describe("деканат: изменения расписания", () => {
  test("отмена пары доходит до группы; перенос на занятое время не проходит; пару можно вернуть", async ({ page, browser }) => {
    const started = new Date();
    const date = nextWeekday(3); // среда: у ГЭ-24-1 «Макроэкономика» в 09:30 и «Право ВТО» в 11:10
    const [group] = await query<{ id: string }>("select id from groups where name = 'ГЭ-24-1'");
    const reason = `преподаватель на конференции (${Date.now()})`;
    const clean = async () => {
      await query(
        `delete from lesson_changes where date = $1 and slot_id in (
           select s.id from timetable_slots s join courses c on c.id = s.course_id
           join disciplines d on d.id = c.discipline_id where d.name = 'Макроэкономика' and c.group_id = $2)`,
        [date, group.id],
      );
      await query("delete from notifications where kind = 'change' and created_at >= $1 and title like '%Макроэкономика'", [started]);
    };
    await clean();

    try {
      await login(page, "dean");
      await page.goto(`/staff/schedule?group=${group.id}&date=${date}`);
      const lesson = page.getByRole("listitem").filter({ hasText: "Макроэкономика" });
      await expect(lesson).toBeVisible();

      // Перенос на время, когда у группы «Право ВТО».
      await lesson.getByText("Изменить пару").click();
      await lesson.getByLabel("Время").selectOption("11:10");
      await lesson.getByRole("button", { name: "Перенести пару" }).click();
      await expect(lesson.getByRole("status")).toContainText("В это время у группы уже пара: Право ВТО");

      await lesson.getByText("Отменить", { exact: true }).click();
      await lesson.getByLabel("Причина (увидят студенты)").fill(reason);
      await lesson.getByRole("button", { name: "Отменить пару" }).click();
      await expect(lesson.getByRole("status").first()).toContainText("Уведомление получили 9 студентов");
      await expect(lesson.getByText("отмена", { exact: true })).toBeVisible();

      const student = await (await browser.newContext()).newPage();
      await login(student, "student1");
      await student.goto("/notifications?kind=change");
      const note = student.getByRole("link", { name: /Отмена: Макроэкономика/ }).first();
      await expect(note).toContainText(reason);
      // Уведомление ведёт на нужную неделю расписания, где пара помечена отменённой.
      await note.click();
      await expect(student).toHaveURL(/\/schedule\?week=\d+$/);
      await expect(student.getByText(reason)).toBeVisible();
      await student.context().close();

      await lesson.getByRole("button", { name: "Вернуть по расписанию" }).click();
      await expect(lesson.getByText("отмена", { exact: true })).toHaveCount(0);
      const [left] = await query<{ n: string }>(
        `select count(*) n from lesson_changes lc join timetable_slots s on s.id = lc.slot_id
         join courses c on c.id = s.course_id join disciplines d on d.id = c.discipline_id
         where lc.date = $1 and d.name = 'Макроэкономика' and c.group_id = $2`,
        [date, group.id],
      );
      expect(Number(left.n)).toBe(0);
    } finally {
      await clean();
    }
  });

  test("преподавателю разделы деканата недоступны", async ({ page }) => {
    await login(page, "teacher");
    await expect(page.getByRole("link", { name: "Объявления" })).toHaveCount(0);
    for (const path of ["/staff/announcements", "/staff/schedule"]) {
      await page.goto(path);
      await expect(page).toHaveURL("/staff");
    }
  });
});
