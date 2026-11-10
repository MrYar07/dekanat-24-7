import { expect, test } from "@playwright/test";
import { login, query, requestIdOf } from "./helpers";

test.describe("справки: разделение данных", () => {
  test("чужая заявка и её PDF — 404, своя открывается", async ({ page }) => {
    const foreign = await requestIdOf("student1", "study");
    const own = await requestIdOf("student2", "study");
    await login(page, "student2");

    const res = await page.goto(`/requests/${foreign}`);
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Такой страницы нет" })).toBeVisible();

    const pdf = await page.request.get(`/requests/${foreign}/document`);
    expect(pdf.status()).toBe(404);

    const mine = await page.goto(`/requests/${own}`);
    expect(mine?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Справка об обучении");
  });

  test("мусор вместо id — тоже 404, без ошибки сервера", async ({ page }) => {
    await login(page, "student2");
    const res = await page.goto("/requests/not-a-uuid");
    expect(res?.status()).toBe(404);
    expect((await page.request.get("/requests/not-a-uuid/document")).status()).toBe(404);
  });
});

test.describe("справка за минуту", () => {
  test("заказ справки об обучении → PDF с QR → публичная проверка", async ({ page }) => {
    await login(page, "student1");
    await page.goto("/requests/new/study");
    await page.getByLabel("Куда нужна справка").selectOption("в банк");
    await page.getByRole("button", { name: "Сформировать PDF" }).click();

    await expect(page).toHaveURL(/\/requests\/[0-9a-f-]{36}\?new=1$/);
    await expect(page.getByText("Справка сформирована.")).toBeVisible();
    const id = page.url().match(/requests\/([0-9a-f-]{36})/)![1];

    const pdf = await page.request.get(`/requests/${id}/document`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

    // После скачивания заявка — «выдано».
    await page.reload();
    await expect(page.getByText("выдано", { exact: true }).first()).toBeVisible();

    // Проверка по коду — без входа, в чистом контексте.
    const [{ code }] = await query<{ code: string }>("select code from issued_documents where request_id = $1", [id]);
    const guest = await page.context().browser()!.newContext();
    const gp = await guest.newPage();
    await gp.goto(`/verify/${code}`);
    await expect(gp.getByRole("heading", { name: "Справка действительна" })).toBeVisible();
    await expect(gp.getByText("Северова А. И.")).toBeVisible();
    // Лишнего не показываем: ни имени целиком, ни группы.
    await expect(gp.getByText("Алина")).toHaveCount(0);
    await expect(gp.getByText("ГЭ-24-1")).toHaveCount(0);

    await gp.goto("/verify/AAAAAAAAAAAAAAAAAAAAAA");
    await expect(gp.getByRole("heading", { name: "Документ не найден" })).toBeVisible();
    await guest.close();
  });
});
