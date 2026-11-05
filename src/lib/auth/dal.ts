import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { readSessionUserId } from "./session";

// Слой доступа к данным: единственное место, где определяется текущий пользователь.
// Любые данные студента запрашиваются через его id отсюда, а не из URL.

export type Role = (typeof users.$inferSelect)["role"];

export type CurrentUser = {
  id: string;
  role: Role;
  lastName: string;
  firstName: string;
  middleName: string | null;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const userId = await readSessionUserId();
  if (!userId) return null;

  const [user] = await db
    .select({
      id: users.id,
      role: users.role,
      lastName: users.lastName,
      firstName: users.firstName,
      middleName: users.middleName,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user ?? null;
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  // Чужая роль уходит на свою главную. Не на "/": для сотрудника это снова студентская зона и цикл редиректов.
  if (!roles.includes(user.role)) redirect(homePathFor(user.role));
  return user;
}

export function homePathFor(role: Role): string {
  return role === "student" ? "/" : "/staff";
}
