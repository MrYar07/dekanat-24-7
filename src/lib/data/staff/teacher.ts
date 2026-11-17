import "server-only";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  attendance,
  checkpointScores,
  checkpoints,
  courseFeedback,
  courseResults,
  courses,
  disciplines,
  groups,
  lessonChanges,
  notifications,
  studentProfiles,
  terms,
  timetableSlots,
  users,
} from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { DEFAULT_SETTINGS } from "@/lib/grading";
import { summarize } from "@/lib/feedback";
import { lessonKey, startedLessons, type Change, type Slot } from "@/lib/schedule";
import { formatDay, mskNow } from "@/lib/time";

// Преподаватель: только свои курсы текущего триместра. Всё, что принимает id курса, ищет его
// ТОЛЬКО среди курсов преподавателя из сессии: чужой курс неотличим от несуществующего (404).
// Баллы можно ставить только студентам группы этого курса.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getMyCourses(at: Date = new Date()) {
  const user = await requireRole("teacher");
  const rows = await db
    .select({
      id: courses.id,
      discipline: disciplines.name,
      group: groups.name,
      groupId: courses.groupId,
      assessment: courses.assessment,
      termStartsOn: terms.startsOn,
      termWeeks: terms.weeks,
    })
    .from(courses)
    .innerJoin(disciplines, eq(disciplines.id, courses.disciplineId))
    .innerJoin(groups, eq(groups.id, courses.groupId))
    .innerJoin(terms, and(eq(terms.id, courses.termId), eq(terms.isCurrent, true)))
    .where(eq(courses.teacherId, user.id))
    .orderBy(asc(disciplines.name), asc(groups.name));
  if (rows.length === 0) return [];

  const [students, cps, graded] = await Promise.all([
    db
      .select({ groupId: studentProfiles.groupId, n: count() })
      .from(studentProfiles)
      .where(inArray(studentProfiles.groupId, [...new Set(rows.map((r) => r.groupId))]))
      .groupBy(studentProfiles.groupId),
    db
      .select({ id: checkpoints.id, courseId: checkpoints.courseId, number: checkpoints.number, week: checkpoints.week })
      .from(checkpoints)
      .where(
        inArray(
          checkpoints.courseId,
          rows.map((r) => r.id),
        ),
      )
      .orderBy(asc(checkpoints.number)),
    db
      .select({ checkpointId: checkpointScores.checkpointId, n: count() })
      .from(checkpointScores)
      .innerJoin(checkpoints, eq(checkpoints.id, checkpointScores.checkpointId))
      .where(
        inArray(
          checkpoints.courseId,
          rows.map((r) => r.id),
        ),
      )
      .groupBy(checkpointScores.checkpointId),
  ]);

  // Последняя прошедшая пара каждого курса и сколько на ней отмечено: напоминание отметить посещаемость.
  const { slots, changes } = await timetableOf(rows.map((r) => r.id));
  const now = mskNow(at);
  const last = new Map(
    rows.map((r) => {
      const own = slots.filter((x) => x.courseId === r.id);
      const ids = new Set(own.map((x) => x.id));
      const lesson = startedLessons({ startsOn: r.termStartsOn, weeks: r.termWeeks }, own, changes.filter((c) => ids.has(c.slotId)), now)[0];
      return [r.id, lesson ?? null] as const;
    }),
  );
  const lastLessons = [...last.values()].filter((l) => l !== null);
  const marked = lastLessons.length
    ? await db
        .select({ slotId: attendance.slotId, date: attendance.date, n: count() })
        .from(attendance)
        .where(
          and(
            inArray(
              attendance.slotId,
              lastLessons.map((l) => l.slotId),
            ),
            inArray(
              attendance.date,
              lastLessons.map((l) => l.date),
            ),
          ),
        )
        .groupBy(attendance.slotId, attendance.date)
    : [];

  return rows.map((r) => ({
    ...r,
    lastLesson: (() => {
      const l = last.get(r.id);
      if (!l) return null;
      return {
        date: l.date,
        startsAt: l.startsAt,
        marked: marked.find((m) => m.slotId === l.slotId && m.date === l.date)?.n ?? 0,
      };
    })(),
    students: students.find((s) => s.groupId === r.groupId)?.n ?? 0,
    checkpoints: cps
      .filter((c) => c.courseId === r.id)
      .map((c) => ({ number: c.number, week: c.week, graded: graded.find((g) => g.checkpointId === c.id)?.n ?? 0 })),
  }));
}

