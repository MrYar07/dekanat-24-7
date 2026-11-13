"use server";

import { redirect } from "next/navigation";
import { FILE_MAX, type SubmissionField } from "@/lib/achievements";
import { submitMyAchievement } from "@/lib/data/achievements";

export type AchievementFormState = {
  error?: string;
  fields?: Partial<Record<SubmissionField, string>>;
  values?: { kind: string; title: string; proofUrl: string };
};

/** Студент подаёт достижение. Файл читается, только если он в пределах размера; тип проверяет слой данных. */
export async function submitAchievementAction(_prev: AchievementFormState, form: FormData): Promise<AchievementFormState> {
  const values = {
    kind: String(form.get("kind") ?? ""),
    title: String(form.get("title") ?? ""),
    proofUrl: String(form.get("proofUrl") ?? ""),
  };
  const raw = form.get("file");
  let file: { name: string; bytes: Uint8Array } | null = null;
  if (raw instanceof File && raw.size > 0) {
    if (raw.size > FILE_MAX) return { fields: { file: "Файл больше 3 МБ. Сожми его или приложи ссылку" }, values };
    file = { name: raw.name, bytes: new Uint8Array(await raw.arrayBuffer()) };
  }

  const result = await submitMyAchievement({ ...values, file });
  if (!result.ok) return { error: result.error, fields: result.fields, values };
  redirect("/grades?sent=1#achievements-title");
}
