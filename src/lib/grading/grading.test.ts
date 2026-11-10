import { describe, expect, it } from "vitest";
import {
  attendancePercent,
  disciplineScore,
  engagement,
  ratingForecast,
  type DisciplineInput,
  markFor,
  nextGoal,
  privilegesFor,
  neededOnExam,
  neededOnRemainingCheckpoints,
  sessionScore,
  trimesterRating,
  trimesterWork,
  yearRating,
} from ".";

describe("шкала", () => {
  it.each([
    [100, "excellent"],
    [90, "excellent"],
    [89.99, "good"],
    [75, "good"],
    [74.9, "satisfactory"],
    [60, "satisfactory"],
    [59, "fail"],
    [0, "fail"],
  ])("%s баллов → %s", (score, mark) => {
    expect(markFor(score)).toBe(mark);
  });
});

describe("работа в триместре", () => {
  it("среднее по срезам", () => {
    expect(trimesterWork([80, 70, 90])).toBe(80);
  });
  it("бонус преподавателя не больше +5", () => {
    expect(trimesterWork([80, 80, 80], 10)).toBe(85);
  });
  it("не выше 100", () => {
    expect(trimesterWork([98, 100], 5)).toBe(100);
  });
  it("нет срезов — нет балла", () => {
    expect(trimesterWork([])).toBeNull();
  });
});

describe("сессия", () => {
  it("автомат по зачёту ровно с 75", () => {
    expect(sessionScore({ kind: "credit", raw: null }, 75)).toEqual({ score: 75, auto: true, forecast: false });
  });
  it("без автомата зачёт не выше 74", () => {
    expect(sessionScore({ kind: "credit", raw: 95 }, 74.9)).toMatchObject({ score: 74, auto: false });
  });
  it("на экзамен автомат не распространяется", () => {
    expect(sessionScore({ kind: "exam", raw: 60 }, 95)).toMatchObject({ score: 60, auto: false });
  });
  it("каждая пересдача снимает 10", () => {
    expect(sessionScore({ kind: "exam", raw: 80, retakes: 2 }, 70)?.score).toBe(60);
  });
  it("штраф не уводит ниже нуля", () => {
    expect(sessionScore({ kind: "exam", raw: 5, retakes: 1 }, 70)?.score).toBe(0);
  });
  it("до сессии — прогноз по работе в триместре", () => {
    expect(sessionScore({ kind: "exam", raw: null }, 82)).toEqual({ score: 82, auto: false, forecast: true });
  });
});

describe("вовлечённость", () => {
  it("половина посещаемость, половина активность", () => {
    expect(engagement(90, 70)).toBe(80);
  });
  it("есть только посещаемость", () => {
    expect(engagement(88, null)).toBe(88);
  });
  it("нет ничего", () => {
    expect(engagement(null, null)).toBeNull();
  });
});

describe("балл дисциплины", () => {
  it("0,40 × работа + 0,45 × сессия + 0,15 × вовлечённость", () => {
    const r = disciplineScore({
      checkpoints: [70, 72, 71],
      session: { kind: "exam", raw: 95 },
      attendancePct: 90,
      activity: 80,
    });
    // 0.4·71 + 0.45·95 + 0.15·85 = 28.4 + 42.75 + 12.75
    expect(r?.score).toBeCloseTo(83.9, 6);
    expect(r?.forecast).toBe(false);
  });
  it("до сессии помечается как прогноз", () => {
    const r = disciplineScore({ checkpoints: [80], session: { kind: "exam", raw: null }, attendancePct: 100, activity: null });
    expect(r?.forecast).toBe(true);
  });
  it("без срезов — нет балла", () => {
    expect(disciplineScore({ checkpoints: [], session: { kind: "exam", raw: 90 }, attendancePct: 100, activity: 100 })).toBeNull();
  });
});

describe("рейтинг", () => {
  it("среднее по дисциплинам + бонус активности ×0,04", () => {
    expect(trimesterRating([80, 90], 50)).toEqual({ rating: 87, base: 85, bonus: 2 });
  });
  it("бонус активности не больше +4", () => {
    expect(trimesterRating([80], 300)?.bonus).toBe(4);
  });
  it("рейтинг не выше 100", () => {
    expect(trimesterRating([99, 98], 100)?.rating).toBe(100);
  });
  it("годовой — без бонуса", () => {
    expect(yearRating([88, 92, 90])).toBe(90);
  });
  it("нет данных", () => {
    expect(trimesterRating([], 10)).toBeNull();
    expect(yearRating([])).toBeNull();
  });
});

