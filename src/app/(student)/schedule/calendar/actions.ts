"use server";

import { revalidatePath } from "next/cache";
import { resetMyCalendarToken } from "@/lib/data/calendar";

/** Новая ссылка подписки. Страница перерисуется с ней, старая ссылка сразу перестаёт работать. */
export async function resetCalendarLink(): Promise<void> {
  await resetMyCalendarToken();
  revalidatePath("/schedule/calendar");
}
