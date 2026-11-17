import { expect, test } from "@playwright/test";
import { login } from "./helpers";

// «Спроси деканат»: вопрос своими словами ведёт к ответу из своих данных или к заполненной форме.
// Чужих id в адресе здесь нет: страница показывает только данные вошедшего студента.

const ask = async (page: import("@playwright/test").Page, q: string) => {
  await page.getByRole("searchbox", { name: "Вопрос" }).fill(q);
  await page.getByRole("button", { name: "Спросить" }).click();
  await expect(page).toHaveURL(/\/ask\?q=/);
};

test.describe("спроси деканат", () => {
  test("справка в военкомат открывает форму с выбранным назначением", async ({ page }) => {
    await login(page, "student1");
    await page.goto("/ask");
    await ask(page, "нужна справка в военкомат");
    const answer = page.getByRole("region", { name: "Ответ" });
    await expect(answer).toContainText("в военный комиссариат");
    await answer.getByRole("link", { name: "Открыть заполненную форму" }).click();
    await expect(page).toHaveURL(/\/requests\/new\/study\?purpose=/);
    await expect(page.getByLabel("Куда нужна справка")).toHaveValue("в военный комиссариат");
  });

  test("средний балл и пары — ответ из своих данных", async ({ page }) => {
    await login(page, "student1");
    await page.goto(`/ask?q=${encodeURIComponent("какой у меня средний?")}`);
    const answer = page.getByRole("region", { name: "Ответ" });
    await expect(answer).toContainText("Рейтинг триместра");
    await expect(answer).toContainText("Средний балл по дисциплинам");

    await page.goto(`/ask?q=${encodeURIComponent("где завтра первая пара?")}`);
    await expect(page.getByRole("region", { name: "Ответ" })).toContainText(/Завтра (первая пара — в \d\d:\d\d|пар нет)/);
  });

  test("непонятный вопрос — честное «не понял» и примеры; мусор в адресе формы не подставляется", async ({ page }) => {
    await login(page, "student1");
    await page.goto(`/ask?q=${encodeURIComponent("как дела у котика")}`);
    await expect(page.getByText("Не понял вопрос")).toBeVisible();
    await page.getByRole("link", { name: "где завтра первая пара?" }).click();
    await expect(page.getByRole("region", { name: "Ответ" })).toBeVisible();

    // Произвольный текст из ссылки в справку не попадает: выбран первый вариант списка.
    await page.goto(`/requests/new/study?purpose=${encodeURIComponent("<b>куда угодно</b>")}`);
    await expect(page.getByLabel("Куда нужна справка")).toHaveValue("по месту работы родителей");
  });

  test("на телефоне — значок в шапке", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await login(page, "student1");
    await page.getByRole("banner").getByRole("link", { name: "Спроси деканат" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Спроси деканат");
  });
});
