import { describe, expect, it } from "vitest";
import { disciplineScore, ratingForecast, type DisciplineInput } from "./index";
import { applyScenario, EMPTY_SCENARIO, isEmptyScenario, whatIf, type CourseScenario } from "./scenario";

const exam = (over: Partial<DisciplineInput> = {}): DisciplineInput => ({
  checkpoints: [80, 84],
  bonus: 0,
  session: { kind: "exam", raw: null },
  attendancePct: 90,
  activity: null,
  ...over,
});
const sc = (over: Partial<CourseScenario> = {}): CourseScenario => ({ ...EMPTY_SCENARIO, ...over });

describe("калькулятор «а если…»: дисциплина", () => {
  it("пустой сценарий ничего не меняет", () => {
    const input = exam();
    expect(isEmptyScenario(EMPTY_SCENARIO)).toBe(true);
    expect(applyScenario(input, EMPTY_SCENARIO)).toEqual(input);
  });

  it("предполагаемый срез добавляется к выставленным, по порядку номеров", () => {
    const one = exam({ checkpoints: [80] });
    expect(applyScenario(one, sc({ checkpoints: { 3: 100, 2: 60 } })).checkpoints).toEqual([80, 60, 100]);
    // Выставленные оценки сценарий не трогает.
    expect(one.checkpoints).toEqual([80]);
  });

  it("экзамен в сценарии заменяет прогноз, пересдача стоит 10 баллов", () => {
    const first = disciplineScore(applyScenario(exam(), sc({ session: 90 })))!;
    const retake = disciplineScore(applyScenario(exam(), sc({ session: 90, retakes: 1 })))!;
    expect(first.session).toMatchObject({ score: 90, forecast: false });
    expect(retake.session.score).toBe(80);
    // Сессия весит 45%: минус 10 на экзамене — минус 4,5 в дисциплине.
    expect(first.score - retake.score).toBeCloseTo(4.5, 9);
  });

  it("пересдачи без балла сессии не учитываются; значения округляются и ограничиваются 0–100", () => {
    expect(applyScenario(exam(), sc({ retakes: 2 })).session).toEqual({ kind: "exam", raw: null });
    expect(applyScenario(exam({ checkpoints: [] }), sc({ checkpoints: { 1: 150, 2: -5, 3: 84.6 } })).checkpoints).toEqual([100, 0, 85]);
    expect(applyScenario(exam(), sc({ session: 140 })).session.raw).toBe(100);
  });

  it("срез, который дотягивает до автомата, делает зачёт автоматом", () => {
    const credit = exam({ checkpoints: [70, 72], session: { kind: "credit", raw: null } });
    expect(disciplineScore(credit)!.session.auto).toBe(false);
    expect(disciplineScore(applyScenario(credit, sc({ checkpoints: { 3: 85 } })))!.session.auto).toBe(true);
  });
});

describe("калькулятор «а если…»: рейтинг", () => {
  const courses = [exam(), exam({ checkpoints: [90, 94] })];
  const now = { now: 40, then: 40 };

  it("без сценария «до» и «после» совпадают с обычным рейтингом", () => {
    const r = whatIf(
      courses.map((input) => ({ input, scenario: EMPTY_SCENARIO })),
      now,
      false,
    );
    expect(r.after).toEqual(r.before);
    expect(r.before!.rating).toBeCloseTo(ratingForecast(courses, 40)!.rating, 9);
    expect(r.gained).toEqual([]);
    expect(r.lost).toEqual([]);
  });

  it("плюс N баллов в одной из двух дисциплин — плюс N/2 к рейтингу", () => {
    const r = whatIf(
      [
        { input: courses[0], scenario: sc({ session: 100 }) },
        { input: courses[1], scenario: EMPTY_SCENARIO },
      ],
      now,
      false,
    );
    const gain = r.courses[0].after!.score - r.courses[0].before!.score;
    expect(gain).toBeGreaterThan(0);
    expect(r.after!.rating - r.before!.rating).toBeCloseTo(gain / 2, 9);
    expect(r.courses[1].after).toEqual(r.courses[1].before);
  });

  it("показывает привилегии, которые сценарий даёт и отнимает", () => {
    // Сейчас 82 + бонус 1,6 = 83,6: «в числе лучших» есть, повышенной стипендии (от 85) нет.
    const base = [exam({ checkpoints: [82, 82], attendancePct: 82 })];
    const up = whatIf([{ input: base[0], scenario: sc({ session: 95 }) }], now, false);
    expect(up.gained.map((p) => p.key)).toEqual(["scholarship"]);
    expect(up.lost).toEqual([]);

    const down = whatIf([{ input: base[0], scenario: sc({ session: 60 }) }], now, false);
    expect(down.lost.map((p) => p.key)).toEqual(["top"]);
  });

  it("баллы активности в сценарии меняют только бонус", () => {
    const r = whatIf(
      courses.map((input) => ({ input, scenario: EMPTY_SCENARIO })),
      { now: 40, then: 100 },
      false,
    );
    expect(r.after!.base).toBeCloseTo(r.before!.base, 9);
    expect(r.after!.bonus - r.before!.bonus).toBeCloseTo(2.4, 9);
  });
});
