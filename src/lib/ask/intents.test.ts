import { describe, expect, it } from "vitest";
import { EXAMPLES, normalize, parseQuestion, searchSections } from "./intents";

const first = (q: string) => parseQuestion(q)[0];

describe("normalize", () => {
  it("нижний регистр, ё → е, без знаков препинания", () => {
    expect(normalize("  Где ЗАВТРА — пара?!  ")).toBe("где завтра пара");
    expect(normalize("Учёба")).toBe("учеба");
  });
});

describe("parseQuestion", () => {
  it("справка с назначением открывает форму сразу с ним", () => {
    expect(first("нужна справка в военкомат")).toEqual({ kind: "document", code: "study", purpose: "в военный комиссариат" });
    expect(first("справку для визы")).toEqual({ kind: "document", code: "study", purpose: "в посольство для оформления визы" });
    expect(first("в банк справка")).toEqual({ kind: "document", code: "study", purpose: "в банк" });
    // Назначение понятно и без слова «справка».
    expect(first("для военкомата")).toMatchObject({ kind: "document", code: "study", purpose: "в военный комиссариат" });
  });

  it("справка об обучении без назначения — форма с выбором", () => {
    expect(first("справка что я учусь")).toEqual({ kind: "document", code: "study", purpose: undefined });
  });

  it("другие документы", () => {
    expect(first("выписка рейтинга")).toEqual({ kind: "document", code: "rating" });
    expect(first("справка о стипендии")).toEqual({ kind: "document", code: "scholarship" });
    expect(first("академическая справка для перевода")).toEqual({ kind: "document", code: "academic" });
    expect(first("хочу перезачесть курс")).toEqual({ kind: "document", code: "recredit" });
  });

  it("средний балл и рейтинг — карточка, а не справка", () => {
    expect(first("какой у меня средний?")).toEqual({ kind: "rating" });
    expect(first("мой рейтинг")).toEqual({ kind: "rating" });
    expect(parseQuestion("почему такой рейтинг")).toContainEqual({ kind: "section", section: "explain" });
  });

  it("пары: завтра, сегодня, ближайшая", () => {
    expect(first("где завтра первая пара?")).toEqual({ kind: "lessons", day: "tomorrow" });
    expect(first("какие пары сегодня")).toEqual({ kind: "lessons", day: "today" });
    expect(first("когда следующая пара")).toEqual({ kind: "lessons", day: "next" });
    expect(parseQuestion("расписание")).toEqual([{ kind: "section", section: "schedule" }]);
  });

  it("«пароль» — не пара", () => {
    const intents = parseQuestion("как сменить пароль");
    expect(intents).not.toContainEqual(expect.objectContaining({ kind: "lessons" }));
    expect(intents).toContainEqual({ kind: "section", section: "profile" });
  });

  it("цели, калькулятор, место, архив, достижения", () => {
    expect(first("сколько нужно до гранта")).toEqual({ kind: "section", section: "goal" });
    expect(first("повышенная стипендия")).toEqual({ kind: "section", section: "goal" });
    expect(parseQuestion("а если получу 90 на экзамене")).toContainEqual({ kind: "section", section: "whatIf" });
    expect(first("моё место на курсе")).toEqual({ kind: "section", section: "standing" });
    expect(first("оценки прошлого триместра")).toMatchObject({ kind: "rating" });
    expect(parseQuestion("оценки прошлого триместра")).toContainEqual({ kind: "section", section: "archive" });
    expect(first("занял место на олимпиаде")).toMatchObject({ kind: "section" });
    expect(parseQuestion("занял место на олимпиаде")).toContainEqual({ kind: "section", section: "achievement" });
  });

  it("разделы", () => {
    expect(first("добавить расписание в календарь")).toEqual({ kind: "section", section: "calendar" });
    expect(first("студенческий билет")).toEqual({ kind: "section", section: "card" });
    expect(first("статус моей заявки")).toEqual({ kind: "section", section: "requests" });
  });

  it("непонятный вопрос — пустой ответ, а не случайный раздел", () => {
    expect(parseQuestion("")).toEqual([]);
    expect(parseQuestion("   ?!  ")).toEqual([]);
    expect(parseQuestion("как дела у котика")).toEqual([]);
  });

  it("каждый пример из подсказок понимается", () => {
    for (const q of EXAMPLES) expect(parseQuestion(q).length, q).toBeGreaterThan(0);
  });
});

describe("searchSections", () => {
  it("находит раздел по началу слова, если вопрос не понят", () => {
    expect(searchSections("подписка")).toContain("calendar");
    expect(searchSections("кто такой котик")).toEqual([]);
    expect(searchSections("а б в")).toEqual([]);
  });
});
