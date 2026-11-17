import { describe, expect, it } from "vitest";
import { MIN_RESPONSES, parseFeedback, summarize, type FeedbackRow } from ".";

const row = (clarity: number, usefulness: number, fairness: number, comment: string | null = null): FeedbackRow => ({
  clarity,
  usefulness,
  fairness,
  comment,
});

describe("parseFeedback", () => {
  it("принимает целые 1–5 и пустой комментарий как null", () => {
    expect(parseFeedback({ clarity: "5", usefulness: "4", fairness: "3", comment: "  " })).toEqual({
      ok: true,
      value: { clarity: 5, usefulness: 4, fairness: 3, comment: null },
    });
  });

  it("не принимает пропуск, ноль, шестёрку и дробь", () => {
    const r = parseFeedback({ clarity: "", usefulness: "0", fairness: "4.5" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["clarity", "fairness", "usefulness"]);
    expect(parseFeedback({ clarity: "6", usefulness: "1", fairness: "1" }).ok).toBe(false);
  });

  it("длинный комментарий — ошибка, а не обрезка молча", () => {
    const r = parseFeedback({ clarity: "5", usefulness: "5", fairness: "5", comment: "а".repeat(501) });
    expect(r).toMatchObject({ ok: false, errors: { comment: expect.any(String) } });
  });
});

describe("summarize", () => {
  it("ниже порога — только число ответов, ни средних, ни комментариев", () => {
    const rows = Array.from({ length: MIN_RESPONSES - 1 }, () => row(5, 5, 5, "секрет"));
    expect(summarize(rows)).toEqual({ visible: false, count: MIN_RESPONSES - 1, needed: 1 });
  });

  it("от порога — средние с одним знаком, распределение и комментарии", () => {
    const s = summarize([row(5, 4, 3, "Б"), row(4, 4, 3), row(5, 3, 2, "А"), row(3, 4, 5), row(5, 5, 5)]);
    expect(s.visible).toBe(true);
    if (!s.visible) return;
    expect(s.count).toBe(5);
    expect(s.questions.map((q) => q.average)).toEqual([4.4, 4, 3.6]);
    expect(s.questions[0].distribution).toEqual([0, 0, 1, 1, 3]);
    // Порядок комментариев не зависит от порядка ответов.
    expect(s.comments).toEqual(["А", "Б"]);
  });
});
