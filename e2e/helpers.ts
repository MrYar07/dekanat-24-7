import { expect, type Page } from "@playwright/test";
import { Pool } from "pg";

/** Вход через форму. Пароль тестовых аккаунтов — из .env, в коде теста его нет. */
export async function login(page: Page, who: "student1" | "student2") {
  const password = process.env.SEED_PASSWORD;
  if (!password) throw new Error("Нужен SEED_PASSWORD в .env");
  await page.goto("/login");
  await page.getByLabel("Логин").fill(who);
  await page.getByLabel("Пароль").fill(password);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL("/");
}

/** Прямой запрос к локальной базе — только чтобы узнать id чужой заявки для теста. */
export async function query<T>(text: string, values: unknown[] = []): Promise<T[]> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    return (await pool.query(text, values)).rows as T[];
  } finally {
    await pool.end();
  }
}

export async function requestIdOf(login: string, type: string): Promise<string> {
  const [row] = await query<{ id: string }>(
    `select r.id from requests r join users u on u.id = r.student_id join document_types t on t.id = r.type_id
     where u.login = $1 and t.code = $2 order by r.created_at limit 1`,
    [login, type],
  );
  if (!row) throw new Error(`Нет заявки ${type} у ${login}: перезапусти сид`);
  return row.id;
}