/** Курс текущего триместра, только если его ведёт этот преподаватель. null — чужой, несуществующий или из архива:
 * баллы закрытого триместра уже итоговые, менять их нельзя. */
async function ownCourse(courseId: string, teacherId: string) {
  if (!UUID.test(courseId)) return null;
  const [c] = await db
    .select({
      id: courses.id,
      groupId: courses.groupId,
      discipline: disciplines.name,
      group: groups.name,
      assessment: courses.assessment,
      termStartsOn: terms.startsOn,
      termWeeks: terms.weeks,
    })
    .from(courses)
    .innerJoin(disciplines, eq(disciplines.id, courses.disciplineId))
    .innerJoin(groups, eq(groups.id, courses.groupId))
    .innerJoin(terms, and(eq(terms.id, courses.termId), eq(terms.isCurrent, true)))
    .where(and(eq(courses.id, courseId), eq(courses.teacherId, teacherId)));
  return c ?? null;
}

/** Журнал курса: студенты группы и баллы за выбранный срез (по умолчанию — первый невыставленный). */
export async function getMyCourseJournal(courseId: string, cpNumber?: number) {
  const user = await requireRole("teacher");
  const course = await ownCourse(courseId, user.id);
  if (!course) return null;

  const [cps, students] = await Promise.all([
    db
      .select({ id: checkpoints.id, number: checkpoints.number, week: checkpoints.week })
      .from(checkpoints)
      .where(eq(checkpoints.courseId, course.id))
      .orderBy(asc(checkpoints.number)),
    db
      .select({ id: users.id, lastName: users.lastName, firstName: users.firstName, middleName: users.middleName })
      .from(studentProfiles)
      .innerJoin(users, eq(users.id, studentProfiles.userId))
      .where(eq(studentProfiles.groupId, course.groupId))
      .orderBy(asc(users.lastName), asc(users.firstName)),
  ]);
  if (cps.length === 0) return { course, checkpoints: [], selected: null, students: [] };

  const scores = await db
    .select({ checkpointId: checkpointScores.checkpointId, studentId: checkpointScores.studentId, score: checkpointScores.score })
    .from(checkpointScores)
    .where(
      inArray(
        checkpointScores.checkpointId,
        cps.map((c) => c.id),
      ),
    );

  const summary = cps.map((c) => ({
    number: c.number,
    week: c.week,
    graded: scores.filter((s) => s.checkpointId === c.id).length,
  }));
  const firstOpen = summary.find((c) => c.graded < students.length)?.number ?? cps.at(-1)!.number;
  const selected = cps.find((c) => c.number === cpNumber) ?? cps.find((c) => c.number === firstOpen)!;

  return {
    course,
    checkpoints: summary,
    selected: { number: selected.number, week: selected.week },
    students: students.map((s) => ({
      id: s.id,
      name: `${s.lastName} ${s.firstName}${s.middleName ? ` ${s.middleName}` : ""}`,
      score: scores.find((x) => x.checkpointId === selected.id && x.studentId === s.id)?.score ?? null,
      // Баллы за другие срезы — для контекста в строке студента.
      others: cps
        .filter((c) => c.id !== selected.id)
        .map((c) => ({ number: c.number, score: scores.find((x) => x.checkpointId === c.id && x.studentId === s.id)?.score ?? null })),
    })),
  };
}

export type ScoreEntry = { studentId: string; score: number | null };
export type SaveScoresResult = { ok: true; saved: number; cleared: number } | { ok: false; error: string };

