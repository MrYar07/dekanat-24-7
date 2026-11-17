import type { DemoLogin } from "./accounts";

// Сценарии для путеводителя: те же восемь, что в docs/PRD.md и docs/JURY.md.
// Формулировки без обращения на «ты» и «вы»: путеводитель виден и студенту, и сотруднику.

export type ScenarioStep = {
  /** Кто выполняет шаг. anyone — без входа (гость с телефоном). */
  as: DemoLogin | "anyone";
  text: string;
  /** Страница, с которой шаг начинается. */
  href?: string;
  /**
   * Шаг выполняется на той же странице, что и предыдущий, но под другим аккаунтом.
   * Значение — шаблон адреса, с которого можно перейти (например, страница заявки).
   */
  carryUrl?: string;
  /** Подсказка, если адрес не подходит под carryUrl. */
  carryHint?: string;
};

export type Scenario = { title: string; summary: string; steps: ScenarioStep[] };

export const SCENARIOS: Scenario[] = [
  {
    title: "Утро студента",
    summary: "Всё важное на одном экране.",
    steps: [
      {
        as: "student1",
        href: "/",
        text: "Экран «Сегодня»: ближайшая пара с аудиторией, изменения в расписании, свежие баллы и заявки.",
      },
    ],
  },
  {
    title: "Справка за минуту",
    summary: "PDF с QR-кодом без похода в деканат.",
    steps: [
      {
        as: "student1",
        // Тот же путь, что у студента, который не знает, где искать: вопрос своими словами.
        href: `/ask?q=${encodeURIComponent("нужна справка в военкомат")}`,
        text: "Спросить своими словами: «нужна справка в военкомат». «Открыть заполненную форму» — назначение уже выбрано — и «Сформировать PDF».",
      },
      { as: "student1", text: "Справка готова сразу. Открыть PDF: внизу QR-код для проверки подлинности." },
    ],
  },
  {
    title: "Справка с печатью",
    summary: "Заявка идёт от студента в деканат и обратно.",
    steps: [
      { as: "student2", href: "/requests/new/scholarship", text: "Заказать справку о размере стипендии: «Отправить в деканат»." },
      {
        as: "dean",
        href: "/staff",
        text: "Новая заявка — внизу очереди. Открыть её, «Взять в работу», затем «Готово» с комментарием для студента.",
      },
      { as: "student2", href: "/notifications", text: "Пришло уведомление «Готово». В заявке виден комментарий деканата." },
    ],
  },
  {
    title: "Живые оценки",
    summary: "Балл виден через секунды, а не в конце триместра.",
    steps: [
      { as: "student2", href: "/grades", text: "Карточка «Английский язык»: до автомата по зачёту немного не хватает." },
      {
        as: "teacher",
        href: "/staff",
        text: "«Английский язык», группа МП-23-2 → «Срез 3» → поставить Ветрову 80 или больше → «Сохранить срез 3».",
      },
      { as: "student2", href: "/grades", text: "Уведомление «Новый балл». В карточке английского теперь автомат, рейтинг пересчитан." },
      {
        as: "teacher",
        href: "/staff",
        text: "Под карточкой курса — «Посещаемость» последней пары: «Остальные были», кого нет — «пропуск», «Сохранить отметки». О пропуске студент узнаёт сразу.",
      },
    ],
  },
  {
    title: "«Что нужно, чтобы…»",
    summary: "Рейтинг перестаёт быть чёрным ящиком.",
    steps: [
      {
        as: "student1",
        href: "/grades",
        text: "В карточках дисциплин подсказки: сколько нужно на срезе до автомата и на экзамене до «отлично».",
      },
      { as: "student1", href: "/grades/rating", text: "«Из чего он складывается»: расчёт рейтинга по шагам и графики срезов." },
      { as: "student1", href: "/grades/goal", text: "«Путь к цели»: кабинет сам подбирает, что получить на срезах и экзаменах, чтобы выйти на грант." },
      { as: "student1", href: "/grades/what-if", text: "«А если…»: подвигать ползунки и увидеть, каким станет рейтинг и что он даст." },
      { as: "student1", href: "/grades/archive", text: "«Архив и годовой рейтинг»: прошлый год закрыт, до гранта не хватило 0,4. Любой триместр открывается с оценками." },
    ],
  },
  {
    title: "Достижение в рейтинг",
    summary: "Олимпиада превращается в баллы рейтинга.",
    steps: [
      {
        as: "student1",
        href: "/grades/achievements/new",
        text: "Вид «Призовое место на олимпиаде», название, файл или ссылка → «Отправить в деканат».",
      },
      {
        as: "dean",
        href: "/staff",
        text: "Достижение в очереди помечено словом «достижение». Открыть, проверить подтверждение, поставить баллы → «Засчитать баллы».",
      },
      { as: "student1", href: "/grades", text: "Уведомление «Достижение засчитано». Рейтинг вырос: каждый балл даёт +0,04." },
    ],
  },
  {
    title: "Разделение данных",
    summary: "Чужие данные для студента не существуют.",
    steps: [
      { as: "student1", href: "/requests", text: "Открыть любую заявку из списка «Мои заявки»." },
      {
        as: "student2",
        carryUrl: "^/requests/[0-9a-f-]{36}$",
        carryHint: "Сначала нужно открыть заявку Алины: «Справки» → любая из списка «Мои заявки».",
        text: "Ответ — «Такой страницы нет». Заявка Алины для Матвея не существует: её нельзя ни открыть, ни скачать.",
      },
    ],
  },
  {
    title: "Проверка справки",
    summary: "Справку и студенческий проверяет кто угодно, без входа.",
    steps: [
      { as: "student1", href: "/requests", text: "Открыть справку об обучении. Если её ещё нет — сначала сценарий 2." },
      {
        as: "anyone",
        text: "Навести камеру телефона на QR-код в PDF или скопировать ссылку проверки и открыть её в окне инкогнито. Страница покажет вид документа, дату и отметку «подлинная».",
      },
      {
        as: "student1",
        href: "/profile/card",
        text: "Электронный студенческий: QR меняется каждую минуту. «Открыть проверку» — то, что увидит охранник: фамилия с инициалами, факультет, курс и печать «действует».",
      },
    ],
  },
];

