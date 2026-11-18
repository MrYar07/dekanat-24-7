import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { courseFeedback, courseFeedbackVotes, courses, disciplines, studentProfiles, terms, users } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { parseFeedback, type FeedbackErrors } from "@/lib/feedback";

// Оценка преподавания глазами студента: курсы своей группы в текущем триместре.
// Ответ анонимный: в course_feedback нет ни id студента, ни времени. Отдельно хранится только то,
// что студент уже ответил на этот курс, — чтобы не ответить дважды.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const short = (last: string, first: string, middle: string | null) => `${last} ${first[0]}.${middle ? ` ${middle[0]}.` : ""}`;

/** Курсы текущего триместра своей группы и ответил ли уже студент. */
export async function getMyFeedbackCourses() {
  const user = await requireRole("student");
  const rows = await db
    .select({
      id: courses.id,
      discipline: disciplines.name,
      teacherLast: users.lastName,
      teacherFirst: users.firstName,
      teacherMiddle: users.middleName,
      voted: courseFeedbackVotes.studentId,
    })
    .from(studentProfiles)
    .innerJoin(courses, eq(courses.groupId, studentProfiles.groupId))
    .innerJoin(terms, and(eq(terms.id, courses.termId), eq(terms.isCurrent, true)))
    .innerJoin(disciplines, eq(disciplines.id, courses.disciplineId))
    .innerJoin(users, eq(users.id, courses.teacherId))
    .leftJoin(courseFeedbackVotes, and(eq(courseFeedbackVotes.courseId, courses.id), eq(courseFeedbackVotes.studentId, user.id)))
    .where(eq(studentProfiles.userId, user.id))
    .orderBy(asc(disciplines.name));
  return rows.map(({ teacherLast, teacherFirst, teacherMiddle, voted, ...c }) => ({
    ...c,
    teacher: short(teacherLast, teacherFirst, teacherMiddle),
    voted: voted !== null,
  }));
}

/** Один курс для формы. Чужой курс, прошлый триместр или мусор в адресе — null (страница отдаст 404). */
export async function getMyFeedbackCourse(courseId: string) {
  const user = await requireRole("student");
  if (!UUID.test(courseId)) return null;
  const [row] = await db
    .select({
      id: courses.id,
      discipline: disciplines.name,
      teacherLast: users.lastName,
      teacherFirst: users.firstName,
      teacherMiddle: users.middleName,
      voted: courseFeedbackVotes.studentId,
    })
    .from(studentProfiles)
    .innerJoin(courses, and(eq(courses.groupId, studentProfiles.groupId), eq(courses.id, courseId)))
    .innerJoin(terms, and(eq(terms.id, courses.termId), eq(terms.isCurrent, true)))
    .innerJoin(disciplines, eq(disciplines.id, courses.disciplineId))
    .innerJoin(users, eq(users.id, courses.teacherId))
    .leftJoin(courseFeedbackVotes, and(eq(courseFeedbackVotes.courseId, courses.id), eq(courseFeedbackVotes.studentId, user.id)))
    .where(eq(studentProfiles.userId, user.id));
  if (!row) return null;
  const { teacherLast, teacherFirst, teacherMiddle, voted, ...c } = row;
  return { ...c, teacher: short(teacherLast, teacherFirst, teacherMiddle), voted: voted !== null };
}

export type FeedbackResult = { ok: true } | { ok: false; error: string; fields?: FeedbackErrors };

/** Сохранить ответ. Один раз на курс: изменить ответ потом нельзя — он ни с кем не связан. */
export async function submitMyFeedback(courseId: string, raw: Record<string, unknown>): Promise<FeedbackResult> {
  const user = await requireRole("student");
  if (!UUID.test(courseId)) return { ok: false, error: "Курс не найден" };
  const parsed = parseFeedback(raw);
  if (!parsed.ok) return { ok: false, error: "Проверь ответы", fields: parsed.errors };

  return db.transaction(async (tx) => {
    // Курс своей группы и текущего триместра.
    const [course] = await tx
      .select({ id: courses.id })
      .from(studentProfiles)
      .innerJoin(courses, and(eq(courses.groupId, studentProfiles.groupId), eq(courses.id, courseId)))
      .innerJoin(terms, and(eq(terms.id, courses.termId), eq(terms.isCurrent, true)))
      .where(eq(studentProfiles.userId, user.id));
    if (!course) return { ok: false, error: "Курс не найден" } as const;

    const [vote] = await tx
      .insert(courseFeedbackVotes)
      .values({ courseId, studentId: user.id })
      .onConflictDoNothing()
      .returning({ courseId: courseFeedbackVotes.courseId });
    if (!vote) {
      // Проверка для слоя доступа и для понятного ответа: этот студент уже отвечал.
      const [already] = await tx
        .select({ courseId: courseFeedbackVotes.courseId })
        .from(courseFeedbackVotes)
        .where(and(eq(courseFeedbackVotes.courseId, courseId), eq(courseFeedbackVotes.studentId, user.id)));
      return { ok: false, error: already ? "Курс уже оценён" : "Не получилось сохранить ответ" } as const;
    }
    await tx.insert(courseFeedback).values({ courseId, ...parsed.value });
    return { ok: true } as const;
  });
}
