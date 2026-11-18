// «Спроси деканат» без ИИ: вопрос разбирается по ключевым словам и ведёт к действию.
// PRD §5.8 разрешает этот режим: «если ИИ недоступен, строка работает как обычный поиск по разделам».
// Здесь только разбор текста. Данные студента подставляет страница, на сервере, из слоя доступа.

import { RATING_PERIODS, STUDY_PURPOSES, type DocumentCode } from "@/lib/documents/forms";

export type Intent =
  /** Заказать документ; для справки об обучении — сразу с выбранным назначением, для выписки — с периодом. */
  | { kind: "document"; code: DocumentCode; purpose?: (typeof STUDY_PURPOSES)[number]; period?: (typeof RATING_PERIODS)[number] }
  /** Карточка со средним баллом и рейтингом. */
  | { kind: "rating" }
  /** Карточка с парами: ближайшими, на сегодня или на завтра. */
  | { kind: "lessons"; day: "next" | "today" | "tomorrow" }
  /** Просто перейти в раздел. */
  | { kind: "section"; section: Section };

export const SECTIONS = {
  grades: { title: "Успеваемость", href: "/grades", hint: "баллы за срезы, прогноз и светофор по дисциплинам" },
  explain: { title: "Из чего мой рейтинг", href: "/grades/rating", hint: "разбор рейтинга по частям" },
  whatIf: { title: "Калькулятор «А если…»", href: "/grades/what-if", hint: "что будет с рейтингом при других баллах" },
  goal: { title: "Путь к цели", href: "/grades/goal", hint: "сколько набрать до стипендии, гранта или автомата" },
  standing: { title: "Место на курсе", href: "/grades#standing-title", hint: "место без фамилий и чужих баллов" },
  archive: { title: "Архив и годовой рейтинг", href: "/grades/archive", hint: "прошлые триместры и пересдачи" },
  feedback: { title: "Оценка преподавания", href: "/grades/feedback", hint: "анонимно оценить курсы триместра" },
  achievement: { title: "Добавить достижение", href: "/grades/achievements/new", hint: "олимпиада, конференция, публикация — баллы к рейтингу" },
  schedule: { title: "Расписание", href: "/schedule", hint: "неделя с переносами и отменами" },
  calendar: { title: "Расписание в календаре телефона", href: "/schedule/calendar", hint: "подписка для Google, Apple и Яндекса" },
  requests: { title: "Справки и заявки", href: "/requests", hint: "заказать документ и посмотреть статус" },
  notifications: { title: "Уведомления", href: "/notifications", hint: "оценки, заявки, переносы, объявления" },
  card: { title: "Электронный студенческий", href: "/profile/card", hint: "QR для входа и проверки" },
  profile: { title: "Профиль", href: "/profile", hint: "данные, тема, выход на всех устройствах" },
} as const;
export type Section = keyof typeof SECTIONS;

