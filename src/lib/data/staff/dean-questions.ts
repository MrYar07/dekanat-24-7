import "server-only";
import { and, asc, count, desc, eq, inArray, ne, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { groups, notifications, questions, studentProfiles, users } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { checkAnswer, preview } from "@/lib/questions";
import type { QueueFilter } from "./dean";

// Деканат: вопросы студентов и ответы на них. Вопросы стоят в той же очереди, что заявки
// на документы и достижения. Роль проверяет каждая функция.

type Status = (typeof questions.$inferSelect)["status"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Какие вопросы попадают под фильтры общей очереди. «Готовы» — только про документы. */
const STATUSES: Record<QueueFilter, readonly Status[] | null> = {
  active: ["open"],
  ready: [],
  done: ["answered"],
  all: null,
};

const studentName = (u: { lastName: string; firstName: string; middleName: string | null }) =>
  `${u.lastName} ${u.firstName}${u.middleName ? ` ${u.middleName}` : ""}`;

/** Вопросы для общей очереди деканата: те же фильтры, что у заявок. */
export async function getQuestionQueue(filter: QueueFilter = "active") {
  await requireRole("dean_office");
  const statuses = STATUSES[filter];
  const where: SQL | undefined = statuses ? inArray(questions.status, [...statuses]) : undefined;

  const [rows, counts] = await Promise.all([
    statuses?.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: questions.id,
            status: questions.status,
            topic: questions.topic,
            text: questions.text,
            createdAt: questions.createdAt,
            answeredAt: questions.answeredAt,
            lastName: users.lastName,
            firstName: users.firstName,
            middleName: users.middleName,
            group: groups.name,
          })
          .from(questions)
          .innerJoin(users, eq(users.id, questions.studentId))
          .innerJoin(studentProfiles, eq(studentProfiles.userId, questions.studentId))
          .innerJoin(groups, eq(groups.id, studentProfiles.groupId))
          .where(where)
          .orderBy(filter === "active" ? asc(questions.createdAt) : desc(questions.createdAt))
          .limit(200),
    db.select({ status: questions.status, n: count() }).from(questions).groupBy(questions.status),
  ]);

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c.n])) as Partial<Record<Status, number>>;
  const total = (keys: readonly Status[] | null) =>
    (keys ?? (["open", "answered"] as const)).reduce((s, k) => s + (byStatus[k] ?? 0), 0);

  return {
    items: rows.map((r) => ({ ...r, student: studentName(r), updatedAt: r.answeredAt ?? r.createdAt, preview: preview(r.text, 90) })),
    counts: Object.fromEntries(Object.entries(STATUSES).map(([k, keys]) => [k, total(keys)])) as Record<QueueFilter, number>,
  };
}

const staff = alias(users, "staff");

/** Карточка вопроса для деканата и прежние вопросы того же студента. null — если вопроса нет. */
export async function getQuestionForDean(questionId: string) {
  await requireRole("dean_office");
  if (!UUID.test(questionId)) return null;
  const [q] = await db
    .select({
      id: questions.id,
      status: questions.status,
      topic: questions.topic,
      text: questions.text,
      answer: questions.answer,
      createdAt: questions.createdAt,
      answeredAt: questions.answeredAt,
      studentId: questions.studentId,
      lastName: users.lastName,
      firstName: users.firstName,
      middleName: users.middleName,
      group: groups.name,
      course: groups.course,
      recordBook: studentProfiles.recordBookNumber,
      staffLast: staff.lastName,
      staffFirst: staff.firstName,
      staffMiddle: staff.middleName,
    })
    .from(questions)
    .innerJoin(users, eq(users.id, questions.studentId))
    .innerJoin(studentProfiles, eq(studentProfiles.userId, questions.studentId))
    .innerJoin(groups, eq(groups.id, studentProfiles.groupId))
    .leftJoin(staff, eq(staff.id, questions.answeredBy))
    .where(eq(questions.id, questionId));
  if (!q) return null;

  // Прежние вопросы студента: часто ответ уже был, или видно, что вопрос повторяется.
  const earlier = await db
    .select({ id: questions.id, topic: questions.topic, text: questions.text, status: questions.status, createdAt: questions.createdAt })
    .from(questions)
    .where(and(eq(questions.studentId, q.studentId), ne(questions.id, q.id)))
    .orderBy(desc(questions.createdAt))
    .limit(5);

  // id студента наружу не отдаём: странице он не нужен.
  const { staffLast, staffFirst, staffMiddle, ...rest } = q;
  delete (rest as Partial<typeof rest>).studentId;
  return {
    ...rest,
    student: studentName(q),
    // «Громов Д. П.» — как в шапке кабинета сотрудника.
    answeredBy: staffLast && staffFirst ? `${staffLast} ${staffFirst[0]}.${staffMiddle ? ` ${staffMiddle[0]}.` : ""}` : null,
    earlier: earlier.map((e) => ({ ...e, preview: preview(e.text, 90) })),
  };
}

export type AnswerResult = { ok: true } | { ok: false; error: string };

/** Ответить на вопрос. Один раз: ответ приходит студенту уведомлением и больше не меняется. */
export async function answerQuestion(questionId: string, raw: unknown): Promise<AnswerResult> {
  const user = await requireRole("dean_office");
  if (!UUID.test(questionId)) return { ok: false, error: "Вопрос не найден" };
  const parsed = checkAnswer(raw);
  if (!parsed.ok) return parsed;

  return db.transaction(async (tx) => {
    // FOR UPDATE: два сотрудника не ответят на один вопрос одновременно.
    const [q] = await tx
      .select({ status: questions.status, studentId: questions.studentId, topic: questions.topic })
      .from(questions)
      .where(eq(questions.id, questionId))
      .for("update");
    if (!q) return { ok: false, error: "Вопрос не найден" } as const;
    if (q.status !== "open") return { ok: false, error: "На этот вопрос уже ответили. Обновите страницу" } as const;

    const now = new Date();
    await tx
      .update(questions)
      .set({ status: "answered", answer: parsed.value, answeredBy: user.id, answeredAt: now })
      .where(eq(questions.id, questionId));
    await tx.insert(notifications).values({
      userId: q.studentId,
      kind: "question",
      title: `Деканат ответил: ${q.topic.toLowerCase()}`,
      body: preview(parsed.value),
      href: `/ask/${questionId}`,
      createdAt: now,
    });
    return { ok: true } as const;
  });
}
