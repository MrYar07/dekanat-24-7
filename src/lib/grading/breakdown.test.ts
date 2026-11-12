import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, disciplineScore, explainDiscipline, ratingBySteps, ratingForecast, type DisciplineInput } from "./index";

const exam = (over: Partial<DisciplineInput> = {}): DisciplineInput => ({
  checkpoints: [86, 92],
  bonus: 1,
  session: { kind: "exam", raw: null },
  attendancePct: 96,
  activity: null,
  ...over,
});

describe("разбор балла дисциплины", () => {
  it("сумма вкладов равна баллу дисциплины — в любом режиме", () => {
    const cases: DisciplineInput[] = [
      exam(),
      exam({ session: { kind: "exam", raw: 95, retakes: 1 }, activity: 80 }),
      exam({ checkpoints: [60, 62, 58], bonus: 0, session: { kind: "credit", raw: 90 } }),
      exam({ checkpoints: [88], session: { kind: "credit", raw: null }, attendancePct: null }),
    ];
    for (const input of cases) {
      const b = explainDiscipline(input)!;
      expect(b.work.points + b.session.points + b.engagement.points).toBeCloseTo(disciplineScore(input)!.score, 9);
      expect(b.score).toBe(disciplineScore(input)!.score);
    }
  });

  it("до сессии: вместо экзамена подставлена работа в триместре, и это помечено прогнозом", () => {
    const b = explainDiscipline(exam())!;
    expect(b.work).toMatchObject({ mean: 89, bonus: 1, value: 90, count: 2 });
    expect(b.session).toMatchObject({ mode: "forecast", value: 90, raw: null, penalty: 0 });
    expect(b.engagement).toMatchObject({ mode: "attendance", value: 96 });
    expect(b.work.points).toBeCloseTo(36);
    expect(b.forecast).toBe(true);
  });

  it("пример из PRD: за экзамен 95, но за работу 71 — дисциплина 83", () => {
    const b = explainDiscipline(
      exam({ checkpoints: [70, 72], bonus: 0, session: { kind: "exam", raw: 95 }, attendancePct: 80, activity: 80 }),
    )!;
    expect(b.session.mode).toBe("taken");
    expect(Math.round(b.score)).toBe(83);
    expect(b.session.value).toBeGreaterThan(b.work.value);
  });

  it("автомат по зачёту, потолок без автомата и штраф за пересдачу", () => {
    const auto = explainDiscipline(exam({ checkpoints: [80, 84], bonus: 0, session: { kind: "credit", raw: null } }))!;
    expect(auto.session).toMatchObject({ mode: "auto", value: 82, capped: false });

    const capped = explainDiscipline(exam({ checkpoints: [60, 64], bonus: 0, session: { kind: "credit", raw: 95 } }))!;
    expect(capped.session).toMatchObject({ mode: "taken", capped: true, value: DEFAULT_SETTINGS.creditCapWithoutAuto });

    const retake = explainDiscipline(exam({ session: { kind: "exam", raw: 80, retakes: 2 } }))!;
    expect(retake.session).toMatchObject({ retakes: 2, penalty: 20, value: 60 });
  });

  it("нет срезов — разбирать нечего", () => {
    expect(explainDiscipline(exam({ checkpoints: [] }))).toBeNull();
  });
});

describe("как срезы меняли прогноз рейтинга", () => {
  const courses = [exam({ checkpoints: [80, 90] }), exam({ checkpoints: [70] })];

  it("шаг на каждый выставленный срез; последний шаг равен текущему рейтингу", () => {
    const steps = ratingBySteps(courses, 40);
    expect(steps.map((s) => s.after)).toEqual([1, 2]);
    expect(steps.at(-1)!.rating).toBeCloseTo(ratingForecast(courses, 40)!.rating, 9);
  });

  it("дисциплина с меньшим числом срезов участвует тем, что есть", () => {
    const [first, second] = ratingBySteps(courses, 0);
    // На втором шаге изменилась только первая дисциплина: средний балл вырос.
    expect(second.base).toBeGreaterThan(first.base);
  });

  it("нет срезов — нет шагов", () => {
    expect(ratingBySteps([exam({ checkpoints: [] })], 0)).toEqual([]);
  });
});
