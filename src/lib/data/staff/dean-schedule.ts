import "server-only";
import { and, asc, between, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { courses, disciplines, groups, lessonChanges, notifications, studentProfiles, terms, timetableSlots, users } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { lessonsOn, PAIRS, type Change, type Lesson, type Slot } from "@/lib/schedule";
import { addDays, formatDay, mondayOf, mskNow, termWeek, weekdayOf } from "@/lib/time";

// Деканат: изменения конкретных занятий — перенос, отмена, другая аудитория.
// Изменение видит вся группа: в расписании, на «Сегодня» и в уведомлении.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const REASON_MAX = 200;
const ROOM_MAX = 40;

const isDate = (v: string) => DATE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

async function currentTerm() {
  const [term] = await db.select().from(terms).where(eq(terms.isCurrent, true)).limit(1);
  if (!term) return null;
  return { ...term, endsOn: addDays(term.startsOn, term.weeks * 7 - 1) };
}

/** Сетка и изменения одной группы в текущем триместре. */
async function groupTimetable(groupId: string, termId: string, from: string, to: string) {
  const rows = await db
    .select({
      id: timetableSlots.id,
      courseId: timetableSlots.courseId,
      kind: timetableSlots.kind,
      weekday: timetableSlots.weekday,
      startsAt: timetableSlots.startsAt,
      endsAt: timetableSlots.endsAt,
      room: timetableSlots.room,
      discipline: disciplines.name,
      teacherLast: users.lastName,
      teacherFirst: users.firstName,
      teacherMiddle: users.middleName,
    })
    .from(timetableSlots)
    .innerJoin(courses, eq(courses.id, timetableSlots.courseId))
    .innerJoin(disciplines, eq(disciplines.id, courses.disciplineId))
    .innerJoin(users, eq(users.id, courses.teacherId))
    .where(and(eq(courses.groupId, groupId), eq(courses.termId, termId)));
  const slots: Slot[] = rows.map(({ teacherLast, teacherFirst, teacherMiddle, ...r }) => ({
    ...r,
    teacher: `${teacherLast} ${teacherFirst[0]}.${teacherMiddle ? ` ${teacherMiddle[0]}.` : ""}`,
  }));
  if (slots.length === 0) return { slots, changes: [] as Change[] };

  const changes: Change[] = await db
    .select({
      slotId: lessonChanges.slotId,
      date: lessonChanges.date,
      kind: lessonChanges.kind,
      newDate: lessonChanges.newDate,
      newStartsAt: lessonChanges.newStartsAt,
      newEndsAt: lessonChanges.newEndsAt,
      newRoom: lessonChanges.newRoom,
      reason: lessonChanges.reason,
    })
    .from(lessonChanges)
    .where(
      and(
        inArray(
          lessonChanges.slotId,
          slots.map((s) => s.id),
        ),
        or(between(lessonChanges.date, from, to), between(lessonChanges.newDate, from, to)),
      ),
    );
  return { slots, changes };
}

/**
 * Расписание группы на день для деканата. Группа и дата — из адреса страницы;
 * неверные значения заменяются на первую группу и сегодняшний день.
 */
export async function getScheduleBoard(groupId?: string, date?: string, at: Date = new Date()) {
  await requireRole("dean_office");
  const today = mskNow(at).date;
  const [term, groupRows] = await Promise.all([
    currentTerm(),
    db.select({ id: groups.id, name: groups.name }).from(groups).orderBy(asc(groups.name)),
  ]);
  const group = groupRows.find((g) => g.id === groupId) ?? groupRows[0] ?? null;
  if (!term || !group) return { today, term: null, groups: groupRows, group, date: today, week: [], lessons: [], movedAway: [] };

  const clamp = (d: string) => (d < term.startsOn ? term.startsOn : d > term.endsOn ? term.endsOn : d);
  const shown = clamp(date && isDate(date) ? date : today);
  const monday = mondayOf(shown);
  const { slots, changes } = await groupTimetable(group.id, term.id, monday, addDays(monday, 6));

  // Понедельник — суббота; в скобках у дня — сколько пар, чтобы не открывать пустые дни.
  const week = [0, 1, 2, 3, 4, 5].map((i) => {
    const d = addDays(monday, i);
    return { date: d, lessons: lessonsOn(d, slots, changes).length, inTerm: d >= term.startsOn && d <= term.endsOn };
  });

  return {
    today,
    term: { startsOn: term.startsOn, endsOn: term.endsOn, week: termWeek(term.startsOn, shown) },
    groups: groupRows,
    group,
    date: shown,
    week,
    lessons: lessonsOn(shown, slots, changes),
    // Пары, перенесённые с этого дня: в списке занятий их уже нет, но деканату нужно их видеть и уметь вернуть.
    movedAway: changes
      .filter((c) => c.kind === "moved" && c.date === shown && c.newDate !== shown)
      .flatMap((c) => {
        const slot = slots.find((x) => x.id === c.slotId);
        return slot ? [{ slot, change: c }] : [];
      }),
  };
}

export type LessonChangeInput = {
  slotId: string;
  /** Дата занятия по сетке. */
  date: string;
  kind: string;
  newDate: string;
  newStartsAt: string;
  newRoom: string;
  reason: string;
};
export type LessonChangeResult = { ok: true; recipients: number } | { ok: false; error: string };

/** Пара из сетки вместе с курсом, группой и триместром. null — пары нет или она не из текущего триместра. */
async function slotContext(slotId: string) {
  if (!UUID.test(slotId)) return null;
  const term = await currentTerm();
  if (!term) return null;
  const [slot] = await db
    .select({
      id: timetableSlots.id,
      weekday: timetableSlots.weekday,
      startsAt: timetableSlots.startsAt,
      room: timetableSlots.room,
      groupId: courses.groupId,
      discipline: disciplines.name,
    })
    .from(timetableSlots)
    .innerJoin(courses, eq(courses.id, timetableSlots.courseId))
    .innerJoin(disciplines, eq(disciplines.id, courses.disciplineId))
    .where(and(eq(timetableSlots.id, slotId), eq(courses.termId, term.id)));
  return slot ? { slot, term } : null;
}

async function notifyGroup(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  groupId: string,
  message: { title: string; body: string; href: string },
) {
  const students = await tx.select({ id: studentProfiles.userId }).from(studentProfiles).where(eq(studentProfiles.groupId, groupId));
  if (students.length) {
    await tx.insert(notifications).values(students.map((s) => ({ userId: s.id, kind: "change" as const, ...message })));
  }
  return students.length;
}

/**
 * Изменить конкретное занятие: перенести, отменить или сменить аудиторию.
 * Прежнее изменение этой же пары заменяется. Перенос не допускается на время, когда у группы уже есть пара.
 */
export async function changeLesson(input: LessonChangeInput, at: Date = new Date()): Promise<LessonChangeResult> {
  await requireRole("dean_office");
  const ctx = await slotContext(input.slotId);
  if (!ctx) return { ok: false, error: "Пара не найдена" };
  const { slot, term } = ctx;
  const today = mskNow(at).date;
  const inTerm = (d: string) => d >= term.startsOn && d <= term.endsOn;

  if (!isDate(input.date) || weekdayOf(input.date) !== slot.weekday || !inTerm(input.date)) {
    return { ok: false, error: "В этот день такой пары нет" };
  }
  if (input.date < today) return { ok: false, error: "Прошедшую пару изменить нельзя" };
  const reason = input.reason.trim().slice(0, REASON_MAX) || null;
  const room = input.newRoom.trim().slice(0, ROOM_MAX) || null;

  let change: { kind: Change["kind"]; newDate: string | null; newStartsAt: string | null; newEndsAt: string | null; newRoom: string | null };
  let title: string;
  let body: string;
  const when = `${formatDay(input.date)}, ${slot.startsAt}`;

  if (input.kind === "cancelled") {
    change = { kind: "cancelled", newDate: null, newStartsAt: null, newEndsAt: null, newRoom: null };
    title = `Отмена: ${slot.discipline}`;
    body = reason ? `${when}. ${reason}` : when;
  } else if (input.kind === "room") {
    if (!room) return { ok: false, error: "Нужна новая аудитория" };
    if (room === slot.room) return { ok: false, error: "Это та же аудитория, что в расписании" };
    change = { kind: "room", newDate: null, newStartsAt: null, newEndsAt: null, newRoom: room };
    title = `Другая аудитория: ${slot.discipline}`;
    body = `${when}: ${room} вместо ${slot.room}`;
  } else if (input.kind === "moved") {
    if (!isDate(input.newDate) || !inTerm(input.newDate)) return { ok: false, error: "Новая дата должна быть в пределах триместра" };
    if (input.newDate < today) return { ok: false, error: "Новая дата уже прошла" };
    if (weekdayOf(input.newDate) === 7) return { ok: false, error: "В воскресенье занятий нет" };
    const end = PAIRS[input.newStartsAt];
    if (!end) return { ok: false, error: "Нужно выбрать время из сетки пар" };
    if (input.newDate === input.date && input.newStartsAt === slot.startsAt) {
      return { ok: false, error: "Это то же время, что в расписании. Для смены аудитории есть отдельное действие" };
    }
    // Занята ли группа в новое время. Прежнее изменение этой пары не учитываем: оно заменяется.
    const { slots, changes } = await groupTimetable(slot.groupId, term.id, input.newDate, input.newDate);
    const others = changes.filter((c) => !(c.slotId === slot.id && c.date === input.date));
    const busy = lessonsOn(input.newDate, slots, others).find(
      (l) => !l.cancelled && l.startsAt === input.newStartsAt && !(l.slotId === slot.id && input.newDate === input.date),
    );
    if (busy) return { ok: false, error: `В это время у группы уже пара: ${busy.discipline}` };
    change = { kind: "moved", newDate: input.newDate, newStartsAt: input.newStartsAt, newEndsAt: end, newRoom: room };
    title = `Перенос: ${slot.discipline}`;
    body = `${when} → ${formatDay(input.newDate)}, ${input.newStartsAt}, ${room ?? slot.room}`;
  } else {
    return { ok: false, error: "Нужно выбрать, что изменить" };
  }

  return db.transaction(async (tx) => {
    await tx.delete(lessonChanges).where(and(eq(lessonChanges.slotId, slot.id), eq(lessonChanges.date, input.date)));
    await tx.insert(lessonChanges).values({ slotId: slot.id, date: input.date, reason, ...change });
    const recipients = await notifyGroup(tx, slot.groupId, {
      title,
      body,
      href: `/schedule?week=${termWeek(term.startsOn, input.date)}`,
    });
    return { ok: true, recipients } as const;
  });
}

/** Отменить изменение: пара снова идёт по сетке. Группа получает уведомление. */
export async function restoreLesson(slotId: string, date: string): Promise<LessonChangeResult> {
  await requireRole("dean_office");
  const ctx = await slotContext(slotId);
  if (!ctx || !isDate(date)) return { ok: false, error: "Пара не найдена" };
  const { slot, term } = ctx;

  return db.transaction(async (tx) => {
    const removed = await tx
      .delete(lessonChanges)
      .where(and(eq(lessonChanges.slotId, slot.id), eq(lessonChanges.date, date)))
      .returning({ id: lessonChanges.id });
    if (removed.length === 0) return { ok: false, error: "Изменение уже отменено" } as const;
    const recipients = await notifyGroup(tx, slot.groupId, {
      title: `Снова по расписанию: ${slot.discipline}`,
      body: `${formatDay(date)}, ${slot.startsAt}, ${slot.room}. Изменение отменено`,
      href: `/schedule?week=${termWeek(term.startsOn, date)}`,
    });
    return { ok: true, recipients } as const;
  });
}

export type BoardLesson = Lesson;