/** Нижний регистр, «ё» → «е», без знаков препинания и лишних пробелов. */
export function normalize(q: string): string {
  return q
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s%-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Есть ли в тексте слово, начинающееся с одной из основ: «военкомат» ловит и «военкомата», и «военкомату». */
const has = (text: string, ...stems: string[]) => stems.some((s) => new RegExp(`(^|\\s)${s}`).test(text));

const PARA = "пар(?:а|ы|у|е|ой|ам|ами|ах)?(?=\\s|$)";

const PURPOSES: { stems: string[]; purpose: (typeof STUDY_PURPOSES)[number] }[] = [
  { stems: ["военкомат", "военн", "армия", "армию", "призыв", "отсрочк"], purpose: "в военный комиссариат" },
  { stems: ["виз", "посольств", "консульств"], purpose: "в посольство для оформления визы" },
  { stems: ["банк", "кредит", "ипотек"], purpose: "в банк" },
  { stems: ["соцзащит", "социальн", "пособи", "мфц"], purpose: "в органы социальной защиты" },
  { stems: ["родител", "маме", "маму", "папе", "папу"], purpose: "по месту работы родителей" },
];

/**
 * Разобрать вопрос. Возвращает намерения по убыванию уверенности: первое — главный ответ,
 * остальные — «может быть, ты имел в виду». Пустой список — вопрос не понят.
 */
export function parseQuestion(raw: string): Intent[] {
  const q = normalize(raw);
  if (!q) return [];
  const out: Intent[] = [];
  const add = (i: Intent) => {
    if (!out.some((o) => JSON.stringify(o) === JSON.stringify(i))) out.push(i);
  };

  const wantsDocument = has(q, "справк", "документ", "выписк", "заявлени", "бумаг", "подтвержд");
  const purpose = PURPOSES.find((p) => has(q, ...p.stems))?.purpose;

  // Документы. Назначение без слова «справка» тоже считается: «в военкомат» понятно и так.
  if (has(q, "перезач", "перезачет")) add({ kind: "document", code: "recredit" });
  if (has(q, "академическ") || (has(q, "перевод", "перевестись", "отчисл") && !has(q, PARA))) add({ kind: "document", code: "academic" });
  if (wantsDocument && has(q, "стипенд")) add({ kind: "document", code: "scholarship" });
  if (has(q, "выписк") || (wantsDocument && has(q, "рейтинг", "оценк", "балл"))) {
    // «за всё время», «за все годы», «за весь период обучения» — выписка по всем триместрам.
    const allTime = has(q, "все время", "все годы", "весь период", "все триместр", "за все", "за весь", "полную", "полная");
    add(allTime ? { kind: "document", code: "rating", period: "всё время обучения" } : { kind: "document", code: "rating" });
  }
  if (purpose || (wantsDocument && has(q, "обучени", "учусь", "студент", "учебы", "учебе"))) add({ kind: "document", code: "study", purpose });

  // Пары. «Завтра» и «сегодня» важнее общего «расписание».
  // «пар» только как слово «пара» в падежах, иначе ловится «пароль».
  const aboutLessons = has(q, PARA, "занят", "лекци", "семинар", "аудитори", "кабинет", "расписан", "урок");
  if (aboutLessons || has(q, "завтра", "сегодня")) {
    if (has(q, "завтра")) add({ kind: "lessons", day: "tomorrow" });
    else if (has(q, "сегодня", "сейчас")) add({ kind: "lessons", day: "today" });
    else if (has(q, "где", "когда", "следующ", "ближайш", "перв", "во сколько", "какая", "какие")) add({ kind: "lessons", day: "next" });
  }

  // Баллы и рейтинг. «Справка о рейтинге» уже ушла в документы.
  const aboutScore = has(q, "средн", "балл", "рейтинг", "оценк", "успеваем", "срез");
  if (aboutScore && !wantsDocument) add({ kind: "rating" });
  if (has(q, "почему", "из чего", "как счита", "как посчита", "складыва", "формул")) add({ kind: "section", section: "explain" });
  if (has(q, "а если", "что если", "калькулятор", "посчитать", "если получу", "если сдам")) add({ kind: "section", section: "whatIf" });
  if (has(q, "сколько нужно", "сколько надо", "цель", "грант", "скидк", "автомат", "повышенн") || (has(q, "стипенд") && !wantsDocument))
    add({ kind: "section", section: "goal" });
  if (has(q, "место", "месте", "какой я", "сравни")) add({ kind: "section", section: "standing" });
  if (has(q, "архив", "прошл", "пересдач", "годов", "за год")) add({ kind: "section", section: "archive" });
  if (has(q, "отзыв", "анкет", "оценить препод", "оценка препод", "оценить курс", "пожаловаться", "жалоб"))
    add({ kind: "section", section: "feedback" });
  if (has(q, "достижен", "олимпиад", "конференц", "публикац", "грамот", "диплом", "конкурс")) add({ kind: "section", section: "achievement" });
  if (has(q, "пропуск", "посещаем", "прогул", "отметк")) add({ kind: "section", section: "grades" });

  // Разделы.
  if (has(q, "календар", "google", "гугл", "iphone", "айфон", "apple", "яндекс", "ics")) add({ kind: "section", section: "calendar" });
  if (aboutLessons || has(q, "перенос", "отмен")) add({ kind: "section", section: "schedule" });
  if (has(q, "заявк", "статус", "готов", "где моя", "забрать")) add({ kind: "section", section: "requests" });
  if (wantsDocument) add({ kind: "section", section: "requests" });
  if (has(q, "уведомлен", "новост", "объявлен")) add({ kind: "section", section: "notifications" });
  if (has(q, "студенческ", "студак", "qr", "кьюар", "пропуск в", "турникет", "вход в здани")) add({ kind: "section", section: "card" });
  if (has(q, "профил", "выйти", "выход", "парол", "тема", "темн", "почт", "телефон")) add({ kind: "section", section: "profile" });
  if (aboutScore && wantsDocument) add({ kind: "section", section: "grades" });

  return out;
}

/** Подсказки под пустой строкой: что умеет спрашивать. */
export const EXAMPLES = [
  "нужна справка в военкомат",
  "какой у меня средний балл?",
  "где завтра первая пара?",
  "сколько нужно до гранта",
  "выписка рейтинга",
  "добавить расписание в календарь",
] as const;

/**
 * Запасной поиск, когда вопрос не понят: разделы, в названии или описании которых встречается
 * начало слова из вопроса (не короче 4 букв). Так «стажировка» ничего не найдёт, а «студенческого» — найдёт.
 */
export function searchSections(raw: string): Section[] {
  const words = normalize(raw)
    .split(" ")
    .filter((w) => w.length >= 4)
    .map((w) => w.slice(0, Math.max(4, w.length - 2)));
  if (!words.length) return [];
  return (Object.keys(SECTIONS) as Section[]).filter((key) => {
    const text = normalize(`${SECTIONS[key].title} ${SECTIONS[key].hint}`);
    return words.some((w) => text.includes(w));
  });
}
