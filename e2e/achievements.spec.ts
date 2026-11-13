import { expect, test, type Page } from "@playwright/test";
import { login, query } from "./helpers";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1");
const ratingOf = async (page: Page) => {
  await page.goto("/grades");
  const text = (await page.getByLabel("Рейтинг", { exact: true }).locator("p.font-serif").first().textContent())!.trim();
  return Number(text.replace(",", "."));
};
const clean = (title: string) =>
  Promise.all([
    query("delete from achievements where title = $1", [title]),
    query("delete from notifications where href = '/grades#achievements-title' and body like $1", [`${title}%`]),
  ]);

test.describe("сценарий 6: достижение в рейтинг", () => {
  test("студент подаёт достижение с файлом, деканат начисляет баллы, рейтинг растёт", async ({ page, browser }) => {
    const title = `Призёр олимпиады по экономике (${Date.now()})`;
    try {
      await login(page, "student2");
      const before = await ratingOf(page);

      await page.getByRole("link", { name: "Добавить достижение" }).click();
      await expect(page).toHaveURL("/grades/achievements/new");
      await page.getByLabel("Вид достижения").selectOption({ label: "Призовое место на олимпиаде" });
      await expect(page.getByText("За это дают до 60 баллов")).toBeVisible();
      await page.getByLabel("Что за достижение").fill(title);

      // Без подтверждения заявка не уходит.
      await page.getByRole("button", { name: "Отправить в деканат" }).click();
      await expect(page.getByText("Нужно подтверждение: приложи файл или ссылку")).toBeVisible();

      // Страница с кодом под видом диплома: тип определяется по содержимому, а не по имени.
      const file = page.getByLabel("Файл", { exact: true });
      await file.setInputFiles({ name: "диплом.pdf", mimeType: "application/pdf", buffer: Buffer.from("<html><script>alert(1)</script>") });
      await page.getByRole("button", { name: "Отправить в деканат" }).click();
      await expect(page.getByText("Подойдёт PDF, JPG или PNG. Этот файл другого типа")).toBeVisible();
      // Поля после ошибки не сбросились.
      await expect(page.getByLabel("Что за достижение")).toHaveValue(title);

      await file.setInputFiles({ name: "диплом олимпиады.pdf", mimeType: "application/pdf", buffer: PDF });
      await page.getByRole("button", { name: "Отправить в деканат" }).click();
      await expect(page).toHaveURL(/\/grades\?sent=1/);
      await expect(page.getByText("Достижение отправлено.")).toBeVisible();
      const row = page.getByRole("listitem").filter({ hasText: title });
      await expect(row).toContainText("на проверке");
      // Пока деканат не решил, рейтинг прежний.
      expect(await ratingOf(page)).toBe(before);

      const [{ id }] = await query<{ id: string }>("select id from achievements where title = $1", [title]);
      const own = await page.request.get(`/grades/achievements/${id}/file`);
      expect(own.status()).toBe(200);
      expect(own.headers()["content-type"]).toBe("application/pdf");
      expect(Buffer.compare(await own.body(), PDF)).toBe(0);

      const dean = await (await browser.newContext()).newPage();
      await login(dean, "dean");
      await dean.getByRole("link", { name: new RegExp(title.replace(/[()]/g, "\\$&")) }).click();
      await expect(dean).toHaveURL(`/staff/achievements/${id}`);
      await expect(dean.getByText("Ветров Матвей Андреевич")).toBeVisible();
      await expect(dean.getByRole("link", { name: /диплом олимпиады\.pdf/ })).toHaveAttribute("href", `/staff/achievements/${id}/file`);
      expect((await dean.request.get(`/staff/achievements/${id}/file`)).headers()["content-type"]).toBe("application/pdf");

      // Отказ без причины и баллы сверх максимума вида не проходят.
      await dean.getByText("Отклонить", { exact: true }).click();
      await dean.getByRole("button", { name: "Отклонить достижение" }).click();
      await expect(dean.getByText("Нужна причина отказа")).toBeVisible();
      await dean.getByText("Засчитать", { exact: true }).click();
      await dean.getByLabel("Баллы").fill("61");
      await dean.getByRole("button", { name: "Засчитать баллы" }).click();
      await expect(dean.getByRole("alert").filter({ hasText: "от 1 до 60" })).toBeVisible();

      await dean.getByLabel("Баллы").fill("50");
      await expect(dean.getByText("В рейтинг студента пойдёт +2.")).toBeVisible();
      await dean.getByRole("button", { name: "Засчитать баллы" }).click();
      await expect(dean.getByText("Достижение засчитано.")).toBeVisible();
      await expect(dean.getByText("Решение принято и больше не меняется.")).toBeVisible();
      await dean.context().close();

      // 50 баллов × 0,04 = +2,0 к рейтингу.
      await page.goto("/notifications?kind=request");
      await expect(page.getByRole("link", { name: /Достижение засчитано: \+50/ }).first()).toContainText(title);
      const after = await ratingOf(page);
      expect(after - before).toBeCloseTo(2, 1);
      await expect(page.getByRole("listitem").filter({ hasText: title })).toContainText("+50");
    } finally {
      await clean(title);
    }
  });
});

