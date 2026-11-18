import "server-only";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { questions } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { checkQuestion, OPEN_LIMIT, type QuestionErrors } from "@/lib/questions";

// Вопросы студента деканату. Всё, что принимает id, ищет его ТОЛЬКО среди вопросов
// студента из сессии: чужой вопрос неотличим от несуществующего.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const columns = {
  id: questions.id,
  topic: questions.topic,
  text: questions.text,
  status: questions.status,
  answer: questions.answer,
  createdAt: questions.createdAt,
  answeredAt: questions.answeredAt,
};

/** Мои вопросы, новые сверху. */
export async function getMyQuestions() {
  const user = await requireRole("student");
  return db.select(columns).from(questions).where(eq(questions.studentId, user.id)).orderBy(desc(questions.createdAt)).limit(50);
}

/** Один вопрос. Чужой или мусор в адресе — null (страница отдаст 404). */
export async function getMyQuestion(questionId: string) {
  const user = await requireRole("student");
  if (!UUID.test(questionId)) return null;
  const [row] = await db
    .select(columns)
    .from(questions)
    .where(and(eq(questions.id, questionId), eq(questions.studentId, user.id)));
  return row ?? null;
}

export type AskResult = { ok: true; questionId: string } | { ok: false; error: string; fields?: QuestionErrors };

/** Задать вопрос. Без ответа одновременно — не больше OPEN_LIMIT вопросов. */
export async function askMyQuestion(raw: { topic?: unknown; text?: unknown }): Promise<AskResult> {
  const user = await requireRole("student");
  const parsed = checkQuestion(raw);
  if (!parsed.ok) return { ok: false, error: "Проверь вопрос", fields: parsed.errors };

  return db.transaction(async (tx) => {
    // Блокировка по студенту: две вкладки не обойдут предел, отправив вопросы одновременно.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`question:${user.id}`}))`);
    const [{ open }] = await tx
      .select({ open: count() })
      .from(questions)
      .where(and(eq(questions.studentId, user.id), eq(questions.status, "open")));
    if (open >= OPEN_LIMIT) {
      return {
        ok: false,
        error: `Вопросов без ответа: ${open}. Дождись ответа на них — обычно деканат отвечает в течение рабочего дня`,
      } as const;
    }
    const [q] = await tx
      .insert(questions)
      .values({ studentId: user.id, ...parsed.value })
      .returning({ id: questions.id });
    return { ok: true, questionId: q.id } as const;
  });
}
