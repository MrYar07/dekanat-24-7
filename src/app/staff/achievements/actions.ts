"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { decideAchievement } from "@/lib/data/staff/dean-achievements";

export type DecisionFormState = { error?: string; decision?: string; points?: string; note?: string };

/** Деканат решает по достижению. Роль, статус и предел баллов проверяет слой данных. */
export async function decideAchievementAction(achievementId: string, _prev: DecisionFormState, form: FormData): Promise<DecisionFormState> {
  const input = {
    decision: String(form.get("decision") ?? ""),
    points: String(form.get("points") ?? ""),
    note: String(form.get("note") ?? ""),
  };
  const result = await decideAchievement(achievementId, input);
  if (!result.ok) return { error: result.error, ...input };
  revalidatePath("/staff", "layout");
  redirect(`/staff/achievements/${achievementId}?done=${result.status}`);
}
