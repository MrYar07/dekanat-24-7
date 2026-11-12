"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { changeRequestStatus } from "@/lib/data/staff/dean";
import { publishAnnouncement, type AnnouncementInput } from "@/lib/data/staff/dean-announcements";
import { changeLesson, restoreLesson } from "@/lib/data/staff/dean-schedule";
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

export type AnnouncementFormState = {
  error?: string;
  fields?: Partial<Record<keyof AnnouncementInput, string>>;
  values?: AnnouncementInput;
  recipients?: number;
  at?: number;
};

/** Деканат публикует объявление. После успеха форма очищается, после ошибки — остаётся заполненной. */
export async function publishAnnouncementAction(_prev: AnnouncementFormState, form: FormData): Promise<AnnouncementFormState> {
  const values: AnnouncementInput = {
    title: String(form.get("title") ?? ""),
    body: String(form.get("body") ?? ""),
    audience: String(form.get("audience") ?? ""),
  };
  const result = await publishAnnouncement(values);
  if (!result.ok) return { error: result.error, fields: result.fields, values };
  revalidatePath("/staff/announcements");
  return { recipients: result.recipients, at: Date.now() };
}

export type LessonFormState = { error?: string; recipients?: number; at?: number };

/** Деканат меняет конкретную пару: перенос, отмена или другая аудитория. */
export async function changeLessonAction(slotId: string, date: string, _prev: LessonFormState, form: FormData): Promise<LessonFormState> {
  const text = (name: string) => String(form.get(name) ?? "");
  const result = await changeLesson({
    slotId,
    date,
    kind: text("kind"),
    newDate: text("newDate"),
    newStartsAt: text("newStartsAt"),
    newRoom: text("newRoom"),
    reason: text("reason"),
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/staff/schedule");
  return { recipients: result.recipients, at: Date.now() };
}

/** Вернуть пару в расписание по сетке. */
export async function restoreLessonAction(slotId: string, date: string): Promise<LessonFormState> {
  const result = await restoreLesson(slotId, date);
  if (!result.ok) return { error: result.error };
  revalidatePath("/staff/schedule");
  return { recipients: result.recipients, at: Date.now() };
}
