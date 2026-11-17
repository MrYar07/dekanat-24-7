"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { changeRequestStatus } from "@/lib/data/staff/dean";
import {
  editAnnouncement,
  publishAnnouncement,
  withdrawAnnouncement,
  type AnnouncementInput,
} from "@/lib/data/staff/dean-announcements";
import { changeLesson, restoreLesson } from "@/lib/data/staff/dean-schedule";
import {
  saveMyAttendance,
  saveMyCheckpointScores,
  saveMyCourseResults,
  type AttendanceEntry,
  type AttendanceMark,
  type ResultEntry,
  type ScoreEntry,
} from "@/lib/data/staff/teacher";

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

export type AnnouncementEditState = {
  error?: string;
  fields?: Partial<Record<"title" | "body", string>>;
  values?: { title: string; body: string };
  at?: number;
};

/** Деканат правит опубликованное объявление: текст меняется и у студентов, и в их уведомлениях. */
export async function editAnnouncementAction(
  announcementId: string,
  _prev: AnnouncementEditState,
  form: FormData,
): Promise<AnnouncementEditState> {
  const values = { title: String(form.get("title") ?? ""), body: String(form.get("body") ?? "") };
  const result = await editAnnouncement(announcementId, values);
  if (!result.ok) return { error: result.error, fields: result.fields, values };
  revalidatePath("/staff/announcements");
  return { at: Date.now() };
}

/** Деканат снимает объявление. Возвращает, сколько уведомлений удалено у студентов. */
export async function withdrawAnnouncementAction(announcementId: string): Promise<{ error?: string; removed?: number }> {
  const result = await withdrawAnnouncement(announcementId);
  if (!result.ok) return { error: result.error };
  revalidatePath("/staff/announcements");
  return { removed: result.removed };
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

export type AttendanceFormState = { error?: string; saved?: number; cleared?: number; absent?: number; at?: number };

/** Преподаватель отмечает посещаемость пары. Поля формы: mark:<id студента> = present | absent | excused | пусто. */
export async function saveAttendanceAction(
  courseId: string,
  lesson: string,
  _prev: AttendanceFormState,
  form: FormData,
): Promise<AttendanceFormState> {
  const entries: AttendanceEntry[] = [];
  for (const [key, raw] of form.entries()) {
    if (!key.startsWith("mark:")) continue;
    const value = String(raw);
    entries.push({ studentId: key.slice("mark:".length), status: value === "" ? null : (value as AttendanceMark) });
  }
  const result = await saveMyAttendance(courseId, lesson, entries);
  if (!result.ok) return { error: result.error };
  revalidatePath("/staff", "layout");
  return { saved: result.saved, cleared: result.cleared, absent: result.absent, at: Date.now() };
}

export type ResultsFormState = { error?: string; saved?: number; bonuses?: number; at?: number };

/** Преподаватель выставляет активность и бонус. Пустая активность — «ещё не оценена». */
export async function saveResultsAction(courseId: string, _prev: ResultsFormState, form: FormData): Promise<ResultsFormState> {
  const entries: ResultEntry[] = [];
  for (const [key, raw] of form.entries()) {
    if (!key.startsWith("activity:")) continue;
    const studentId = key.slice("activity:".length);
    const text = String(raw).trim();
    const activity = text === "" ? null : Number(text);
    if (activity !== null && !Number.isInteger(activity)) return { error: "Активность — целое число от 0 до 100" };
    entries.push({ studentId, activity, bonus: Number(form.get(`bonus:${studentId}`) ?? 0) });
  }
  const result = await saveMyCourseResults(courseId, entries);
  if (!result.ok) return { error: result.error };
  revalidatePath("/staff", "layout");
  return { saved: result.saved, bonuses: result.bonuses, at: Date.now() };
}
