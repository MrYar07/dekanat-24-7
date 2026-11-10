import "server-only";
import { cache } from "react";
import { and, asc, between, count, desc, eq, inArray, isNull, notInArray, or, sum } from "drizzle-orm";
import { db } from "@/db";
import {
  achievementKinds,
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
import {
  DEFAULT_SETTINGS,
  attendancePercent,
  MARK_LABEL,
  disciplineScore,
  markFor,
  nextGoal,
  privilegesFor,
  ratingForecast,
  type DisciplineInput,
  type GradingSettings,
} from "@/lib/grading";
import { lessonsOn, upcomingChanges, upcomingDay, type Change, type Slot } from "@/lib/schedule";
import { addDays, mskNow, termWeek } from "@/lib/time";

// Учебные данные студента: «Сегодня», «Расписание», «Успеваемость».
// Экспортируемые функции не принимают id: студент берётся только из сессии (см. access.test.ts).
// Внутренние загрузчики ниже получают контекст из loadStudent() и наружу не выходят.

// ——— Внутренние загрузчики ———

const initials = (last: string, first: string, middle: string | null) =>
  `${last} ${first[0]}.${middle ? ` ${middle[0]}.` : ""}`;

/** Студент из сессии, его группа, текущий триместр и курсы группы. Один раз на запрос. */
const loadStudent = cache(async () => {
  const user = await requireRole("student");
  const [[me], [term]] = await Promise.all([
    db
      .select({ groupId: studentProfiles.groupId, isPaid: studentProfiles.isPaid })
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, user.id)),
    db.select().from(terms).where(eq(terms.isCurrent, true)).limit(1),
  ]);
  if (!me) throw new Error("Профиль студента не найден");

  const courseRows = term
    ? await db
        .select({
          id: courses.id,
          assessment: courses.assessment,
          plannedCheckpoints: courses.plannedCheckpoints,
          discipline: disciplines.name,
          teacherLast: users.lastName,
          teacherFirst: users.firstName,
          teacherMiddle: users.middleName,
        })
        .from(courses)
        .innerJoin(disciplines, eq(disciplines.id, courses.disciplineId))
        .innerJoin(users, eq(users.id, courses.teacherId))
        .where(and(eq(courses.groupId, me.groupId), eq(courses.termId, term.id)))
        .orderBy(asc(disciplines.name))
    : [];

  return {
    user,
    me,
    term: term ?? null,
    courses: courseRows.map(({ teacherLast, teacherFirst, teacherMiddle, ...c }) => ({
      ...c,
      teacher: initials(teacherLast, teacherFirst, teacherMiddle),
    })),
  };
});

type StudentContext = Awaited<ReturnType<typeof loadStudent>>;

const loadSettings = cache(async (): Promise<GradingSettings> => {
  const [row] = await db.select({ data: gradingSettings.data }).from(gradingSettings).where(eq(gradingSettings.key, "default"));
  return { ...DEFAULT_SETTINGS, ...row?.data, privileges: { ...DEFAULT_SETTINGS.privileges, ...row?.data?.privileges } };
});

async function loadTimetable(ctx: StudentContext, from: string, to: string): Promise<{ slots: Slot[]; changes: Change[] }> {
  const courseIds = ctx.courses.map((c) => c.id);
  if (courseIds.length === 0) return { slots: [], changes: [] };
  const byCourse = new Map(ctx.courses.map((c) => [c.id, c]));

  const slotRows = await db.select().from(timetableSlots).where(inArray(timetableSlots.courseId, courseIds));
  const slots: Slot[] = slotRows.map((s) => ({
    id: s.id,
    courseId: s.courseId,
    discipline: byCourse.get(s.courseId)!.discipline,
    teacher: byCourse.get(s.courseId)!.teacher,
    kind: s.kind,
    weekday: s.weekday,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    room: s.room,
  }));
  if (slots.length === 0) return { slots, changes: [] };

  const changes = await db
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
        inArray(lessonChanges.slotId, slots.map((s) => s.id)),
        or(between(lessonChanges.date, from, to), between(lessonChanges.newDate, from, to)),
      ),
    );
  return { slots, changes };
}

