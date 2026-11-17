// Оценка преподавания: вопросы, проверка ответа и сводка для преподавателя.
// Без доступа к базе — чтобы правила анонимности проверялись юнит-тестами.

export const QUESTIONS = [
  { key: "clarity", label: "Понятно объясняет", low: "непонятно", high: "очень понятно" },
  { key: "usefulness", label: "Занятия полезны", low: "бесполезно", high: "очень полезно" },
  { key: "fairness", label: "Справедливо оценивает", low: "несправедливо", high: "справедливо" },
] as const;
export type QuestionKey = (typeof QUESTIONS)[number]["key"];

/**
 * Сводку и комментарии преподаватель видит, только когда ответов не меньше порога.
 * При двух-трёх ответах легко догадаться, кто что поставил, — особенно в маленькой группе.
 */
export const MIN_RESPONSES = 5;
export const COMMENT_MAX = 500;

export type FeedbackInput = Record<QuestionKey, number> & { comment: string | null };
export type FeedbackErrors = Partial<Record<QuestionKey | "comment", string>>;

/** Разобрать ответ из формы. Каждая оценка — целое 1–5, комментарий необязателен. */
export function parseFeedback(raw: Record<string, unknown>): { ok: true; value: FeedbackInput } | { ok: false; errors: FeedbackErrors } {
  const errors: FeedbackErrors = {};
  const scores = {} as Record<QuestionKey, number>;
  for (const q of QUESTIONS) {
    const n = Number(raw[q.key]);
    if (!Number.isInteger(n) || n < 1 || n > 5) errors[q.key] = "Выбери оценку от 1 до 5";
    else scores[q.key] = n;
  }
  const comment = typeof raw.comment === "string" ? raw.comment.trim() : "";
  if (comment.length > COMMENT_MAX) errors.comment = `Не длиннее ${COMMENT_MAX} знаков`;
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { ...scores, comment: comment || null } };
}

export type FeedbackRow = Record<QuestionKey, number> & { comment: string | null };

export type FeedbackSummary =
  | { visible: false; count: number; needed: number }
  | {
      visible: true;
      count: number;
      questions: { key: QuestionKey; label: string; average: number; distribution: [number, number, number, number, number] }[];
      comments: string[];
    };

/**
 * Сводка для преподавателя. Ниже порога — только число ответов. Комментарии сортируются по тексту:
 * порядок строк в базе мог бы подсказать, кто ответил раньше.
 */
export function summarize(rows: FeedbackRow[]): FeedbackSummary {
  if (rows.length < MIN_RESPONSES) return { visible: false, count: rows.length, needed: MIN_RESPONSES - rows.length };
  return {
    visible: true,
    count: rows.length,
    questions: QUESTIONS.map((q) => {
      const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
      for (const r of rows) distribution[r[q.key] - 1]++;
      const average = Math.round((rows.reduce((s, r) => s + r[q.key], 0) / rows.length) * 10) / 10;
      return { key: q.key, label: q.label, average, distribution };
    }),
    comments: rows
      .map((r) => r.comment)
      .filter((c): c is string => !!c)
      .sort((a, b) => a.localeCompare(b, "ru")),
  };
}
