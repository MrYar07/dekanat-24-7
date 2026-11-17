import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  calendarFeeds,
  checkpoints,
  courses,
  disciplines,
  groups,
  lessonChanges,
  studentProfiles,
  terms,
  timetableSlots,
  users,
} from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { newVerificationCode } from "@/lib/documents";
import type { Change, Slot } from "@/lib/schedule";
import { buildCalendar, isFeedToken, termEvents } from "@/lib/schedule/ics";

// Расписание в календаре. Свои функции берут студента из сессии; лента по ссылке — публичная:
// календарь Google или Apple ходит за ней сам и войти не может. В ленте только расписание группы.

/**
 * Ссылка подписки студента (появляется при первом заходе на страницу «В календарь»)
 * и есть ли уже текущий триместр — без него лента пустая.
 */
export async function getMyCalendar(): Promise<{ token: string; hasTerm: boolean }> {
  const user = await requireRole("student");
  const token = async () =>
    (await db.select({ token: calendarFeeds.token }).from(calendarFeeds).where(eq(calendarFeeds.studentId, user.id)))[0]?.token;
  let current = await token();
  if (!current) {
    await db.insert(calendarFeeds).values({ studentId: user.id, token: newVerificationCode() }).onConflictDoNothing();
    current = await token();
  }
  const [term] = await db.select({ id: terms.id }).from(terms).where(eq(terms.isCurrent, true)).limit(1);
  return { token: current!, hasTerm: Boolean(term) };
}

/** Новая ссылка вместо старой: старая сразу отвечает «не найдено», подписку нужно добавить заново. */
export async function resetMyCalendarToken(): Promise<string> {
  const user = await requireRole("student");
  const token = newVerificationCode();
  await db
    .insert(calendarFeeds)
    .values({ studentId: user.id, token })
    .onConflictDoUpdate({ target: calendarFeeds.studentId, set: { token, createdAt: new Date() } });
  return token;
}

const initials = (last: string, first: string, middle: string | null) =>
  `${last} ${first[0]}.${middle ? ` ${middle[0]}.` : ""}`;

/** Публичная лента .ics по ссылке. null — ссылки нет (не было или сброшена). */
export async function calendarFeed(token: string, at: Date = new Date()): Promise<string | null> {
  if (!isFeedToken(token)) return null;
  const [owner] = await db
    .select({ groupId: studentProfiles.groupId, group: groups.name })
    .from(calendarFeeds)
    .innerJoin(studentProfiles, eq(studentProfiles.userId, calendarFeeds.studentId))
    .innerJoin(groups, eq(groups.id, studentProfiles.groupId))
    .where(eq(calendarFeeds.token, token))
    .limit(1);
  if (!owner) return null;

  const name = `Расписание ${owner.group} · Меридиан`;
  const description = "Концепт «Деканат 24/7» для конкурса: университет «Меридиан» вымышленный, расписание тоже.";
  const [term] = await db.select().from(terms).where(eq(terms.isCurrent, true)).limit(1);
  if (!term) return buildCalendar({ name, description, events: [], stamp: at });

  const courseRows = await db
    .select({
      id: courses.id,
      discipline: disciplines.name,
      teacherLast: users.lastName,
      teacherFirst: users.firstName,
      teacherMiddle: users.middleName,
    })
    .from(courses)
    .innerJoin(disciplines, eq(disciplines.id, courses.disciplineId))
    .innerJoin(users, eq(users.id, courses.teacherId))
    .where(and(eq(courses.groupId, owner.groupId), eq(courses.termId, term.id)))
    .orderBy(asc(disciplines.name));
  const courseIds = courseRows.map((c) => c.id);
  if (courseIds.length === 0) return buildCalendar({ name, description, events: [], stamp: at });
  const byCourse = new Map(courseRows.map((c) => [c.id, c]));

  const [slotRows, cps] = await Promise.all([
    db.select().from(timetableSlots).where(inArray(timetableSlots.courseId, courseIds)),
    db
      .select({ courseId: checkpoints.courseId, number: checkpoints.number, week: checkpoints.week })
      .from(checkpoints)
      .where(inArray(checkpoints.courseId, courseIds)),
  ]);
  const slots: Slot[] = slotRows.map((s) => {
    const c = byCourse.get(s.courseId)!;
    return {
      id: s.id,
      courseId: s.courseId,
      discipline: c.discipline,
      teacher: initials(c.teacherLast, c.teacherFirst, c.teacherMiddle),
      kind: s.kind,
      weekday: s.weekday,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      room: s.room,
    };
  });

  const changes: Change[] = slots.length
    ? await db
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
        // Пары сетки — только текущего триместра, поэтому все их изменения и нужны.
        .where(inArray(lessonChanges.slotId, slots.map((s) => s.id)))
    : [];

  return buildCalendar({ name, description, events: termEvents(term, slots, changes, cps), stamp: at });
}
