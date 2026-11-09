import "server-only";
import { and, count, desc, eq, gte, inArray, isNull, notInArray, or, sum } from "drizzle-orm";
import { db } from "@/db";
import {
  achievements,
  announcements,
  attendance,
  checkpointScores,
  checkpoints,
  courseResults,
  courses,
  disciplines,
  documentTypes,
  gradingSettings,
  lessonChanges,
  notifications,
  requests,
  studentProfiles,
  terms,
  timetableSlots,
  users,
} from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { DEFAULT_SETTINGS, attendancePercent, ratingForecast, type GradingSettings } from "@/lib/grading";
import { upcomingChanges, upcomingDay, type Change, type Slot } from "@/lib/schedule";
import { addDays, mskNow, termWeek } from "@/lib/time";

// Все функции берут студента из сессии и не принимают id: чужие данные запросить нельзя.

export async function getGradingSettings(): Promise<GradingSettings> {
  const [row] = await db.select({ data: gradingSettings.data }).from(gradingSettings).where(eq(gradingSettings.key, "default"));
  return { ...DEFAULT_SETTINGS, ...row?.data, privileges: { ...DEFAULT_SETTINGS.privileges, ...row?.data?.privileges } };
}

export async function getUnreadCount(): Promise<number> {
  const user = await requireRole("student");
  const [row] = await db
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

const initials = (last: string, first: string, middle: string | null) =>
  `${last} ${first[0]}.${middle ? ` ${middle[0]}.` : ""}`;

export async function getToday(at: Date = new Date()) {
  const user = await requireRole("student");
  const now = mskNow(at);

  const [[me], [term]] = await Promise.all([
    db
      .select({ groupId: studentProfiles.groupId, isPaid: studentProfiles.isPaid })
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, user.id)),
    db.select().from(terms).where(eq(terms.isCurrent, true)).limit(1),
  ]);
  if (!me) throw new Error("Профиль студента не найден");

  const [requestRows, announcementRows, unread] = await Promise.all([
    db
      .select({
        id: requests.id,
        status: requests.status,
        updatedAt: requests.updatedAt,
        type: documentTypes.name,
        instant: documentTypes.instant,
        days: documentTypes.days,
      })
      .from(requests)
      .innerJoin(documentTypes, eq(documentTypes.id, requests.typeId))
      // Выданные и отклонённые — уже история, на главной только то, что в работе или ждёт скачивания.
      .where(and(eq(requests.studentId, user.id), notInArray(requests.status, ["issued", "rejected"])))
      .orderBy(desc(requests.updatedAt))
      .limit(3),
    db
      .select({ id: announcements.id, title: announcements.title, body: announcements.body, publishedAt: announcements.publishedAt })
      .from(announcements)
      .where(or(isNull(announcements.groupId), eq(announcements.groupId, me.groupId)))
      .orderBy(desc(announcements.publishedAt))
      .limit(2),
    getUnreadCount(),
  ]);

  const base = {
    firstName: user.firstName,
    now,
    requests: requestRows,
    announcements: announcementRows,
    unread,
  };
  if (!term) return { ...base, week: null, upcoming: null, changes: [], scores: [], rating: null, goal: null };

  const courseRows = await db
    .select({
      id: courses.id,
      assessment: courses.assessment,
      discipline: disciplines.name,
      teacherLast: users.lastName,
      teacherFirst: users.firstName,
      teacherMiddle: users.middleName,
    })
    .from(courses)
    .innerJoin(disciplines, eq(disciplines.id, courses.disciplineId))
    .innerJoin(users, eq(users.id, courses.teacherId))
    .where(and(eq(courses.groupId, me.groupId), eq(courses.termId, term.id)));
  const courseIds = courseRows.map((c) => c.id);
  if (courseIds.length === 0) {
    return { ...base, week: termWeek(term.startsOn, now.date), upcoming: null, changes: [], scores: [], rating: null, goal: null };
  }

  const [slotRows, scoreRows, attendanceRows, resultRows, [activity], settings] = await Promise.all([
    db.select().from(timetableSlots).where(inArray(timetableSlots.courseId, courseIds)),
    db
      .select({
        courseId: checkpoints.courseId,
        number: checkpoints.number,
        score: checkpointScores.score,
        gradedAt: checkpointScores.gradedAt,
      })
      .from(checkpointScores)
      .innerJoin(checkpoints, eq(checkpoints.id, checkpointScores.checkpointId))
      .where(and(eq(checkpointScores.studentId, user.id), inArray(checkpoints.courseId, courseIds))),
    db
      .select({ courseId: timetableSlots.courseId, status: attendance.status, n: count() })
      .from(attendance)
      .innerJoin(timetableSlots, eq(timetableSlots.id, attendance.slotId))
      .where(and(eq(attendance.studentId, user.id), inArray(timetableSlots.courseId, courseIds)))
      .groupBy(timetableSlots.courseId, attendance.status),
    db
      .select()
      .from(courseResults)
      .where(and(eq(courseResults.studentId, user.id), inArray(courseResults.courseId, courseIds))),
    db
      .select({ points: sum(achievements.points).mapWith(Number) })
      .from(achievements)
      .where(and(eq(achievements.studentId, user.id), eq(achievements.termId, term.id), eq(achievements.status, "approved"))),
    getGradingSettings(),
  ]);

  const byCourse = new Map(courseRows.map((c) => [c.id, c]));
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

  const changes: Change[] = slotRows.length
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
        .where(
          and(
            inArray(lessonChanges.slotId, slotRows.map((s) => s.id)),
            or(gte(lessonChanges.date, addDays(now.date, -1)), gte(lessonChanges.newDate, addDays(now.date, -1))),
          ),
        )
    : [];

  // Последние выставленные баллы с изменением относительно прошлого среза.
  const scores = [...scoreRows]
    .sort((a, b) => b.gradedAt.getTime() - a.gradedAt.getTime())
    .slice(0, 3)
    .map((s) => {
      const prev = scoreRows.find((p) => p.courseId === s.courseId && p.number === s.number - 1);
      return {
        discipline: byCourse.get(s.courseId)!.discipline,
        number: s.number,
        score: s.score,
        delta: prev ? s.score - prev.score : null,
        gradedAt: s.gradedAt,
      };
    });

  const rating = ratingForecast(
    courseRows.map((c) => {
      const att = (status: string) => attendanceRows.find((a) => a.courseId === c.id && a.status === status)?.n ?? 0;
      const result = resultRows.find((r) => r.courseId === c.id);
      return {
        checkpoints: scoreRows.filter((s) => s.courseId === c.id).sort((a, b) => a.number - b.number).map((s) => s.score),
        bonus: result?.bonus ?? 0,
        session: { kind: c.assessment, raw: result?.sessionRaw ?? null, retakes: result?.retakes ?? 0 },
        attendancePct: attendancePercent(att("present"), att("absent")),
        activity: result?.activity ?? null,
      };
    }),
    activity?.points ?? 0,
    settings,
  );

  // Ближайшая цель: грант для платной формы, повышенная стипендия для бюджетной.
  const p = settings.privileges;
  const goal = !rating
    ? null
    : me.isPaid
      ? { label: rating.base >= p.grant50From ? "грант 50%" : "грант 25%", target: rating.base >= p.grant25From ? p.grant50From : p.grant25From, value: rating.base }
      : { label: "повышенная стипендия", target: p.scholarshipFrom, value: rating.rating };

  return {
    ...base,
    week: termWeek(term.startsOn, now.date),
    upcoming: upcomingDay(now, slots, changes),
    changes: upcomingChanges(now.date, slots, changes),
    scores,
    rating,
    goal: goal && { ...goal, gap: Math.max(0, goal.target - goal.value) },
  };
}