test.describe("достижения: разделение доступа", () => {
  test("чужой файл — 404; карточка и файл деканата закрыты для студента и преподавателя", async ({ page, browser }) => {
    const title = `Чужое достижение (${Date.now()})`;
    const [{ id }] = await query<{ id: string }>(
      `insert into achievements (student_id, term_id, kind_id, title)
       select u.id, t.id, k.id, $1 from users u, terms t, achievement_kinds k
       where u.login = 'student2' and t.is_current and k.name = 'Организация мероприятия' returning id`,
      [title],
    );
    await query("insert into achievement_files (achievement_id, name, mime, size, data) values ($1, 'грамота.pdf', 'application/pdf', $2, $3)", [
      id,
      PDF.length,
      PDF,
    ]);
    try {
      await login(page, "student1");
      // Чужое достижение неотличимо от несуществующего.
      expect((await page.request.get(`/grades/achievements/${id}/file`)).status()).toBe(404);
      expect((await page.request.get("/grades/achievements/not-a-uuid/file")).status()).toBe(404);
      expect((await page.request.get("/grades/achievements/00000000-0000-4000-8000-000000000000/file")).status()).toBe(404);
      await page.goto("/grades");
      await expect(page.getByText(title)).toHaveCount(0);
      // В кабинет сотрудника студента не пускает: ни в карточку, ни к файлу.
      await page.goto(`/staff/achievements/${id}`);
      await expect(page).toHaveURL("/");
      const viaStaff = await page.request.get(`/staff/achievements/${id}/file`);
      expect(viaStaff.headers()["content-type"]).not.toBe("application/pdf");

      const teacher = await (await browser.newContext()).newPage();
      await login(teacher, "teacher");
      await teacher.goto(`/staff/achievements/${id}`);
      await expect(teacher).toHaveURL("/staff");
      await expect(teacher.getByText(title)).toHaveCount(0);
      expect((await teacher.request.get(`/staff/achievements/${id}/file`)).headers()["content-type"]).not.toBe("application/pdf");
      await teacher.context().close();

      const dean = await (await browser.newContext()).newPage();
      await login(dean, "dean");
      expect((await dean.goto("/staff/achievements/not-a-uuid"))?.status()).toBe(404);
      expect((await dean.request.get("/staff/achievements/00000000-0000-4000-8000-000000000000/file")).status()).toBe(404);
      // Хозяин файла — студент 2, но студенческий маршрут деканату не отдаёт ничего.
      expect((await dean.request.get(`/grades/achievements/${id}/file`)).headers()["content-type"]).not.toBe("application/pdf");
      await dean.context().close();
    } finally {
      await clean(title);
    }
  });
});
