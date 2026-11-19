import { expect, test } from "@playwright/test";
import { login, query } from "./helpers";

// «Написать в деканат»: вопрос студента → очередь деканата → ответ → уведомление студенту.
// Чужой вопрос неотличим от несуществующего; преподаватель и студент в карточку деканата не попадают.

const clean = (marker: string) => query("delete from questions where text like $1", [`%${marker}%`]);

async function questionIdOf(login: string, marker: string) {
  const [row] = await query<{ id: string }>(
    "select q.id from questions q join users u on u.id = q.student_id where u.login = $1 and q.text like $2",
    [login, `%${marker}%`],
  );
  return row?.id;
}

test.describe("вопрос в деканат", () => {
  test("студент спрашивает, деканат отвечает, ответ приходит уведомлением", async ({ page, browser }) => {
    const marker = `проверка-${Date.now()}`;
    try {
      await login(page, "student1");
      // Кабинет не понял вопрос — кнопка «Написать в деканат» переносит его текст в форму.
      const asked = `Можно ли сдать курсовую на неделю позже? ${marker}`;
      await page.goto(`/ask?q=${encodeURIComponent(asked)}`);
      await expect(page.getByText("Не понял вопрос")).toBeVisible();
      await page.getByRole("link", { name: "Написать в деканат" }).click();
      await expect(page.getByLabel("Вопрос", { exact: true })).toHaveValue(asked.slice(0, 1000));

      // Без темы не отправить: ошибка у поля, текст не теряется.
      await page.getByRole("button", { name: "Отправить в деканат" }).click();
      await expect(page.locator("#question-topic-error")).toHaveText("Выбери тему");
      await expect(page.getByLabel("Вопрос", { exact: true })).toHaveValue(asked);

      await page.getByLabel("Тема").selectOption("Учёба и оценки");
      await page.getByRole("button", { name: "Отправить в деканат" }).click();
      await expect(page).toHaveURL(/\/ask\/[0-9a-f-]{36}\?new=1$/);
      await expect(page.getByText("Вопрос отправлен.")).toBeVisible();
      await expect(page.getByText("ждёт ответа")).toBeVisible();
      const url = new URL(page.url()).pathname;

      const dean = await (await browser.newContext()).newPage();
      await login(dean, "dean");
      await dean.getByRole("link", { name: new RegExp(marker) }).click();
      await expect(dean.getByRole("heading", { level: 1 })).toHaveText("Учёба и оценки");
      await expect(dean.getByText("Северова Алина Игоревна")).toBeVisible();
      // Пустой ответ не уходит.
      await dean.getByRole("button", { name: "Ответить" }).click();
      await expect(dean.getByText("Нужен текст ответа")).toBeVisible();
      // Готовый ответ по теме стоит первым и встаёт в поле; дальше сотрудник пишет своё.
      const templates = dean.getByRole("group", { name: "Готовые ответы" }).getByRole("button");
      await expect(templates.first()).toHaveAccessibleName(/Решает преподаватель/);
      await templates.first().click();
      await expect(dean.getByLabel("Ответ студенту")).toHaveValue(/^Это решает преподаватель/);
      await expect(dean.getByLabel("Ответ студенту")).toBeFocused();
      await dean.getByLabel("Ответ студенту").fill("Можно, если преподаватель согласен. Напиши ему и приложи причину.");
      await dean.getByRole("button", { name: "Ответить" }).click();
      await expect(dean.getByText("Ответ отправлен.")).toBeVisible();
      await expect(dean.getByLabel("Ответ студенту")).toHaveCount(0);
      await dean.context().close();

      // Студент видит ответ и уведомление со ссылкой на вопрос.
      await page.goto("/notifications?kind=question");
      await page.getByRole("link", { name: /Деканат ответил: учёба и оценки/ }).first().click();
      await expect(page).toHaveURL(url);
      await expect(page.getByText("есть ответ")).toBeVisible();
      await expect(page.getByText("Можно, если преподаватель согласен.")).toBeVisible();
    } finally {
      await clean(marker);
    }
  });

  test("без ответа не больше трёх вопросов сразу", async ({ page }) => {
    const marker = `предел-${Date.now()}`;
    await query(
      `insert into questions (student_id, topic, text)
       select u.id, 'Другое', 'Вопрос для проверки предела ' || $1 || ' ' || n from users u, generate_series(1, 3) n where u.login = 'student1'`,
      [marker],
    );
    try {
      await login(page, "student1");
      await page.goto("/ask/new");
      await page.getByLabel("Тема").selectOption("Расписание");
      await page.getByLabel("Вопрос", { exact: true }).fill("Четвёртый вопрос подряд, пока нет ответов");
      await page.getByRole("button", { name: "Отправить в деканат" }).click();
      await expect(page.getByText("Вопросов без ответа: 3")).toBeVisible();
      await expect(page).toHaveURL("/ask/new");
    } finally {
      await clean(marker);
    }
  });

  test("чужой вопрос — 404; карточка деканата закрыта для студента и преподавателя", async ({ page, browser }) => {
    // В сиде у student2 есть вопрос без ответа.
    const foreign = await questionIdOf("student2", "справку об обучении на английском");
    expect(foreign, "перезапусти сид").toBeTruthy();

    await login(page, "student1");
    for (const path of [`/ask/${foreign}`, "/ask/not-a-uuid", "/ask/00000000-0000-4000-8000-000000000000"]) {
      expect((await page.goto(path))?.status(), path).toBe(404);
    }
    await page.goto("/ask");
    await expect(page.getByText("на английском")).toHaveCount(0);
    await page.goto(`/staff/questions/${foreign}`);
    await expect(page).toHaveURL("/");

    const teacher = await (await browser.newContext()).newPage();
    await login(teacher, "teacher");
    await teacher.goto(`/staff/questions/${foreign}`);
    await expect(teacher).toHaveURL("/staff");
    await expect(teacher.getByText("на английском")).toHaveCount(0);
    await teacher.context().close();

    const dean = await (await browser.newContext()).newPage();
    await login(dean, "dean");
    expect((await dean.goto("/staff/questions/not-a-uuid"))?.status()).toBe(404);
    expect((await dean.goto("/staff/questions/00000000-0000-4000-8000-000000000000"))?.status()).toBe(404);
    // Студенческая страница вопроса деканату ничего не отдаёт: кабинет студента уводит его к себе.
    await dean.goto(`/ask/${foreign}`);
    await expect(dean).toHaveURL("/staff");
    await dean.context().close();
  });
});
