"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { deleteAllSessions } from "@/lib/auth/session";

/** Завершить все сеансы пользователя из сессии: на этом устройстве и на остальных. */
export async function logoutEverywhere(): Promise<void> {
  const user = await requireUser();
  await deleteAllSessions(user.id);
  redirect("/login");
}
