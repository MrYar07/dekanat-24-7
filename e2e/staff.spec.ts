import { expect, test } from "@playwright/test";
import { login, query } from "./helpers";

test.describe("сценарий 3: справка с печатью", () => {
  test("деканат ведёт заявку до «готово», студент получает уведомление и видит комментарий", async ({ page, browser }) => {
    // Своя заявка: тест не зависит от того, что осталось после прошлых прогонов.
    const [req] = await query<{ id: string }>(
      `insert into requests (student_id, type_id, status, payload)
       select u.id, t.id, 'submitted', '{"period":"октябрь","copies":1}'::jsonb
       from users u, document_types t where u.login = 'student2' and t.code = 'scholarship' returning id`,
    );
    await query("insert into request_events (request_id, status) values ($1, 'submitted')", [req.id]);
    const note = `Забрать в каб. 214, печать уже стоит (${Date.now()})`;

    try {
      await login(page, "dean");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Заявки студентов");
      await page.goto(`/staff/requests/${req.id}`);
      await expect(page.getByText("Ветров Матвей Андреевич")).toBeVisible();

      // Отказ без причины не проходит.
      await page.getByText("Отклонить", { exact: true }).click();
      await page.getByRole("button", { name: "Отклонить заявку" }).click();
      await expect(page.getByText("Нужна причина отказа")).toBeVisible();

      await page.getByText("Взять в работу", { exact: true }).first().click();
      await page.getByRole("button", { name: "Взять в работу" }).click();
      await expect(page.getByText("Заявка взята в работу.")).toBeVisible();

      await page.getByLabel("Комментарий для студента").fill(note);
      await page.getByRole("button", { name: "Отметить готовым" }).click();
      await expect(page.getByText("Заявка отмечена готовой.")).toBeVisible();

      const student = await (await browser.newContext()).newPage();
      await login(student, "student2");
      await student.goto("/notifications?kind=request");
      await expect(student.getByRole("link", { name: /Готово: Справка о размере стипендии/ }).first()).toContainText(note);
      await student.goto(`/requests/${req.id}`);
      await expect(student.getByText(note)).toBeVisible();
      await student.context().close();
    } finally {
      await query("delete from notifications where href = $1", [`/requests/${req.id}`]);
      await query("delete from requests where id = $1", [req.id]);
    }
  });
});

test.describe("сценарий 4: живые оценки", () => {
  test("преподаватель ставит балл за срез, студент получает уведомление и автомат по зачёту", async ({ page, browser }) => {
    const clean = () =>
      query(
        `delete from checkpoint_scores where student_id = (select id from users where login = 'student2')
         and checkpoint_id in (select c.id from checkpoints c join courses k on k.id = c.course_id
           join disciplines d on d.id = k.discipline_id where d.name = 'Английский язык' and c.number = 3)`,
      );
    await clean();
    try {
      await login(page, "teacher");
      // teacher ведёт английский в группах обоих тестовых студентов.
      await expect(page.getByRole("link", { name: /Английский язык.*ГЭ-24-1/ })).toBeVisible();
      await page.getByRole("link", { name: /Английский язык.*МП-23-2/ }).click();
      await page.getByRole("link", { name: /Срез 3/ }).click();
      await expect(page).toHaveURL(/cp=3/);

      const field = page.getByLabel("Ветров Матвей Андреевич, балл за срез 3");
      await field.fill("101");
      await page.getByRole("button", { name: "Сохранить срез 3" }).click();
      await expect(page.getByRole("status")).toContainText("от 0 до 100");

      await field.fill("95");
      await page.getByRole("button", { name: "Сохранить срез 3" }).click();
      await expect(page.getByRole("status")).toContainText("Сохранено: 1 балл.");

      const student = await (await browser.newContext()).newPage();
      await login(student, "student2");
      await student.goto("/notifications?kind=score");
      await expect(student.getByRole("link", { name: /Новый балл: Английский язык/ }).first()).toContainText("Срез 3 — 95");
      // Срезы 76, 70 и 95 — в среднем больше 75: зачёт ставится автоматом.
      await student.goto("/grades");
      await expect(student.getByRole("region", { name: "Английский язык" })).toContainText("автомат");
      await student.context().close();
    } finally {
      await clean();
      await query("delete from notifications where title = 'Новый балл: Английский язык' and body = 'Срез 3 — 95'");
    }
  });
});

test.describe("кабинет сотрудника: разделение доступа", () => {
  test("чужой курс — 404; заявки деканата преподавателю недоступны", async ({ page }) => {
    const [foreign] = await query<{ id: string }>(
      `select c.id from courses c join users u on u.id = c.teacher_id where u.login <> 'teacher' limit 1`,
    );
    const [request] = await query<{ id: string }>("select id from requests limit 1");
    await login(page, "teacher");

    expect((await page.goto(`/staff/courses/${foreign.id}`))?.status()).toBe(404);
    expect((await page.goto("/staff/courses/not-a-uuid"))?.status()).toBe(404);

    // Карточка заявки — только для деканата: преподавателя возвращает на его главную.
    await page.goto(`/staff/requests/${request.id}`);
    await expect(page).toHaveURL("/staff");
    await expect(page.getByText("Заявки студентов")).toHaveCount(0);
  });

  test("студент в кабинет сотрудника не попадает, деканат — в журнал преподавателя", async ({ page, browser }) => {
    const [course] = await query<{ id: string }>(
      `select c.id from courses c join users u on u.id = c.teacher_id where u.login = 'teacher' limit 1`,
    );
    await login(page, "student1");
    await page.goto("/staff");
    await expect(page).toHaveURL("/");
    await page.goto(`/staff/courses/${course.id}`);
    await expect(page).toHaveURL("/");

    const dean = await (await browser.newContext()).newPage();
    await login(dean, "dean");
    await dean.goto(`/staff/courses/${course.id}`);
    await expect(dean).toHaveURL("/staff");
    await expect(dean.getByRole("heading", { level: 1 })).toHaveText("Заявки студентов");
    await dean.context().close();
  });
});