/**
 * Сохранить баллы за срез. Пустое значение — балл снят. Новым и изменённым баллам студент
 * получает уведомление «Новый балл»; рейтинг у него пересчитается сам при следующем открытии.
 */
export async function saveMyCheckpointScores(courseId: string, cpNumber: number, entries: ScoreEntry[]): Promise<SaveScoresResult> {
  const user = await requireRole("teacher");
  const course = await ownCourse(courseId, user.id);
  if (!course) return { ok: false, error: "Курс не найден" };
  if (entries.some((e) => e.score !== null && (!Number.isInteger(e.score) || e.score < 0 || e.score > 100))) {
    return { ok: false, error: "Балл — целое число от 0 до 100" };
  }

  return db.transaction(async (tx) => {
    const [cp] = await tx
      .select({ id: checkpoints.id })
      .from(checkpoints)
      .where(and(eq(checkpoints.courseId, course.id), eq(checkpoints.number, cpNumber)));
    if (!cp) return { ok: false, error: "Такого среза нет" } as const;

    // Ставить можно только студентам группы этого курса: чужие id молча отбрасываются.
    const groupStudents = await tx
      .select({ id: studentProfiles.userId })
      .from(studentProfiles)
      .where(eq(studentProfiles.groupId, course.groupId));
    const allowed = new Set(groupStudents.map((s) => s.id));
    const valid = entries.filter((e) => allowed.has(e.studentId));
    if (valid.length === 0) return { ok: true, saved: 0, cleared: 0 } as const;

    const before = await tx
      .select({ studentId: checkpointScores.studentId, score: checkpointScores.score })
      .from(checkpointScores)
      .where(
        and(
          eq(checkpointScores.checkpointId, cp.id),
          inArray(
            checkpointScores.studentId,
            valid.map((e) => e.studentId),
          ),
        ),
      );
    const prev = new Map(before.map((b) => [b.studentId, b.score]));
    const now = new Date();

    const changed = valid.filter((e) => e.score !== null && prev.get(e.studentId) !== e.score) as { studentId: string; score: number }[];
    const cleared = valid.filter((e) => e.score === null && prev.has(e.studentId));

    for (const e of changed) {
      await tx
        .insert(checkpointScores)
        .values({ checkpointId: cp.id, studentId: e.studentId, score: e.score, gradedAt: now })
        .onConflictDoUpdate({
          target: [checkpointScores.checkpointId, checkpointScores.studentId],
          set: { score: e.score, gradedAt: now },
        });
    }
    if (cleared.length) {
      await tx.delete(checkpointScores).where(
        and(
          eq(checkpointScores.checkpointId, cp.id),
          inArray(
            checkpointScores.studentId,
            cleared.map((e) => e.studentId),
          ),
        ),
      );
    }
    if (changed.length) {
      await tx.insert(notifications).values(
        changed.map((e) => ({
          userId: e.studentId,
          kind: "score" as const,
          title: `${prev.has(e.studentId) ? "Балл исправлен" : "Новый балл"}: ${course.discipline}`,
          body: `Срез ${cpNumber} — ${e.score}`,
          href: "/grades",
          createdAt: now,
        })),
      );
    }
    return { ok: true, saved: changed.length, cleared: cleared.length } as const;
  });
}

// ——— Посещаемость ———

export type AttendanceMark = "present" | "absent" | "excused";
const MARKS: readonly string[] = ["present", "absent", "excused"];
export type AttendanceEntry = { studentId: string; status: AttendanceMark | null };
export type SaveAttendanceResult = { ok: true; saved: number; cleared: number; absent: number } | { ok: false; error: string };

/** Сетка и изменения курсов: из них считаются пары, которые уже прошли. Имена для Slot здесь не нужны. */
async function timetableOf(courseIds: string[]) {
  if (courseIds.length === 0) return { slots: [] as Slot[], changes: [] as Change[] };
  const rows = await db.select().from(timetableSlots).where(inArray(timetableSlots.courseId, courseIds));
  const slots: Slot[] = rows.map((r) => ({
    id: r.id,
    courseId: r.courseId,
    discipline: "",
    teacher: "",
    kind: r.kind,
    weekday: r.weekday,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    room: r.room,
  }));
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
        .where(
          inArray(
            lessonChanges.slotId,
            slots.map((x) => x.id),
          ),
        )
    : [];
  return { slots, changes };
}

