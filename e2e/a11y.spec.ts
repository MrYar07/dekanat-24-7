import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

// Версия для слабовидящих: включается кнопкой в шапке, переживает вход и перезагрузку,
// и даже при очень крупном шрифте страница на телефоне не уезжает вбок.

test.use({ viewport: { width: 360, height: 800 } });

const html = (page: Page) => page.locator("html");
const noSideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test("включение, настройки, вход и обычная версия", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Версия для слабовидящих" }).click();
  await expect(html(page)).toHaveAttribute("data-font", "lg");
  await expect(html(page)).toHaveAttribute("data-contrast", "bw");
  const bar = page.getByRole("region", { name: "Версия для слабовидящих" });
  await expect(bar.getByRole("button", { name: "Скрыть настройки" })).toHaveAttribute("aria-expanded", "true");
  // Пока панель на экране, кнопка «глаз» в шапке не нужна.
  await expect(page.getByRole("button", { name: "Версия для слабовидящих" })).toBeHidden();

  await bar.getByLabel("Шрифт очень крупный").check({ force: true });
  await bar.getByLabel("Цвета: белым по чёрному").check({ force: true });
  await bar.getByLabel("Интервалы увеличенные").check({ force: true });
  await expect(html(page)).toHaveAttribute("data-font", "xl");
  await expect(html(page)).toHaveAttribute("data-contrast", "wb");
  await expect(html(page)).toHaveAttribute("data-spacing", "wide");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe("24px");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(0, 0, 0)");

  // Выбор хранится в cookie: после входа сервер сразу отдаёт крупную версию.
  await login(page, "student1");
  await expect(html(page)).toHaveAttribute("data-font", "xl");
  await expect(bar.getByRole("button", { name: "Настройки для слабовидящих" })).toHaveAttribute("aria-expanded", "false");
  for (const url of ["/", "/grades", "/schedule", "/requests"]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    expect(await noSideScroll(page), url).toBe(true);
  }
  // Короткая подпись вкладки: «Расписание» на 70 px крупным шрифтом не помещается.
  await expect(page.getByRole("navigation", { name: "Разделы кабинета" }).getByRole("link", { name: "Пары" })).toBeVisible();

  await bar.getByRole("button", { name: "Обычная версия" }).click();
  await expect(bar).toBeHidden();
  await expect(html(page)).not.toHaveAttribute("data-font", /.*/);
  await page.reload();
  await expect(html(page)).not.toHaveAttribute("data-a11y", /.*/);
  await expect(page.getByRole("button", { name: "Версия для слабовидящих" }).first()).toBeVisible();
});

test("мусор в cookie — обычная версия, а не ошибка", async ({ page, context }) => {
  await context.addCookies([{ name: "d247_a11y", value: "<script>.x.y", url: "http://localhost:3000" }]);
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Вход в кабинет");
  await expect(html(page)).not.toHaveAttribute("data-a11y", /.*/);
});