describe("калькулятор «что нужно, чтобы…»", () => {
  it("сколько нужно на 3-м срезе до автомата", () => {
    expect(neededOnRemainingCheckpoints([80, 77], 3, 75)).toEqual({ kind: "need", score: 68 });
  });
  it("при высоких срезах на последнем достаточно немногого", () => {
    expect(neededOnRemainingCheckpoints([95, 90], 3, 75)).toEqual({ kind: "need", score: 40 });
  });
  it("уже хватает, даже если получить 0", () => {
    expect(neededOnRemainingCheckpoints([100, 100], 3, 60)).toEqual({ kind: "already" });
  });
  it("недостижимо", () => {
    expect(neededOnRemainingCheckpoints([30, 40], 3, 75)).toEqual({ kind: "impossible" });
  });
  it("бонус преподавателя уменьшает нужный балл", () => {
    expect(neededOnRemainingCheckpoints([80, 77], 3, 75, 3)).toEqual({ kind: "need", score: 59 });
  });
  it("все срезы сданы", () => {
    expect(neededOnRemainingCheckpoints([70, 70, 70], 3, 75)).toEqual({ kind: "impossible" });
  });
  it("сколько нужно на экзамене для «отлично»", () => {
    // (90 − 0.4·88 − 0.15·90) / 0.45 = (90 − 35.2 − 13.5) / 0.45 = 91.78 → 92
    expect(neededOnExam(88, 90, 90)).toEqual({ kind: "need", score: 92 });
  });
  it("пересдача повышает нужный балл", () => {
    expect(neededOnExam(88, 90, 90, 1)).toEqual({ kind: "impossible" });
  });
});

describe("прогноз рейтинга", () => {
  const course = (checkpoints: number[], attendancePct: number | null = 100): DisciplineInput => ({
    checkpoints,
    session: { kind: "exam", raw: null },
    attendancePct,
    activity: null,
  });

  it("без сессии — прогноз: работа вместо сессии, посещаемость вместо вовлечённости", () => {
    const r = ratingForecast([course([80, 90], 100)], 0)!;
    // 0,40·85 + 0,45·85 + 0,15·100 = 87,25
    expect(r.rating).toBeCloseTo(87.25);
    expect(r.forecast).toBe(true);
    expect(r.counted).toBe(1);
  });

  it("дисциплины без срезов не учитываются, бонус активности добавляется", () => {
    const r = ratingForecast([course([80, 90], 100), course([])], 50)!;
    expect(r.counted).toBe(1);
    expect(r.bonus).toBeCloseTo(2);
    expect(r.rating).toBeCloseTo(89.25);
  });

  it("нет ни одной оценённой дисциплины — null", () => {
    expect(ratingForecast([course([])], 0)).toBeNull();
  });

  it("посещаемость без уважительных пропусков", () => {
    expect(attendancePercent(18, 2)).toBe(90);
    expect(attendancePercent(0, 0)).toBeNull();
  });
});

describe("привилегии и ближайшая цель", () => {
  const r = (base: number, bonus = 0) => ({ base, bonus, rating: base + bonus });

  it("бюджет: только стипендия и отметка, по рейтингу с бонусом", () => {
    const list = privilegesFor(r(83, 2), false);
    expect(list.map((x) => x.key)).toEqual(["scholarship", "top"]);
    expect(list.every((x) => x.reached)).toBe(true);
  });

  it("платная форма: гранты считаются по среднему без бонуса", () => {
    const list = privilegesFor(r(89.4, 1.6), true);
    expect(list.find((x) => x.key === "grant25")?.reached).toBe(false);
  });

  it("цель платника — ближайший грант", () => {
    expect(nextGoal(r(89.4, 1.6), true)).toMatchObject({ label: "грант 25%", target: 90 });
    expect(nextGoal(r(89.4, 1.6), true).gap).toBeCloseTo(0.6);
  });

  it("грант 25% есть — цель 50%", () => {
    expect(nextGoal(r(92), true)).toMatchObject({ label: "грант 50%", target: 95, gap: 3 });
  });

  it("всё достигнуто — gap 0", () => {
    expect(nextGoal(r(97), true)).toMatchObject({ label: "грант 50%", gap: 0 });
  });

  it("цель бюджетника — повышенная стипендия по рейтингу", () => {
    const g = nextGoal(r(73, 1.6), false);
    expect(g).toMatchObject({ label: "повышенная стипендия", target: 85, basis: "rating" });
    expect(g.gap).toBeCloseTo(10.4);
  });
});
