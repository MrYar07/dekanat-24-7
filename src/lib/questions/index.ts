// «Написать в деканат»: темы, пределы и проверка вопроса и ответа.
// Без доступа к базе — чтобы правила проверялись юнит-тестами.

export const QUESTION_TOPICS = [
  "Учёба и оценки",
  "Расписание",
  "Справки и документы",
  "Стипендия и оплата",
  "Другое",
] as const;
export type QuestionTopic = (typeof QUESTION_TOPICS)[number];

export const TEXT_MIN = 10;
export const TEXT_MAX = 1000;
export const ANSWER_MAX = 2000;
/**
 * Сколько вопросов без ответа может быть у студента одновременно. Защита от потока вопросов:
 * деканат — живые люди, а пятый одинаковый вопрос не ускорит ответ на первый.
 */
export const OPEN_LIMIT = 3;
/** Сколько знаков ответа показать в уведомлении. Целиком ответ — на странице вопроса. */
export const PREVIEW_MAX = 140;

export const isQuestionTopic = (v: unknown): v is QuestionTopic =>
  typeof v === "string" && (QUESTION_TOPICS as readonly string[]).includes(v);

/** Пробелы по краям и подряд идущие пустые строки убираем: в очереди деканата текст читается целиком. */
const tidy = (s: string) =>
  s
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export type QuestionInput = { topic: QuestionTopic; text: string };
export type QuestionErrors = Partial<Record<"topic" | "text", string>>;

/** Вопрос из формы: тема из списка и текст от 10 до 1000 знаков. */
export function checkQuestion(raw: { topic?: unknown; text?: unknown }):
  | { ok: true; value: QuestionInput }
  | { ok: false; errors: QuestionErrors } {
  const errors: QuestionErrors = {};
  if (!isQuestionTopic(raw.topic)) errors.topic = "Выбери тему";
  const text = tidy(typeof raw.text === "string" ? raw.text : "");
  if (text.length < TEXT_MIN) errors.text = `Опиши вопрос хотя бы в паре слов — от ${TEXT_MIN} знаков`;
  else if (text.length > TEXT_MAX) errors.text = `Не длиннее ${TEXT_MAX} знаков`;
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { topic: raw.topic as QuestionTopic, text } };
}

/** Ответ сотрудника: не пустой и не длиннее 2000 знаков. */
export function checkAnswer(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const text = tidy(typeof raw === "string" ? raw : "");
  if (!text) return { ok: false, error: "Нужен текст ответа: его увидит студент" };
  if (text.length > ANSWER_MAX) return { ok: false, error: `Не длиннее ${ANSWER_MAX} знаков` };
  return { ok: true, value: text };
}

/**
 * Готовые ответы деканата на частые вопросы. Сотрудник вставляет текст в поле и правит под студента —
 * отправляется всегда то, что в поле. Первыми идут ответы, подходящие к теме вопроса.
 */
export const ANSWER_TEMPLATES: readonly { label: string; topics: readonly QuestionTopic[]; text: string }[] = [
  {
    label: "Справка в кабинете",
    topics: ["Справки и документы"],
    text: "Эту справку можно заказать прямо в кабинете, в разделе «Справки». Справка об обучении и выписка рейтинга готовы сразу, в PDF с QR-кодом: печать для них не нужна.",
  },
  {
    label: "Решает преподаватель",
    topics: ["Учёба и оценки"],
    text: "Это решает преподаватель дисциплины. Напиши ему после занятия или через кафедру. Если договориться не получится, задай вопрос снова — разберёмся.",
  },
  {
    label: "Принести оригинал",
    topics: ["Учёба и оценки", "Справки и документы"],
    text: "Принеси оригинал документа в деканат, каб. 214, в будни с 10 до 17. Копию сделаем на месте, оригинал сразу вернём.",
  },
  {
    label: "Смотреть в расписании",
    topics: ["Расписание"],
    text: "Актуальное расписание — в разделе «Расписание»: изменения появляются там сразу и приходят уведомлением. Если после обновления страницы занятия всё ещё накладываются, задай вопрос снова — поправим.",
  },
  {
    label: "Стипендия — в бухгалтерии",
    topics: ["Стипендия и оплата"],
    text: "Начисление стипендии ведёт бухгалтерия: каб. 118, в будни с 10 до 16. Возьми студенческий — хватит электронного из раздела «Профиль».",
  },
];

/** Готовые ответы для вопроса на тему topic: подходящие к теме — первыми. */
export function templatesFor(topic: string) {
  const fits = (t: (typeof ANSWER_TEMPLATES)[number]) => (t.topics as readonly string[]).includes(topic);
  return [...ANSWER_TEMPLATES.filter(fits), ...ANSWER_TEMPLATES.filter((t) => !fits(t))];
}

/** Начало ответа для уведомления: по границе слова и с многоточием, если не влез. */
export function preview(text: string, max = PREVIEW_MAX): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:—-]+$/, "")}…`;
}