const fullName = (s: { lastName: string; firstName: string; middleName: string | null }) =>
  `${s.lastName} ${s.firstName}${s.middleName ? ` ${s.middleName}` : ""}`;

/**
 * Посещаемость курса: прошедшие пары (сегодняшняя — как только началась) и отметки студентов
 * на выбранной паре. key — пара из адреса страницы; неверный — показываем последнюю.
 */
export async function getMyCourseAttendance(courseId: string, key?: string, at: Date = new Date()) {
  const user = await requireRole("teacher");
  const course = await ownCourse(courseId, user.id);
  if (!course) return null;

  const [{ slots, changes }, students] = await Promise.all([
    timetableOf([course.id]),
    db
      .select({ id: users.id, lastName: users.lastName, firstName: users.firstName, middleName: users.middleName })
      .from(studentProfiles)
      .innerJoin(users, eq(users.id, studentProfiles.userId))
      .where(eq(studentProfiles.groupId, course.groupId))
      .orderBy(asc(users.lastName), asc(users.firstName)),
  ]);
  const lessons = startedLessons({ startsOn: course.termStartsOn, weeks: course.termWeeks }, slots, changes, mskNow(at));
  const marks = slots.length
    ? await db
        .select({ slotId: attendance.slotId, date: attendance.date, studentId: attendance.studentId, status: attendance.status })
        .from(attendance)
        .where(
          inArray(
            attendance.slotId,
            slots.map((x) => x.id),
          ),
        )
    : [];

  const summary = lessons.map((l) => ({
    key: lessonKey(l),
    date: l.date,
    startsAt: l.startsAt,
    endsAt: l.endsAt,
    room: l.room,
    kind: l.kind,
    marked: marks.filter((m) => m.slotId === l.slotId && m.date === l.date).length,
  }));
  const selected = lessons.find((l) => lessonKey(l) === key) ?? lessons[0] ?? null;

  return {
    course,
    lessons: summary,
    selected: selected ? summary.find((x) => x.key === lessonKey(selected))! : null,
    students: students.map((s) => {
      const own = marks.filter((m) => m.studentId === s.id);
      return {
        id: s.id,
        name: fullName(s),
        status: selected ? (own.find((m) => m.slotId === selected.slotId && m.date === selected.date)?.status ?? null) : null,
        // Пропуски за триместр по этому курсу: видно, кому пора напомнить.
        absences: own.filter((m) => m.status === "absent").length,
      };
    }),
  };
}

/**
 * Сохранить отметки на паре. Отметить можно только пару своего курса, которая уже началась и не отменена,
 * и только студентов группы. null — отметка снята. За новый пропуск студент получает уведомление.
 */
