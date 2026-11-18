import { describe, expect, it } from "vitest";
import { ANSWER_MAX, checkAnswer, checkQuestion, preview, QUESTION_TOPICS, TEXT_MAX } from ".";

describe("вопрос в деканат", () => {
  it("принимает тему из списка и текст, убирает лишние пробелы и пустые строки", () => {
    const r = checkQuestion({ topic: "Расписание", text: "  Когда будет\r\n\r\n\r\n\r\nпересдача?  " });
    expect(r).toEqual({ ok: true, value: { topic: "Расписание", text: "Когда будет\n\nпересдача?" } });
  });

  it("тема не из списка — ошибка, даже похожая", () => {
    for (const topic of [undefined, "", "учёба и оценки", "Админка", 1]) {
      const r = checkQuestion({ topic, text: "Нормальный вопрос про учёбу" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.topic).toBeTruthy();
    }
    for (const topic of QUESTION_TOPICS) expect(checkQuestion({ topic, text: "Нормальный вопрос" }).ok).toBe(true);
  });

  it("слишком короткий или слишком длинный текст — ошибка с понятной причиной", () => {
    const short = checkQuestion({ topic: "Другое", text: "  ?  " });
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.errors.text).toMatch(/от 10/);
    const long = checkQuestion({ topic: "Другое", text: "а".repeat(TEXT_MAX + 1) });
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.errors.text).toMatch(/1000/);
    expect(checkQuestion({ topic: "Другое", text: "а".repeat(TEXT_MAX) }).ok).toBe(true);
  });

  it("не строка вместо текста не роняет проверку", () => {
    const r = checkQuestion({ topic: "Другое", text: { evil: true } });
    expect(r.ok).toBe(false);
  });
});

describe("ответ деканата", () => {
  it("пустой ответ нельзя отправить", () => {
    expect(checkAnswer("   \n ")).toEqual({ ok: false, error: expect.stringMatching(/текст ответа/) });
    expect(checkAnswer(null).ok).toBe(false);
  });

  it("длина ограничена", () => {
    expect(checkAnswer("а".repeat(ANSWER_MAX)).ok).toBe(true);
    expect(checkAnswer("а".repeat(ANSWER_MAX + 1)).ok).toBe(false);
  });
});

describe("начало ответа для уведомления", () => {
  it("короткий ответ — целиком, в одну строку", () => {
    expect(preview("Да,\n\nможно.")).toBe("Да, можно.");
  });

  it("длинный — по границе слова, с многоточием и не длиннее предела", () => {
    const text = "Пересдача по эконометрике будет в следующий четверг, в 15:00, в аудитории 305. Возьми с собой зачётку и направление.";
    const p = preview(text, 60);
    expect(p.length).toBeLessThanOrEqual(60);
    expect(p.endsWith("…")).toBe(true);
    expect(text.startsWith(p.slice(0, -1))).toBe(true);
    expect(p).not.toMatch(/[ ,]…$/);
  });
});