/** Срезы, посещаемость и итоги по каждому курсу, плюс расчёт балла дисциплины и рейтинга. */
async function loadPerformance(ctx: StudentContext) {
  const { user, term } = ctx;
  const courseIds = ctx.courses.map((c) => c.id);
  const settings = await loadSettings();
  if (!term || courseIds.length === 0) return { settings, courses: [], activityPoints: 0, rating: null };

  const [cpRows, attRows, resultRows, [activity]] = await Promise.all([
    // Все запланированные срезы, балл — если уже выставлен.
    db
      .select({
        courseId: checkpoints.courseId,
        number: checkpoints.number,
        week: checkpoints.week,
        score: checkpointScores.score,
        gradedAt: checkpointScores.gradedAt,
      })
      .from(checkpoints)
      .leftJoin(
        checkpointScores,
        and(eq(checkpointScores.checkpointId, checkpoints.id), eq(checkpointScores.studentId, user.id)),
      )
      .where(inArray(checkpoints.courseId, courseIds))
      .orderBy(asc(checkpoints.number)),
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
  ]);

  const perCourse = ctx.courses.map((c) => {
    const att = (status: "present" | "absent" | "excused") =>
      attRows.find((a) => a.courseId === c.id && a.status === status)?.n ?? 0;
    const present = att("present");
    const absent = att("absent");
    const result = resultRows.find((r) => r.courseId === c.id);
    const cps = cpRows.filter((r) => r.courseId === c.id);
    const graded = cps.filter((r) => r.score !== null).map((r) => r.score!);
    const input: DisciplineInput = {
      checkpoints: graded,
      bonus: result?.bonus ?? 0,
      session: { kind: c.assessment, raw: result?.sessionRaw ?? null, retakes: result?.retakes ?? 0 },
      attendancePct: attendancePercent(present, absent),
      activity: result?.activity ?? null,
    };
    return {
      ...c,
      checkpoints: cps.map(({ number, week, score, gradedAt }) => ({ number, week, score, gradedAt })),
      attendance: { present, absent, excused: att("excused"), pct: input.attendancePct },
      bonus: input.bonus ?? 0,
      retakes: result?.retakes ?? 0,
      input,
      result: disciplineScore(input, settings),
    };
  });

  const activityPoints = activity?.points ?? 0;
  return {
    settings,
    courses: perCourse,
    activityPoints,
    rating: ratingForecast(
      perCourse.map((c) => c.input),
      activityPoints,
      settings,
    ),
  };
}

// ——— Публичный слой: только данные текущего студента ———

export async function getUnreadCount(): Promise<number> {
  const user = await requireRole("student");
  const [row] = await db
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

export async function getToday(at: Date = new Date()) {
  const ctx = await loadStudent();
  const { user, me, term } = ctx;
  const now = mskNow(at);

  const [requestRows, announcementRows, unread, perf, timetable] = await Promise.all([
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
    loadPerformance(ctx),
    // Сетка на две недели вперёд и вчерашний день: переносы «со вчера на сегодня» тоже видны.
    loadTimetable(ctx, addDays(now.date, -1), addDays(now.date, 14)),
  ]);

  // Последние выставленные баллы с изменением относительно прошлого среза.
  const scores = perf.courses
    .flatMap((c) =>
      c.checkpoints
        .filter((cp) => cp.score !== null)
        .map((cp) => {
          const prev = c.checkpoints.find((p) => p.number === cp.number - 1)?.score ?? null;
          return {
            discipline: c.discipline,
            number: cp.number,
            score: cp.score!,
            delta: prev !== null ? cp.score! - prev : null,
            gradedAt: cp.gradedAt!,
          };
        }),
    )
    .sort((a, b) => b.gradedAt.getTime() - a.gradedAt.getTime())
    .slice(0, 3);

  return {
    firstName: user.firstName,
    now,
    week: term ? termWeek(term.startsOn, now.date) : null,
    upcoming: upcomingDay(now, timetable.slots, timetable.changes),
    changes: upcomingChanges(now.date, timetable.slots, timetable.changes),
    scores,
    rating: perf.rating,
    goal: perf.rating ? nextGoal(perf.rating, me.isPaid, perf.settings) : null,
    requests: requestRows,
    announcements: announcementRows,
    unread,
  };
}

/**
 * Неделя расписания. week — номер недели триместра из адреса страницы; неверный или
 * вне триместра — показываем текущую. Это не данные другого студента, поэтому параметр допустим.
 */
export async function getSchedule(week?: number, at: Date = new Date()) {
  const ctx = await loadStudent();
  const { user, term } = ctx;
  const now = mskNow(at);
  if (!term) return { now, term: null, week: null, currentWeek: null, days: [], checkpointsThisWeek: [] };

  const currentWeek = Math.min(Math.max(termWeek(term.startsOn, now.date), 1), term.weeks);
  const shown = week && Number.isInteger(week) && week >= 1 && week <= term.weeks ? week : currentWeek;
  const monday = addDays(term.startsOn, (shown - 1) * 7);
  const sunday = addDays(monday, 6);

  const [{ slots, changes }, marks, cps] = await Promise.all([
    loadTimetable(ctx, monday, sunday),
    db
      .select({ slotId: attendance.slotId, date: attendance.date, status: attendance.status })
      .from(attendance)
      .where(and(eq(attendance.studentId, user.id), between(attendance.date, monday, sunday))),
    ctx.courses.length
      ? db
          .select({ courseId: checkpoints.courseId, number: checkpoints.number })
          .from(checkpoints)
          .where(and(inArray(checkpoints.courseId, ctx.courses.map((c) => c.id)), eq(checkpoints.week, shown)))
      : Promise.resolve([]),
  ]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const lessons = lessonsOn(date, slots, changes).map((l) => ({
      ...l,
      movedTo: null as string | null,
      attendance: marks.find((m) => m.slotId === l.slotId && m.date === l.date)?.status ?? null,
    }));
    // Пара, перенесённая на другой день, остаётся на своём месте зачёркнутой — иначе день выглядит пустым без объяснения.
    for (const c of changes) {
      if (c.kind !== "moved" || c.date !== date || !c.newDate || c.newDate === date) continue;
      const slot = slots.find((x) => x.id === c.slotId);
      if (!slot) continue;
      lessons.push({
        slotId: slot.id,
        courseId: slot.courseId,
        discipline: slot.discipline,
        teacher: slot.teacher,
        kind: slot.kind,
        date,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        room: slot.room,
        cancelled: true,
        change: { ...c, originalStartsAt: slot.startsAt, originalRoom: slot.room },
        movedTo: c.newDate,
        attendance: null,
      });
    }
    lessons.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return { date, isToday: date === now.date, isPast: date < now.date, lessons };
  }).filter((d, i) => i < 6 || d.lessons.length > 0); // воскресенье — только если в нём что-то есть

  const byCourse = new Map(ctx.courses.map((c) => [c.id, c.discipline]));
  return {
    now,
    term: { weeks: term.weeks },
    week: shown,
    currentWeek,
    days,
    checkpointsThisWeek: cps.map((c) => ({ discipline: byCourse.get(c.courseId)!, number: c.number })),
  };
}

