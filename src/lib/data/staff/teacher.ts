import "server-only";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  checkpointScores,
  checkpoints,
  courses,
  disciplines,
  groups,
  notifications,
  studentProfiles,
  terms,
  users,
} from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";

// Преподаватель: только свои курсы текущего триместра. Всё, что принимает id курса, ищет его
// ТОЛЬКО среди курсов преподавателя из сессии: чужой курс неотличим от несуществующего (404).
// Баллы можно ставить только студентам группы этого курса.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getMyCourses() {
  const user = await requireRole("teacher");
  const rows = await db
    .select({
      id: courses.id,
      discipline: disciplines.name,
      group: groups.name,
      groupId: courses.groupId,
      assessment: courses.assessment,
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

  return rows.map((r) => ({
    ...r,
    students: students.find((s) => s.groupId === r.groupId)?.n ?? 0,
    checkpoints: cps
      .filter((c) => c.courseId === r.id)
      .map((c) => ({ number: c.number, week: c.week, graded: graded.find((g) => g.checkpointId === c.id)?.n ?? 0 })),
  }));
}

/** Курс, только если его ведёт этот преподаватель. null — чужой или несуществующий. */
async function ownCourse(courseId: string, teacherId: string) {
  if (!UUID.test(courseId)) return null;
  const [c] = await db
    .select({
      id: courses.id,
      groupId: courses.groupId,
      discipline: disciplines.name,
      group: groups.name,
      assessment: courses.assessment,
    })
    .from(courses)
    .innerJoin(disciplines, eq(disciplines.id, courses.disciplineId))
    .innerJoin(groups, eq(groups.id, courses.groupId))
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