export type GuideState = {
  /** Номер открытого сценария с нуля. null — сценарий не выбран. */
  scenario: number | null;
  step: number;
  /** Пройденные сценарии. */
  done: number[];
  /** Плашка шага свёрнута в кнопку. */
  collapsed: boolean;
};

export const EMPTY_GUIDE: GuideState = { scenario: null, step: 0, done: [], collapsed: false };

/** Состояние из localStorage: что угодно непонятное превращается в пустое. */
export function parseGuide(raw: string | null): GuideState {
  if (!raw) return EMPTY_GUIDE;
  try {
    const v = JSON.parse(raw) as Partial<GuideState> | null;
    if (!v || typeof v !== "object") return EMPTY_GUIDE;
    const scenario = typeof v.scenario === "number" && SCENARIOS[v.scenario] ? v.scenario : null;
    const last = scenario === null ? 0 : SCENARIOS[scenario].steps.length - 1;
    const step = typeof v.step === "number" && Number.isInteger(v.step) ? Math.min(Math.max(v.step, 0), last) : 0;
    const done = Array.isArray(v.done) ? [...new Set(v.done.filter((n) => Number.isInteger(n) && SCENARIOS[n]))] : [];
    return { scenario, step, done, collapsed: v.collapsed === true };
  } catch {
    return EMPTY_GUIDE;
  }
}

/** Следующий шаг. После последнего сценарий отмечается пройденным и закрывается. */
export function advance(s: GuideState): GuideState {
  if (s.scenario === null) return s;
  if (s.step < SCENARIOS[s.scenario].steps.length - 1) return { ...s, step: s.step + 1, collapsed: false };
  return { scenario: null, step: 0, done: [...new Set([...s.done, s.scenario])].sort((a, b) => a - b), collapsed: false };
}

export const back = (s: GuideState): GuideState => (s.scenario === null || s.step === 0 ? s : { ...s, step: s.step - 1 });
