"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, count, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { loginAttempts, users } from "@/db/schema";
import { getDummyHash, verifyPassword } from "@/lib/auth/password";
import { createSession, deleteCurrentSession } from "@/lib/auth/session";
import { homePathFor } from "@/lib/auth/dal";
import { isLockedOut, WINDOW_MS } from "@/lib/auth/throttle";

export type LoginState = { error?: string; login?: string };

const schema = z.object({
  login: z.string().trim().toLowerCase().min(1, "Введи логин").max(64),
  password: z.string().min(1, "Введи пароль").max(256),
});

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    login: formData.get("login"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message, login: String(formData.get("login") ?? "") };
  }
  const { login: loginName, password } = parsed.data;
  const ip = await clientIp();

  const since = new Date(Date.now() - WINDOW_MS);
  const recentFails = and(eq(loginAttempts.success, false), gt(loginAttempts.createdAt, since));
  const fails = (...where: Parameters<typeof and>) =>
    db
      .select({ n: count() })
      .from(loginAttempts)
      .where(and(recentFails, ...where))
      .then(([row]) => row?.n ?? 0);
  // Пределы и то, почему счёт идёт по паре «логин + адрес», — в lib/auth/throttle.ts.
  const [pair, byIp, byLogin] = await Promise.all([
    fails(eq(loginAttempts.login, loginName), eq(loginAttempts.ip, ip)),
    fails(eq(loginAttempts.ip, ip)),
    fails(eq(loginAttempts.login, loginName)),
  ]);
  if (isLockedOut({ pair, ip: byIp, login: byLogin })) {
    return { error: "Слишком много попыток. Подожди 15 минут и попробуй снова.", login: loginName };
  }

  const [user] = await db
    .select({ id: users.id, role: users.role, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.login, loginName))
    .limit(1);

  const ok = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), password);
  await db.insert(loginAttempts).values({ login: loginName, ip, success: ok && !!user });

  if (!user || !ok) {
    return { error: "Неверный логин или пароль", login: loginName };
  }

  await createSession(user.id);
  redirect(homePathFor(user.role));
}

export async function logout(): Promise<void> {
  await deleteCurrentSession();
  redirect("/login");
}