export async function getGrades(at: Date = new Date()) {
  const ctx = await loadStudent();
  const { user, me, term } = ctx;
  const now = mskNow(at);
  const [perf, achievementRows] = await Promise.all([
    loadPerformance(ctx),
    term
      ? db
          .select({
            id: achievements.id,
            title: achievements.title,
            kind: achievementKinds.name,
            maxPoints: achievementKinds.maxPoints,
            status: achievements.status,
            points: achievements.points,
          })
          .from(achievements)
          .innerJoin(achievementKinds, eq(achievementKinds.id, achievements.kindId))
          .where(and(eq(achievements.studentId, user.id), eq(achievements.termId, term.id)))
          .orderBy(desc(achievements.createdAt))
      : Promise.resolve([]),
  ]);

  return {
    term: term && { name: term.name, weeks: term.weeks, week: termWeek(term.startsOn, now.date) },
    isPaid: me.isPaid,
    settings: perf.settings,
    courses: perf.courses,
    rating: perf.rating,
    activityPoints: perf.activityPoints,
    privileges: perf.rating ? privilegesFor(perf.rating, me.isPaid, perf.settings) : [],
    goal: perf.rating ? nextGoal(perf.rating, me.isPaid, perf.settings) : null,
    achievements: achievementRows,
  };
}

/** Данные для выписки рейтинга: только дисциплины, по которым уже есть балл. */
export async function getMyRatingSnapshot() {
  const ctx = await loadStudent();
  const perf = await loadPerformance(ctx);
  if (!ctx.term || !perf.rating) return null;
  return {
    term: ctx.term.name,
    rows: perf.courses
      .filter((c) => c.result)
      .map((c) => ({
        discipline: c.discipline,
        assessment: c.assessment,
        score: Math.round(c.result!.score * 10) / 10,
        mark: MARK_LABEL[markFor(c.result!.score, perf.settings)],
      })),
    rating: perf.rating.rating,
    base: perf.rating.base,
    bonus: perf.rating.bonus,
    forecast: perf.rating.forecast,
  };
}

/**
 * Напоминания о срезах: ближайшие две недели, только те, по которым балла ещё нет.
 * Не хранятся в базе, а считаются из плана срезов, поэтому не устаревают и не дублируются.
 */
export async function getCheckpointReminders(at: Date = new Date()) {
  const ctx = await loadStudent();
  const { user, term } = ctx;
  if (!term || ctx.courses.length === 0) return [];
  const week = termWeek(term.startsOn, mskNow(at).date);
  const rows = await db
    .select({ courseId: checkpoints.courseId, number: checkpoints.number, week: checkpoints.week })
    .from(checkpoints)
    .leftJoin(
      checkpointScores,
      and(eq(checkpointScores.checkpointId, checkpoints.id), eq(checkpointScores.studentId, user.id)),
    )
    .where(
      and(
        inArray(
          checkpoints.courseId,
          ctx.courses.map((c) => c.id),
        ),
        between(checkpoints.week, week, week + 2),
        isNull(checkpointScores.score),
      ),
    )
    .orderBy(asc(checkpoints.week), asc(checkpoints.number));

  const discipline = new Map(ctx.courses.map((c) => [c.id, c.discipline]));
  const byWeek = new Map<number, { week: number; inWeeks: number; startsOn: string; items: { discipline: string; number: number }[] }>();
  for (const r of rows) {
    const entry = byWeek.get(r.week) ?? {
      week: r.week,
      inWeeks: r.week - week,
      startsOn: addDays(term.startsOn, (r.week - 1) * 7),
      items: [],
    };
    entry.items.push({ discipline: discipline.get(r.courseId)!, number: r.number });
    byWeek.set(r.week, entry);
  }
  return [...byWeek.values()].map((w) => ({
    ...w,
    items: w.items.sort((a, b) => a.discipline.localeCompare(b.discipline, "ru")),
  }));
}
