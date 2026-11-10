"use server";

import { revalidatePath } from "next/cache";
import { isNotificationKind, markAllMyNotificationsRead } from "@/lib/data/notifications";

export async function markAllReadAction(kind: string | null) {
  await markAllMyNotificationsRead(isNotificationKind(kind) ? kind : undefined);
  // Счётчик стоит в шапке и меню на всех страницах кабинета.
  revalidatePath("/", "layout");
}
