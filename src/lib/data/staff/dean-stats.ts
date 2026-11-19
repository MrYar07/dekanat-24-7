import "server-only";
import { and, asc, avg, count, desc, eq, gte, inArray, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import {
  achievements,
  checkpointScores,
  courseFeedback,
  courses,
  disciplines,
  documentTypes,
  groups,
  issuedDocuments,
  questions,
  requestEvents,
  requests,
  terms,
  users,
} from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { MIN_RESPONSES } from "@/lib/feedback";

// Сводка для деканата: что кабинет изменил по сравнению с бумажным порядком.
// Только счётчики по всем студентам, без персональных данных. Роль проверяет сама функция.

/** Сколько походов в деканат экономит мгновенная справка: попросить, забрать, поставить печать. */
export const VISITS_SAVED_INSTANT = 3;
/** Заявка с печатью: остаётся один поход — забрать готовое. */
export const VISITS_SAVED_REQUEST = 2;
/** Вопрос с ответом в кабинете: не понадобилось идти спрашивать в окно деканата. */
export const VISITS_SAVED_QUESTION = 1;

export async function getDeanStats(at: Date = new Date()) {
  await requireRole("dean_office");
  const weekAgo = new Date(at.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [[issued], byType, [handled], [speed], [scores], achievementRows, feedbackRows, questionRows] = await Promise.all([
    db.select({ n: count() }).from(issuedDocuments),
    db
      .select({ name: documentTypes.name, instant: documentTypes.instant, n: count() })
      .from(requests)
      .innerJoin(documentTypes, eq(documentTypes.id, requests.typeId))
      .groupBy(documentTypes.name, documentTypes.instant)
      .orderBy(desc(count())),
    db
      .select({ n: count() })
      .from(requests)
      .innerJoin(documentTypes, eq(documentTypes.id, requests.typeId))
      .where(and(eq(documentTypes.instant, false), inArray(requests.status, ["ready", "issued"]))),
    // От подачи до «готово», в часах: только заявки, которые ведёт деканат.
    db
      .select({
        hours: sql<number | null>`avg(extract(epoch from (${requestEvents.createdAt} - ${requests.createdAt})) / 3600)`.mapWith(Number),
        n: count(),
      })
      .from(requestEvents)
      .innerJoin(requests, eq(requests.id, requestEvents.requestId))
      .innerJoin(documentTypes, eq(documentTypes.id, requests.typeId))
      .where(and(eq(requestEvents.status, "ready"), eq(documentTypes.instant, false))),
    db.select({ n: count() }).from(checkpointScores).where(gte(checkpointScores.gradedAt, weekAgo)),
    db
      .select({ status: achievements.status, n: count(), points: sum(achievements.points).mapWith(Number) })
      .from(achievements)
      .groupBy(achievements.status),
    // Оценка преподавания: только средние по курсу. Комментарии деканат не видит — они для преподавателя.
    db
      .select({
        discipline: disciplines.name,
        group: groups.name,
        teacherLast: users.lastName,
        teacherFirst: users.firstName,
        teacherMiddle: users.middleName,
        n: count(),
        clarity: avg(courseFeedback.clarity).mapWith(Number),
        usefulness: avg(courseFeedback.usefulness).mapWith(Number),
        fairness: avg(courseFeedback.fairness).mapWith(Number),
      })
      .from(courseFeedback)
      .innerJoin(courses, eq(courses.id, courseFeedback.courseId))
      .innerJoin(terms, and(eq(terms.id, courses.termId), eq(terms.isCurrent, true)))
      .innerJoin(disciplines, eq(disciplines.id, courses.disciplineId))
      .innerJoin(groups, eq(groups.id, courses.groupId))
      .innerJoin(users, eq(users.id, courses.teacherId))
      .groupBy(disciplines.name, groups.name, users.lastName, users.firstName, users.middleName)
      .orderBy(asc(disciplines.name), asc(groups.name)),
    // Вопросы студентов: сколько ждут, сколько отвечено и через сколько в среднем приходит ответ.
    db
      .select({
        status: questions.status,
        n: count(),
        hours: sql<number | null>`avg(extract(epoch from (${questions.answeredAt} - ${questions.createdAt})) / 3600)`.mapWith(Number),
      })
      .from(questions)
      .groupBy(questions.status),
  ]);

  const instant = issued?.n ?? 0;
  const closed = handled?.n ?? 0;
  const achievement = (status: "pending" | "approved" | "rejected") => achievementRows.find((r) => r.status === status);
  const answered = questionRows.find((r) => r.status === "answered");
  const answeredCount = answered?.n ?? 0;

  return {
    visitsSaved: instant * VISITS_SAVED_INSTANT + closed * VISITS_SAVED_REQUEST + answeredCount * VISITS_SAVED_QUESTION,
    instant,
    closed,
    /** Среднее время от подачи до «готово» в часах. null — готовых заявок ещё не было. */
    hoursToReady: speed && speed.n > 0 && speed.hours !== null ? speed.hours : null,
    scoresThisWeek: scores?.n ?? 0,
    byType: byType.map((t) => ({ name: t.name, instant: t.instant, count: t.n })),
    questions: {
      open: questionRows.find((r) => r.status === "open")?.n ?? 0,
      answered: answeredCount,
      /** Среднее время от вопроса до ответа в часах. null — ответов ещё не было. */
      hoursToAnswer: answeredCount > 0 && answered?.hours != null ? answered.hours : null,
    },
    achievements: {
      pending: achievement("pending")?.n ?? 0,
      approved: achievement("approved")?.n ?? 0,
      rejected: achievement("rejected")?.n ?? 0,
      points: achievement("approved")?.points ?? 0,
    },
    // Как у преподавателя: курс с числом ответов ниже порога показывается только счётчиком.
    feedback: {
      courses: feedbackRows
        .filter((r) => r.n >= MIN_RESPONSES)
        .map((r) => ({
          discipline: r.discipline,
          group: r.group,
          teacher: `${r.teacherLast} ${r.teacherFirst[0]}.${r.teacherMiddle ? ` ${r.teacherMiddle[0]}.` : ""}`,
          responses: r.n,
          average: Math.round(((r.clarity + r.usefulness + r.fairness) / 3) * 10) / 10,
        })),
      hidden: feedbackRows.filter((r) => r.n < MIN_RESPONSES).length,
      responses: feedbackRows.reduce((a, r) => a + r.n, 0),
    },
  };
}