export async function saveMyAttendance(courseId: string, key: string, entries: AttendanceEntry[], at: Date = new Date()): Promise<SaveAttendanceResult> {
  const user = await requireRole("teacher");
  const course = await ownCourse(courseId, user.id);
  if (!course) return { ok: false, error: "Курс не найден" };
  if (entries.some((e) => e.status !== null && !MARKS.includes(e.status))) return { ok: false, error: "Неизвестная отметка" };

  const { slots, changes } = await timetableOf([course.id]);
  const lesson = startedLessons({ startsOn: course.termStartsOn, weeks: course.termWeeks }, slots, changes, mskNow(at)).find(
    (l) => lessonKey(l) === key,
  );
  if (!lesson) return { ok: false, error: "Такой пары нет или она ещё не началась" };

  return db.transaction(async (tx) => {
    const groupStudents = await tx
      .select({ id: studentProfiles.userId })
      .from(studentProfiles)
      .where(eq(studentProfiles.groupId, course.groupId));
    const allowed = new Set(groupStudents.map((x) => x.id));
    const valid = entries.filter((e) => allowed.has(e.studentId));
    if (valid.length === 0) return { ok: true, saved: 0, cleared: 0, absent: 0 } as const;

    const before = await tx
      .select({ studentId: attendance.studentId, status: attendance.status })
      .from(attendance)
      .where(
        and(
          eq(attendance.slotId, lesson.slotId),
          eq(attendance.date, lesson.date),
          inArray(
            attendance.studentId,
            valid.map((e) => e.studentId),
          ),
        ),
      );
    const prev = new Map(before.map((b) => [b.studentId, b.status]));
    const changed = valid.filter((e) => e.status !== null && prev.get(e.studentId) !== e.status) as {
      studentId: string;
      status: AttendanceMark;
    }[];
    const cleared = valid.filter((e) => e.status === null && prev.has(e.studentId));

    for (const e of changed) {
      await tx
        .insert(attendance)
        .values({ slotId: lesson.slotId, date: lesson.date, studentId: e.studentId, status: e.status })
        .onConflictDoUpdate({ target: [attendance.slotId, attendance.date, attendance.studentId], set: { status: e.status } });
    }
    if (cleared.length) {
      await tx.delete(attendance).where(
        and(
          eq(attendance.slotId, lesson.slotId),
          eq(attendance.date, lesson.date),
          inArray(
            attendance.studentId,
            cleared.map((e) => e.studentId),
          ),
        ),
      );
    }
    // Уведомление — только о новом пропуске: «был» и «уважительная» студенту хуже не делают.
    const absent = changed.filter((e) => e.status === "absent");
    if (absent.length) {
      await tx.insert(notifications).values(
        absent.map((e) => ({
          userId: e.studentId,
          kind: "score" as const,
          title: `Пропуск: ${course.discipline}`,
          body: `${formatDay(lesson.date)}, ${lesson.startsAt}. Посещаемость входит в балл дисциплины. Если причина уважительная, принеси справку в деканат.`,
          href: "/grades",
          createdAt: at,
        })),
      );
    }
    return { ok: true, saved: changed.length, cleared: cleared.length, absent: absent.length } as const;
  });
}

/**
 * Отзывы студентов о курсе. Ниже порога — только число ответов: при двух-трёх ответах
 * легко догадаться, кто что поставил. Кто именно ответил, преподаватель не видит никогда.
 */
export async function getMyCourseFeedback(courseId: string) {
  const user = await requireRole("teacher");
  const course = await ownCourse(courseId, user.id);
  if (!course) return null;
  const [rows, [group]] = await Promise.all([
    db
      .select({
        clarity: courseFeedback.clarity,
        usefulness: courseFeedback.usefulness,
        fairness: courseFeedback.fairness,
        comment: courseFeedback.comment,
      })
      .from(courseFeedback)
      .where(eq(courseFeedback.courseId, course.id)),
    db.select({ n: count() }).from(studentProfiles).where(eq(studentProfiles.groupId, course.groupId)),
  ]);
  return { course, students: group?.n ?? 0, summary: summarize(rows) };
}

/**
 * Итоги триместра по курсу: активность на занятиях (0–100) и бонус за особые успехи (0–5).
 * Рядом — среднее по срезам, чтобы было видно, к чему добавляется бонус.
 */
