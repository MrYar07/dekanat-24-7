"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { changeRequestStatus } from "@/lib/data/staff/dean";
import { saveMyCheckpointScores, type ScoreEntry } from "@/lib/data/staff/teacher";

export type StatusFormState = { error?: string; note?: string; status?: string };

/** Деканат меняет статус заявки. Роль и допустимость перехода проверяет слой данных. */
export async function changeStatusAction(requestId: string, _prev: StatusFormState, form: FormData): Promise<StatusFormState> {
  const status = String(form.get("status") ?? "");
  const note = String(form.get("note") ?? "");
  if (!status) return { error: "Нужно выбрать, что сделать с заявкой", note };
  const result = await changeRequestStatus(requestId, { status, note });
  if (!result.ok) return { error: result.error, note, status };
  revalidatePath("/staff", "layout");
  redirect(`/staff/requests/${requestId}?done=${status}`);
}

export type ScoresFormState = { error?: string; saved?: number; cleared?: number; at?: number };

/** Преподаватель сохраняет баллы за срез. Поля формы: score:<id студента>. Пустое поле — балл снят. */
export async function saveScoresAction(courseId: string, cpNumber: number, _prev: ScoresFormState, form: FormData): Promise<ScoresFormState> {
  const entries: ScoreEntry[] = [];
  for (const [key, raw] of form.entries()) {
    if (!key.startsWith("score:")) continue;
    const text = String(raw).trim();
    const score = text === "" ? null : Number(text);
    if (score !== null && !Number.isInteger(score)) return { error: "Балл — целое число от 0 до 100" };
    entries.push({ studentId: key.slice("score:".length), score });
  }
  const result = await saveMyCheckpointScores(courseId, cpNumber, entries);
  if (!result.ok) return { error: result.error };
  revalidatePath("/staff", "layout");
  return { saved: result.saved, cleared: result.cleared, at: Date.now() };
}
