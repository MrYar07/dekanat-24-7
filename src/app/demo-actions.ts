"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser, homePathFor } from "@/lib/auth/dal";
import { createSession, deleteCurrentSession } from "@/lib/auth/session";
import { demoEnabled, isDemoLogin, safeNext } from "@/lib/demo/accounts";

/**
 * Переключиться на другой демо-аккаунт без пароля. Работает, только если текущий пользователь сам вошёл
 * под демо-аккаунтом: у всех четырёх один пароль, поэтому переключение не расширяет его права.
 * Прежняя сессия удаляется, создаётся новая — как при обычном входе.
 */
export async function switchDemoAccountAction(form: FormData): Promise<void> {
  const target = form.get("login");
  const me = await getCurrentUser();
  if (!demoEnabled() || !me || !isDemoLogin(me.login) || !isDemoLogin(target)) redirect("/");

  const [user] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.login, target)).limit(1);
  if (!user) redirect("/");

  await deleteCurrentSession();
  await createSession(user.id);
  redirect(safeNext(form.get("next")) ?? homePathFor(user.role));
}