export async function getMyCourseResults(courseId: string) {
  const user = await requireRole("teacher");
  const course = await ownCourse(courseId, user.id);
  if (!course) return null;
  const [students, results, scores] = await Promise.all([
    db
      .select({ id: users.id, lastName: users.lastName, firstName: users.firstName, middleName: users.middleName })
      .from(studentProfiles)
      .innerJoin(users, eq(users.id, studentProfiles.userId))
      .where(eq(studentProfiles.groupId, course.groupId))
      .orderBy(asc(users.lastName), asc(users.firstName)),
    db
      .select({ studentId: courseResults.studentId, activity: courseResults.activity, bonus: courseResults.bonus })
      .from(courseResults)
      .where(eq(courseResults.courseId, course.id)),
    db
      .select({ studentId: checkpointScores.studentId, score: checkpointScores.score })
      .from(checkpointScores)
      .innerJoin(checkpoints, eq(checkpoints.id, checkpointScores.checkpointId))
      .where(eq(checkpoints.courseId, course.id)),
  ]);
  return {
    course,
    bonusMax: DEFAULT_SETTINGS.teacherBonusMax,
    students: students.map((st) => {
      const r = results.find((x) => x.studentId === st.id);
      const own = scores.filter((x) => x.studentId === st.id && x.score !== null).map((x) => x.score!);
      return {
        id: st.id,
        name: [st.lastName, st.firstName, st.middleName].filter(Boolean).join(" "),
        activity: r?.activity ?? null,
        bonus: r?.bonus ?? 0,
        checkpointsMean: own.length ? Math.round((own.reduce((a, b) => a + b, 0) / own.length) * 10) / 10 : null,
      };
    }),
  };
}

export type ResultEntry = { studentId: string; activity: number | null; bonus: number };
export type SaveResultsResult = { ok: true; saved: number; bonuses: number } | { ok: false; error: string };

/**
 * Сохранить активность и бонус. Только студентам группы этого курса: чужие id отбрасываются.
 * О новом или увеличенном бонусе студент получает уведомление — это приятная новость.
 */
export async function saveMyCourseResults(courseId: string, entries: ResultEntry[]): Promise<SaveResultsResult> {
  const user = await requireRole("teacher");
  const course = await ownCourse(courseId, user.id);
  if (!course) return { ok: false, error: "Курс не найден" };
  const max = DEFAULT_SETTINGS.teacherBonusMax;
  for (const e of entries) {
    if (e.activity !== null && (!Number.isInteger(e.activity) || e.activity < 0 || e.activity > 100)) {
      return { ok: false, error: "Активность — целое число от 0 до 100" };
    }
    if (!Number.isInteger(e.bonus) || e.bonus < 0 || e.bonus > max) return { ok: false, error: `Бонус — целое число от 0 до ${max}` };
  }

  return db.transaction(async (tx) => {
    const group = await tx.select({ id: studentProfiles.userId }).from(studentProfiles).where(eq(studentProfiles.groupId, course.groupId));
    const ids = new Set(group.map((g) => g.id));
    const mine = entries.filter((e) => ids.has(e.studentId));
    if (!mine.length) return { ok: true, saved: 0, bonuses: 0 } as const;

    const before = await tx
      .select({ studentId: courseResults.studentId, activity: courseResults.activity, bonus: courseResults.bonus })
      .from(courseResults)
      .where(and(eq(courseResults.courseId, course.id), inArray(courseResults.studentId, mine.map((e) => e.studentId))));
    const changed = mine.filter((e) => {
      const b = before.find((x) => x.studentId === e.studentId);
      return (b?.activity ?? null) !== e.activity || (b?.bonus ?? 0) !== e.bonus;
    });
    if (!changed.length) return { ok: true, saved: 0, bonuses: 0 } as const;

    for (const e of changed) {
      await tx
        .insert(courseResults)
        .values({ courseId: course.id, studentId: e.studentId, activity: e.activity, bonus: e.bonus })
        .onConflictDoUpdate({
          target: [courseResults.courseId, courseResults.studentId],
          set: { activity: e.activity, bonus: e.bonus },
        });
    }
    const raised = changed.filter((e) => e.bonus > (before.find((x) => x.studentId === e.studentId)?.bonus ?? 0));
    if (raised.length) {
      await tx.insert(notifications).values(
        raised.map((e) => ({
          userId: e.studentId,
          kind: "score" as const,
          title: `Бонус за успехи: ${course.discipline}`,
          body: `+${e.bonus} к работе в триместре от преподавателя`,
          href: "/grades",
        })),
      );
    }
    return { ok: true, saved: changed.length, bonuses: raised.length } as const;
  });
}
